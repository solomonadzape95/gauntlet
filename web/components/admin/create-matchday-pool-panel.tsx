"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { PACKAGE_ID, TREASURY_ADDRESS, suiscanObject } from "@/lib/sui";
import { rosterWeightArgs } from "@/lib/odds";
import { convexConfigured } from "@/lib/convex";
import { RosterCriteriaFilter } from "./roster-criteria-filter";
import type { Player } from "@/lib/types";

interface Tournament {
  slug: string;
  name: string;
  playerPoolBlobId?: string;
}

/**
 * The full matchday-pool create flow:
 *  1. Filter the parent tournament's player pool by criteria.
 *  2. Upload the resulting subset to Walrus as a matchday roster blob.
 *  3. Call `pool::create_pool(fee, rosterBlobIdBytes)` on Sui — capture the
 *     new Pool object id from objectChanges.
 *  4. Insert a `matchdays` row in Convex with the pool id + roster blob id.
 *
 * Each step is independent and surfaces its own error / progress so a stuck
 * flow can be debugged in place.
 */
export function CreateMatchdayPoolPanel({
  tournament,
  onCreated,
}: {
  tournament: Tournament;
  onCreated?: (mdSlug: string) => void;
}) {
  const router = useRouter();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const createMatchday = useMutation(api.matchdays.create);
  const recordRoster = useMutation(api.rosters.record);

  const [mdSlug, setMdSlug] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [fixture, setFixture] = useState("");
  const [feeSui, setFeeSui] = useState("0.1");
  const [players, setPlayers] = useState<Player[]>([]);

  const [stage, setStage] = useState<
    "idle" | "uploading" | "minting" | "saving" | "done"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [newPoolId, setNewPoolId] = useState<string | null>(null);
  const [newBlobId, setNewBlobId] = useState<string | null>(null);

  const canSubmit =
    convexConfigured &&
    tournament.playerPoolBlobId &&
    mdSlug.trim() &&
    label.trim() &&
    date.trim() &&
    players.length > 0 &&
    stage !== "uploading" &&
    stage !== "minting" &&
    stage !== "saving";

  const handleSubmit = async () => {
    setError(null);
    if (!tournament.playerPoolBlobId) {
      setError(
        "Tournament has no player pool. Upload one from Rosters first.",
      );
      return;
    }
    if (players.length === 0) {
      setError("Filter must match at least one player.");
      return;
    }
    if (!account?.address) {
      setError("Connect a wallet.");
      return;
    }

    // 1. Walrus upload
    setStage("uploading");
    let rosterBlobId: string;
    try {
      const rosterDoc = {
        schema_version: 2,
        tournament: tournament.slug,
        matchday: mdSlug.trim(),
        fixture: fixture ? { id: 0, venue: "", kickoff_utc: date, home: "", away: "", label: fixture } : undefined,
        ai_game_master: "criteria-filter",
        players,
      };
      const res = await fetch("/api/walrus/upload?epochs=5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rosterDoc),
      });
      const data = await res.json();
      if (!res.ok || !data.blobId) {
        throw new Error(data.error ?? `Walrus upload failed (${res.status})`);
      }
      rosterBlobId = data.blobId as string;
      setNewBlobId(rosterBlobId);
    } catch (e) {
      setStage("idle");
      setError(`Walrus upload: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    // Index in Convex (best-effort)
    try {
      await recordRoster({
        blobId: rosterBlobId,
        kind: "matchday-roster",
        tournamentSlug: tournament.slug,
        mdSlug: mdSlug.trim(),
        name: `${tournament.name} · ${label.trim()}`,
        playerCount: players.length,
        uploadedBy: account.address,
      });
    } catch (e) {
      console.warn("Failed to index roster in Convex", e);
    }

    // 2. Sui create_pool
    setStage("minting");
    let poolObjectId: string;
    try {
      const fee = parseFloat(feeSui);
      if (!Number.isFinite(fee) || fee <= 0) {
        throw new Error("Entry fee must be a positive number.");
      }
      const feeMist = BigInt(Math.round(fee * 1e9));
      const rosterBytes = Array.from(new TextEncoder().encode(rosterBlobId));
      // Per-player share weights, fixed on-chain from this roster so they
      // can't be forged at mint time.
      const { playerIds, weights } = rosterWeightArgs(players);
      const treasury =
        TREASURY_ADDRESS && TREASURY_ADDRESS !== "0x0"
          ? TREASURY_ADDRESS
          : account.address;

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::pool::create_pool`,
        arguments: [
          tx.pure.u64(feeMist),
          tx.pure.vector("u8", rosterBytes),
          tx.pure.address(treasury),
          tx.pure.vector("u32", playerIds),
          tx.pure.vector("u64", weights),
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      const detail = await client.getTransactionBlock({
        digest: result.digest,
        options: { showObjectChanges: true },
      });
      const created = detail.objectChanges?.find(
        (c) =>
          c.type === "created" &&
          "objectType" in c &&
          typeof c.objectType === "string" &&
          c.objectType.endsWith("::pool::Pool"),
      );
      if (!created || !("objectId" in created)) {
        throw new Error("Pool created but objectId not found in tx.");
      }
      poolObjectId = String(created.objectId);
      setNewPoolId(poolObjectId);
    } catch (e) {
      setStage("idle");
      setError(`Sui mint: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    // 3. Convex matchday row
    setStage("saving");
    try {
      await createMatchday({
        tournamentSlug: tournament.slug,
        mdSlug: mdSlug.trim(),
        label: label.trim(),
        date,
        fixture: fixture.trim() || undefined,
        status: "live",
        rosterBlobId,
        poolObjectId,
        entryFeeMist: String(BigInt(Math.round(parseFloat(feeSui) * 1e9))),
      });
    } catch (e) {
      setStage("idle");
      setError(`Convex save: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    setStage("done");
    onCreated?.(mdSlug.trim());
    setTimeout(() => router.push(`/admin/tournaments/${tournament.slug}`), 800);
  };

  return (
    <div className="space-y-6">
      <div className="border border-zinc-900 p-6 md:p-8">
        <div className="text-utility text-zinc-500 mb-2">Matchday details</div>
        <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
          New matchday pool · {tournament.name}
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Slug (MD1, R16, F)">
            <input
              type="text"
              value={mdSlug}
              onChange={(e) => setMdSlug(e.target.value)}
              placeholder="MD1"
              className="w-full bg-ink border border-zinc-800 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-hazard"
            />
          </Field>
          <Field label="Label">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Matchday 1"
              className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
            />
          </Field>
          <Field label="Fixture (optional)" className="md:col-span-2">
            <input
              type="text"
              value={fixture}
              onChange={(e) => setFixture(e.target.value)}
              placeholder="Mexico vs South Africa · Estadio Azteca"
              className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
            />
          </Field>
          <Field label="Entry fee (SUI)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={feeSui}
              onChange={(e) => setFeeSui(e.target.value)}
              className="w-full bg-ink border border-zinc-800 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-hazard"
            />
          </Field>
        </div>
      </div>

      <div>
        <div className="text-utility text-zinc-500 mb-3">
          Pick players by criteria
        </div>
        {tournament.playerPoolBlobId ? (
          <RosterCriteriaFilter
            playerPoolBlobId={tournament.playerPoolBlobId}
            onChange={setPlayers}
          />
        ) : (
          <div className="border border-amber-900/50 bg-amber-950/10 p-5">
            <div className="text-utility text-amber-400 mb-2">
              No player pool attached
            </div>
            <p className="text-base text-zinc-300">
              Upload a player pool roster for{" "}
              <code className="font-mono">{tournament.slug}</code> from{" "}
              <a
                href="/admin/rosters"
                className="text-hazard hover:underline"
              >
                Rosters
              </a>{" "}
              first.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="hazard"
          onClick={handleSubmit}
          disabled={!canSubmit}
          bullet
        >
          {stage === "uploading" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Pushing roster to
              Walrus…
            </>
          ) : stage === "minting" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Minting Pool on Sui…
            </>
          ) : stage === "saving" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving to Convex…
            </>
          ) : (
            "Create matchday pool"
          )}
        </Button>
        {players.length > 0 && (
          <span className="text-utility text-zinc-500">
            <span className="text-hazard">{players.length}</span> players
            staged
          </span>
        )}
      </div>

      {stage === "done" && newPoolId && (
        <div className="border border-hazard ring-1 ring-hazard bg-hazard/[0.04] p-4">
          <div className="text-utility text-hazard mb-2">✓ Matchday pool live</div>
          <div className="text-base text-zinc-100">
            Pool object{" "}
            <a
              href={suiscanObject(newPoolId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-hazard hover:underline"
            >
              {newPoolId.slice(0, 18)}…
            </a>
            <br />
            Roster blob{" "}
            <code className="font-mono text-zinc-400 break-all">
              {newBlobId}
            </code>
          </div>
        </div>
      )}

      {error && (
        <div className="border border-red-900/50 bg-red-950/20 p-4">
          <div className="text-utility text-red-400 mb-2">Error</div>
          <p className="text-base text-red-300 break-words">{error}</p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-utility text-zinc-500 block mb-2">{label}</label>
      {children}
    </div>
  );
}
