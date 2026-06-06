"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Transaction } from "@mysten/sui/transactions";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import type { Player } from "@/lib/types";
import {
  PACKAGE_ID,
  CLOCK_ID,
  ENTRY_FEE_MIST,
  formatSui,
  suiscanTx,
} from "@/lib/sui";
import { mintCountsKey } from "@/lib/hooks/use-mint-counts";
import { poolStateKey, usePoolState } from "@/lib/hooks/use-pool-state";
import {
  useMyPasses,
  MY_PASSES_KEY,
} from "@/lib/hooks/use-my-passes";
import {
  assertTxSuccess,
  describeTxError,
  isUserRejection,
} from "@/lib/tx-errors";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Loader2 } from "lucide-react";

type Status =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "success"; digest: string; passId: string | null }
  | { kind: "error"; message: string };

export function MintButton({
  player,
  poolId,
  onSuccess,
}: {
  player: Player;
  /** Which on-chain Pool this mint targets. Comes from PoolMeta in the URL,
   *  NOT the env-default singleton — every pool screen passes its own. */
  poolId: string;
  onSuccess?: () => void;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const qc = useQueryClient();
  const router = useRouter();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const refreshPool = useAction(api.sui_actions.refreshPool);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const { data: pool } = usePoolState(poolId);
  const { data: passes } = useMyPasses();

  const existingPass = (passes ?? []).find(
    (p) => p.pool_id === poolId && p.player_id === player.id,
  );
  const phaseIsOpen = pool?.phase === 0;
  const entryFeeMist = pool?.entry_fee_mist ?? ENTRY_FEE_MIST;
  const entryFeeLabel = `${formatSui(entryFeeMist)} SUI`;

  const handleMint = async () => {
    if (!account) return;
    if (PACKAGE_ID === "0x0" || poolId === "0x0") {
      setStatus({
        kind: "error",
        message: "Package or Pool ID not configured.",
      });
      return;
    }

    try {
      setStatus({ kind: "signing" });

      const tx = new Transaction();
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(entryFeeMist)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::pool::mint_pass`,
        arguments: [
          tx.object(poolId),
          tx.pure.u32(player.id),
          payment,
          tx.object(CLOCK_ID),
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });

      // Confirm effects.status — a digest comes back as soon as accepted, not
      // when it succeeds.
      const detail = await assertTxSuccess(client, result.digest, {
        showObjectChanges: true,
      });

      let passId: string | null = null;
      const created = detail.objectChanges?.find(
        (c) =>
          typeof c === "object" &&
          c !== null &&
          "type" in c &&
          (c as { type: string }).type === "created" &&
          "objectType" in c &&
          typeof (c as { objectType?: string }).objectType === "string" &&
          (c as { objectType: string }).objectType.endsWith("::pool::Pass"),
      ) as { objectId?: string } | undefined;
      if (created?.objectId) {
        passId = String(created.objectId);
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: mintCountsKey(poolId) }),
        qc.invalidateQueries({ queryKey: poolStateKey(poolId) }),
        qc.invalidateQueries({ queryKey: MY_PASSES_KEY(account.address) }),
      ]);
      // Refresh the Convex pool-state cache now so the pot updates immediately
      // instead of waiting for the 30s poller. Best-effort.
      if (convexConfigured) {
        void refreshPool({ poolObjectId: poolId }).catch(() => {});
      }

      setStatus({ kind: "success", digest: result.digest, passId });

      // Don't auto-redirect — the user can click the "View tx" link or
      // navigate to the pass on their own. Just let the modal sit on the
      // success state so they see confirmation.
      void router;
    } catch (e) {
      if (isUserRejection(e)) {
        setStatus({ kind: "idle" });
        return;
      }
      const message = describeTxError(e) ?? "Mint failed.";
      setStatus({ kind: "error", message });
    }
  };

  if (!account) {
    return (
      <Button variant="outline" size="md" disabled>
        Connect wallet to mint
      </Button>
    );
  }

  if (existingPass) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Link href={`/pass/${existingPass.id}`}>
          <Button variant="outline" size="md">
            You already own this · View pass
          </Button>
        </Link>
        <span className="text-utility text-zinc-500 max-w-xs text-right">
          One pass per player per wallet
        </span>
      </div>
    );
  }

  if (pool && !phaseIsOpen) {
    const phaseLabel =
      pool.phase === 1
        ? "Pool is locked"
        : pool.phase === 2
          ? "Pool already settled"
          : "Pool closed";
    return (
      <div className="flex flex-col items-end gap-2">
        <Button variant="outline" size="md" disabled>
          {phaseLabel}
        </Button>
        <span className="text-utility text-zinc-500 max-w-xs text-right">
          Minting is closed until a new pool opens
        </span>
      </div>
    );
  }

  if (status.kind === "signing") {
    return (
      <Button variant="hazard" size="md" disabled bullet>
        <Loader2 className="size-4 animate-spin" /> Minting…
      </Button>
    );
  }

  if (status.kind === "success") {
    return (
      <a
        href={suiscanTx(status.digest)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="hazard" size="md">
          Minted · View tx <ArrowUpRight className="size-4" />
        </Button>
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="hazard" size="md" onClick={handleMint} bullet>
        Mint Pass · {entryFeeLabel}
      </Button>
      {status.kind === "error" && (
        <span className="text-xs text-red-400 max-w-xs text-right break-words">
          {status.message}
        </span>
      )}
    </div>
  );
}
