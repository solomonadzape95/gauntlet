"use client";

import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Loader2 } from "lucide-react";

import { PACKAGE_ID, ROSTER_BLOB_ID, TREASURY_ADDRESS } from "@/lib/sui";
import { rosterWeightArgs } from "@/lib/odds";
import { fetchRoster } from "@/lib/walrus";
import { Button } from "@/components/ui/button";

export function CreatePoolPanel({
  embedded = false,
}: {
  /** When true, drops the outer border + heading so it fits inside a modal. */
  embedded?: boolean;
}) {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [feeSui, setFeeSui] = useState("0.1");
  const [blobId, setBlobId] = useState(ROSTER_BLOB_ID);
  const [busy, setBusy] = useState(false);
  const [newPoolId, setNewPoolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setBusy(true);
      setError(null);
      setNewPoolId(null);

      const fee = parseFloat(feeSui);
      if (!Number.isFinite(fee) || fee <= 0) {
        throw new Error("Entry fee must be a positive number");
      }
      const feeMist = BigInt(Math.round(fee * 1e9));

      if (!blobId.trim()) {
        throw new Error("Roster blob ID required");
      }
      if (!account?.address) {
        throw new Error("Connect a wallet");
      }

      // Fetch the roster so we can fix each player's share weight on-chain.
      const roster = await fetchRoster(blobId.trim());
      if (!roster?.players?.length) {
        throw new Error("Roster blob has no players");
      }
      const { playerIds, weights } = rosterWeightArgs(roster.players);
      const treasury =
        TREASURY_ADDRESS && TREASURY_ADDRESS !== "0x0"
          ? TREASURY_ADDRESS
          : account.address;

      const tx = new Transaction();
      const rosterBytes = Array.from(new TextEncoder().encode(blobId.trim()));

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

      if (created && "objectId" in created) {
        setNewPoolId(String(created.objectId));
      } else {
        throw new Error("Pool created but objectId not found in tx");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        embedded ? "p-0" : "border border-zinc-900 p-6 md:p-8"
      }
    >
      {!embedded && (
        <>
          <div className="text-utility text-zinc-500 mb-2">Spawn pool</div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
            Create a fresh pool
          </h2>
        </>
      )}
      <p className={`text-base text-zinc-300 max-w-xl leading-relaxed ${embedded ? "" : "mt-3"}`}>
        Calls <code className="font-mono text-zinc-100">gauntlet::pool::create_pool</code>{" "}
        with your entry fee + roster blob. Whoever signs becomes the on-chain admin of the new pool.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-utility text-zinc-500 block mb-2">
            Entry fee (SUI)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={feeSui}
            onChange={(e) => setFeeSui(e.target.value)}
            className="w-full bg-ink border border-zinc-800 px-3 py-2.5 font-mono text-base focus:outline-none focus:border-hazard"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-utility text-zinc-500 block mb-2">
            Roster blob ID (Walrus)
          </label>
          <input
            type="text"
            value={blobId}
            onChange={(e) => setBlobId(e.target.value)}
            className="w-full bg-ink border border-zinc-800 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-hazard"
          />
        </div>
      </div>

      <div className="mt-6">
        <Button variant="hazard" onClick={handleCreate} disabled={busy} bullet>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create Pool"
          )}
        </Button>
      </div>

      {newPoolId && (
        <div className="mt-6 border border-hazard ring-1 ring-hazard bg-hazard/[0.04] p-4">
          <div className="text-utility text-hazard mb-2">✓ New Pool created</div>
          <div className="font-mono text-sm text-zinc-100 break-all">{newPoolId}</div>
          <p className="mt-3 text-utility text-zinc-400 leading-relaxed">
            Update <code className="font-mono">NEXT_PUBLIC_POOL_OBJECT_ID</code>{" "}
            in <code>web/.env.local</code> with this ID, then run{" "}
            <code className="font-mono">rm -rf .next && pnpm dev</code>.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 border border-red-900/50 bg-red-950/20 p-3">
          <p className="text-base text-red-300 break-words">{error}</p>
        </div>
      )}
    </div>
  );
}
