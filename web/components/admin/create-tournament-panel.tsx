"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { convexConfigured } from "@/lib/convex";

/**
 * Cover-image presets — the admin drops `*-edited.jpg` + `*-original.jpg` pairs
 * into `web/public/pools/` then adds the slug here. Hand-maintained for MVP
 * simplicity; can later become a server-scanned manifest.
 */
const COVER_PRESETS: Array<{ slug: string; label: string }> = [
  { slug: "last-eleven", label: "Last Eleven · Demo" },
  { slug: "genesis-wc", label: "Genesis · World Cup" },
  { slug: "epl-weekly", label: "Premier League · Weekly" },
  { slug: "laliga-weekly", label: "La Liga · Weekly" },
  { slug: "ucl-nights", label: "Champions League · Nights" },
  { slug: "create-pools", label: "Generic · Stadium" },
];

export function CreateTournamentPanel({
  onCreated,
}: {
  onCreated?: (slug: string) => void;
}) {
  const account = useCurrentAccount();
  const createTournament = useMutation(api.tournaments.create);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [tagline, setTagline] = useState("");
  const [coverSlug, setCoverSlug] = useState(COVER_PRESETS[0].slug);
  const [status, setStatus] = useState<"live" | "soon" | "done">("soon");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!convexConfigured) {
      setError(
        "Convex is not configured. Set NEXT_PUBLIC_CONVEX_URL and run `pnpm dlx convex dev`.",
      );
      return;
    }
    if (!slug.trim() || !name.trim()) {
      setError("Slug and name are required.");
      return;
    }
    try {
      setBusy(true);
      await createTournament({
        slug: slug.trim(),
        name: name.trim(),
        season: season.trim() || "Season ·",
        tagline: tagline.trim(),
        image: `/pools/${coverSlug}-edited.jpg`,
        imageOriginal: `/pools/${coverSlug}-original.jpg`,
        status,
        ownerAddress: account?.address,
      });
      setCreatedSlug(slug.trim());
      onCreated?.(slug.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-zinc-900 p-6 md:p-8">
      <div className="text-utility text-zinc-500 mb-2">Spawn tournament</div>
      <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
        Create a tournament
      </h2>
      <p className="mt-3 text-base text-zinc-300 max-w-xl leading-relaxed">
        Top-level container — WC 2026, EPL Weekly, La Liga, etc. Matchday pools
        are created inside, each one with its own Sui Pool object.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Slug (kebab-case)">
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="world-cup-2026"
            className="w-full bg-ink border border-zinc-800 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-hazard"
          />
        </Field>
        <Field label="Display name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="FIFA World Cup 2026"
            className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-base focus:outline-none focus:border-hazard"
          />
        </Field>
        <Field label="Season label">
          <input
            type="text"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="Season 0 · 2026"
            className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "live" | "soon" | "done")
            }
            className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard"
          >
            <option value="soon">Coming soon</option>
            <option value="live">Live</option>
            <option value="done">Done</option>
          </select>
        </Field>
        <Field label="Tagline / pitch" className="md:col-span-2">
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            rows={2}
            placeholder="One or two sentences shown on the pool card and detail page."
            className="w-full bg-ink border border-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-hazard resize-none"
          />
        </Field>
        <Field label="Cover image" className="md:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {COVER_PRESETS.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => setCoverSlug(p.slug)}
                className={
                  "relative border bg-ink overflow-hidden aspect-[16/9] transition-colors text-left " +
                  (coverSlug === p.slug
                    ? "border-hazard ring-1 ring-hazard"
                    : "border-zinc-800 hover:border-zinc-700")
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/pools/${p.slug}-edited.jpg`}
                  alt={p.label}
                  className="absolute inset-0 w-full h-full object-cover opacity-90"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
                <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-black/70 text-utility text-zinc-100 truncate">
                  {p.label}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-utility text-zinc-600">
            Drop new <code className="font-mono">/public/pools/[slug]-edited.jpg</code> +{" "}
            <code className="font-mono">[slug]-original.jpg</code> pairs and add
            the slug to <code className="font-mono">COVER_PRESETS</code> in this
            file to expand the picker.
          </p>
        </Field>
      </div>

      <div className="mt-6">
        <Button variant="hazard" onClick={handleCreate} disabled={busy} bullet>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create tournament"
          )}
        </Button>
      </div>

      {createdSlug && (
        <div className="mt-6 border border-hazard ring-1 ring-hazard bg-hazard/[0.04] p-4">
          <div className="text-utility text-hazard mb-2">
            ✓ Tournament created
          </div>
          <p className="text-base text-zinc-100">
            <code className="font-mono">{createdSlug}</code> is live in Convex.
            Add matchdays from its admin detail page.
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
