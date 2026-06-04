import { fetchRoster } from "@/lib/walrus";
import { ROSTER_BLOB_ID } from "@/lib/sui";
import type { Player } from "@/lib/types";
import { PassDetail } from "./pass-detail";

export const revalidate = 300;

export default async function PassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let players: Player[] = [];
  try {
    if (ROSTER_BLOB_ID) {
      const roster = await fetchRoster(ROSTER_BLOB_ID);
      players = roster.players;
    }
  } catch (e) {
    console.error("Roster fetch failed:", e);
  }

  return <PassDetail passId={id} players={players} />;
}
