"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Loader2, UploadCloud, Copy, Check } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { Button } from "@/components/ui/button";
import { convexConfigured } from "@/lib/convex";

type Kind = "player-pool" | "matchday-roster" | "matchday-results";

export default function AdminRostersPage() {
  const account = useCurrentAccount();
  const recordRoster = useMutation(api.rosters.record);
  const updateTournament = useMutation(api.tournaments.update);
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  );
  const allRosters = useQuery(
    api.rosters.listByKind,
    convexConfigured ? { kind: "player-pool" as const } : "skip",
  );
  const matchdayRosters = useQuery(
    api.rosters.listByKind,
    convexConfigured ? { kind: "matchday-roster" as const } : "skip",
  );

  const [kind, setKind] = useState<Kind>("player-pool");
  const [tournamentSlug, setTournamentSlug] = useState<string>("");
  const [mdSlug, setMdSlug] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBlobId, setLastBlobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleUpload = async () => {
    setError(null);
    if (!file) {
      setError("Pick a JSON file first.");
      return;
    }
    if (!name.trim()) {
      setError("Give this roster a name so you can find it later.");
      return;
    }
    if (kind === "player-pool" && !tournamentSlug) {
      setError("Player pools must attach to a tournament.");
      return;
    }
    try {
      setBusy(true);
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        throw new Error(`File is not valid JSON: ${(e as Error).message}`);
      }
      const playerCount = countPlayers(parsed);

      const res = await fetch("/api/walrus/upload?epochs=5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok || !data.blobId) {
        throw new Error(data.error ?? `Upload failed: ${res.status}`);
      }
      const blobId = data.blobId as string;

      await recordRoster({
        blobId,
        kind,
        tournamentSlug: tournamentSlug || undefined,
        mdSlug: mdSlug.trim() || undefined,
        name: name.trim(),
        playerCount,
        uploadedBy: account?.address ?? "anonymous",
      });

      // Player pool: also pin onto the tournament for the create-matchday form.
      if (kind === "player-pool" && tournamentSlug) {
        try {
          await updateTournament({
            slug: tournamentSlug,
            playerPoolBlobId: blobId,
          });
        } catch (e) {
          console.warn("Failed to pin player pool on tournament", e);
        }
      }

      setLastBlobId(blobId);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!lastBlobId) return;
    navigator.clipboard.writeText(lastBlobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">
            Rosters · Walrus uploads
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Manage rosters
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Upload player pools, matchday rosters, and matchday results to
            Walrus. Each upload is indexed in Convex so the create-pool form can
            pick from a dropdown.
          </p>
        </section>
      </CornerFrame>

      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="border border-zinc-900 p-6 md:p-8">
            <div className="text-utility text-zinc-500 mb-2">New upload</div>
            <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              Push to Walrus
            </h2>
            <p className="mt-3 text-base text-zinc-300 max-w-xl leading-relaxed">
              Blobs are immutable; to &quot;edit&quot; you upload a new version and
              repoint. The previous blob stays addressable forever.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Kind">
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind)}
                  className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
                >
                  <option value="player-pool">
                    Player pool (master, per tournament)
                  </option>
                  <option value="matchday-roster">
                    Matchday roster (filtered subset)
                  </option>
                  <option value="matchday-results">
                    Matchday results (post-game)
                  </option>
                </select>
              </Field>
              <Field label="Tournament">
                <select
                  value={tournamentSlug}
                  onChange={(e) => setTournamentSlug(e.target.value)}
                  className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
                >
                  <option value="">— optional —</option>
                  {(tournaments as Array<{
                    _id: string;
                    slug: string;
                    name: string;
                  }> | undefined)?.map((t) => (
                    <option key={t._id} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Matchday slug (optional)">
                <input
                  type="text"
                  value={mdSlug}
                  onChange={(e) => setMdSlug(e.target.value)}
                  placeholder="MD1"
                  className="w-full bg-ink border border-zinc-800 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-hazard"
                />
              </Field>
              <Field label="Display name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="WC 2026 master squads"
                  className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
                />
              </Field>
              <Field label="JSON file" className="md:col-span-2">
                <label className="flex items-center justify-between gap-3 border border-dashed border-zinc-800 hover:border-zinc-700 px-4 py-4 cursor-pointer">
                  <span className="text-base text-zinc-300 truncate">
                    {file?.name ?? "Drop or pick a .json file"}
                  </span>
                  <span className="text-utility text-zinc-500 inline-flex items-center gap-2">
                    <UploadCloud className="size-4" /> Browse
                  </span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </Field>
            </div>

            <div className="mt-6">
              <Button
                variant="hazard"
                onClick={handleUpload}
                disabled={busy}
                bullet
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  "Push to Walrus"
                )}
              </Button>
            </div>

            {lastBlobId && (
              <div className="mt-6 border border-hazard ring-1 ring-hazard bg-hazard/[0.04] p-4">
                <div className="text-utility text-hazard mb-2 flex items-center justify-between">
                  ✓ Uploaded
                  <button
                    onClick={copy}
                    className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-hazard"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3" /> copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> copy blobId
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-sm text-zinc-100 break-all">
                  {lastBlobId}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 border border-red-900/50 bg-red-950/20 p-3">
                <p className="text-base text-red-300 break-words">{error}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Indexed lists */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RosterList title="Player pools" rows={allRosters} />
          <RosterList title="Matchday rosters" rows={matchdayRosters} />
        </div>
      </section>
    </div>
  );
}

function RosterList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    _id: string;
    blobId: string;
    name: string;
    playerCount: number;
    tournamentSlug?: string;
    mdSlug?: string;
    version: number;
    uploadedAt: number;
  }> | undefined;
}) {
  return (
    <div className="border border-zinc-900">
      <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold">{title}</h3>
        {rows === undefined && (
          <Loader2 className="size-4 animate-spin text-zinc-600" />
        )}
      </div>
      {rows && rows.length === 0 && (
        <div className="px-5 py-6 text-zinc-500">None yet.</div>
      )}
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-zinc-900">
          {rows.map((r) => (
            <li key={r._id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-serif text-base text-zinc-100 truncate">
                  {r.name}
                </div>
                <div className="text-utility text-zinc-500 shrink-0">
                  v{r.version} · {r.playerCount} players
                </div>
              </div>
              <div className="mt-1 font-mono text-xs text-zinc-600 truncate">
                {r.tournamentSlug ?? "—"} {r.mdSlug ? `· ${r.mdSlug}` : ""}
              </div>
              <div className="mt-1 font-mono text-xs text-zinc-600 truncate">
                {r.blobId}
              </div>
            </li>
          ))}
        </ul>
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

function countPlayers(parsed: unknown): number {
  if (!parsed || typeof parsed !== "object") return 0;
  // Roster JSON: { players: [...] } or { results: [...] }
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.players)) return obj.players.length;
  if (Array.isArray(obj.results)) return obj.results.length;
  if (Array.isArray(parsed)) return (parsed as unknown[]).length;
  return 0;
}
