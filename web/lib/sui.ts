export const PACKAGE_ID = process.env.NEXT_PUBLIC_GAUNTLET_PACKAGE_ID ?? "0x0";
export const POOL_OBJECT_ID = process.env.NEXT_PUBLIC_POOL_OBJECT_ID ?? "0x0";
export const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? "0x0";
export const ROSTER_BLOB_ID = process.env.NEXT_PUBLIC_ROSTER_BLOB_ID ?? "";
export const MATCHDAY_BLOB_ID = process.env.NEXT_PUBLIC_MATCHDAY_BLOB_ID ?? "";

export const CLOCK_ID = "0x6";
export const ENTRY_FEE_MIST = 100_000_000n; // 0.1 SUI

export const SUISCAN_BASE = "https://suiscan.xyz/testnet";

export function suiscanTx(digest: string) {
  return `${SUISCAN_BASE}/tx/${digest}`;
}

export function suiscanObject(objectId: string) {
  return `${SUISCAN_BASE}/object/${objectId}`;
}

export function shortAddress(addr: string, prefix = 4, suffix = 4) {
  if (!addr || addr.length < prefix + suffix + 2) return addr;
  return `${addr.slice(0, prefix + 2)}…${addr.slice(-suffix)}`;
}

export function formatSui(mist: bigint | number, decimals = 2): string {
  const n = typeof mist === "bigint" ? Number(mist) : mist;
  return (n / 1e9).toFixed(decimals);
}
