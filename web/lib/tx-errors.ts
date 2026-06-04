/**
 * Shared helpers for handling Sui transaction failures + wallet rejections
 * across mint / settle / cashout / close paths.
 *
 * Two separable concerns:
 *   1. "User clicked Cancel in the wallet popup" — should be a silent dismiss,
 *      not a screaming red error.
 *   2. "Wallet signed and submitted, but the tx aborted on-chain" — wallet
 *      reports success, but `effects.status` is "failure". We must check.
 */

import type { SuiClient } from "@mysten/sui/client";

/**
 * Detect the various ways "the user canceled" surfaces across wallets. Slush,
 * Suiet, Surf, Phantom-on-Sui — each uses slightly different wording. We
 * union-match on the common shapes.
 */
export function isUserRejection(e: unknown): boolean {
  if (!e) return false;
  // dapp-kit sometimes wraps the wallet error in a generic mutation error;
  // both the wrapper and the inner have a message.
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  // Common patterns across wallets:
  return (
    msg.includes("user reject") ||
    msg.includes("user denied") ||
    msg.includes("user cancel") ||
    msg.includes("user dismissed") ||
    msg.includes("rejected by user") ||
    msg.includes("rejected the request") ||
    msg.includes("transaction rejected") ||
    msg.includes("request rejected") ||
    msg.includes("denied transaction") ||
    msg.includes("user closed") ||
    msg.includes("modal closed")
  );
}

export class TxFailedOnChainError extends Error {
  constructor(
    message: string,
    public readonly digest: string,
    public readonly chainError?: string,
  ) {
    super(message);
    this.name = "TxFailedOnChainError";
  }
}

interface TxStatus {
  status?: "success" | "failure" | string;
  error?: string;
}

interface TxBlockResponse {
  effects?: { status?: TxStatus } | null;
  objectChanges?: unknown[];
}

/**
 * After waiting for a tx digest, confirm the on-chain execution actually
 * succeeded — wallet `signAndExecute` returns a digest the moment the network
 * accepts the bytes, NOT when execution succeeds. A tx that aborts (move
 * assertion, insufficient gas, etc.) still has a digest with effects.status
 * = "failure".
 *
 * Throws TxFailedOnChainError if status is anything other than "success".
 * Also returns the response so callers can pluck objectChanges from it.
 */
export async function assertTxSuccess(
  client: SuiClient,
  digest: string,
  options: { showObjectChanges?: boolean } = {},
): Promise<TxBlockResponse> {
  const detail = (await client.getTransactionBlock({
    digest,
    options: {
      showEffects: true,
      showObjectChanges: options.showObjectChanges ?? false,
    },
  })) as TxBlockResponse;

  const status = detail.effects?.status?.status;
  if (status !== "success") {
    const err = detail.effects?.status?.error ?? "Unknown chain error";
    throw new TxFailedOnChainError(`On-chain execution failed: ${err}`, digest, err);
  }
  return detail;
}

/**
 * Convenience: turn a thrown error into a user-facing string. Returns null
 * for rejections (so callers can render nothing rather than a hard error).
 */
export function describeTxError(e: unknown): string | null {
  if (isUserRejection(e)) return null;
  if (e instanceof TxFailedOnChainError) {
    // The raw chain error is often noisy (full Move abort code). Surface the
    // friendliest bits.
    const raw = e.chainError ?? e.message;
    return prettifyChainError(raw);
  }
  if (e instanceof Error) return prettifyChainError(e.message);
  return prettifyChainError(String(e));
}

function prettifyChainError(raw: string): string {
  // Common chain error patterns we can humanize.
  if (/InsufficientGas|GasBalance|InsufficientBalance|insufficient.*coin/i.test(raw)) {
    return "Not enough SUI in your wallet to cover the entry fee + gas. Top up and try again.";
  }
  if (/EWrongPhase/i.test(raw)) {
    return "Pool isn't open for that action. Try refreshing — its phase may have changed.";
  }
  if (/EEntryFeeMismatch/i.test(raw)) {
    return "Entry fee doesn't match what the pool expects.";
  }
  if (/ENotAdmin/i.test(raw)) {
    return "This action is admin-only and your wallet isn't the pool admin.";
  }
  if (/EPassDead/i.test(raw)) {
    return "This pass was eliminated and can't be cashed out.";
  }
  if (/EWrongPool/i.test(raw)) {
    return "This pass belongs to a different pool.";
  }
  // Default: trim the worst of the noise.
  return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
}
