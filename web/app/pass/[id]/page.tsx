// Day 3: pass detail page.
// Reads Pass object by `id` via Tatum Data API, shows player + target + status,
// and renders the Cashout CTA when phase=SETTLED and pass is alive.

export default async function PassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold">Survival Pass</h1>
      <p className="mt-4 text-zinc-400">Object ID: <span className="font-mono">{id}</span></p>
      <p className="mt-2 text-zinc-500">Not implemented yet — see PLAN.md Day 3.</p>
    </main>
  );
}
