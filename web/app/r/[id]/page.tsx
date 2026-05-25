// Day 6: verifier page.
// Reads Sui object by `id` via Tatum Data API, fetches blob from Walrus,
// re-hashes client-side, renders snapshot + ✅/❌ badge.

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold">Receipt</h1>
      <p className="mt-4 text-zinc-400">Object ID: <span className="font-mono">{id}</span></p>
      <p className="mt-2 text-zinc-500">Not implemented yet — see PLAN.md Day 7–8.</p>
    </main>
  );
}
