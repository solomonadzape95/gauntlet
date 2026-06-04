import { notFound } from "next/navigation";

import { getPoolFromConvex } from "@/lib/pools-server";
import { LiveClient } from "./live-client";

export default async function PoolLivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pool = await getPoolFromConvex(slug);
  if (!pool) notFound();

  return <LiveClient pool={pool} />;
}
