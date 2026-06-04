"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { ArrowUpRight, Loader2 } from "lucide-react";

import type { Player } from "@/lib/types";
import {
  PACKAGE_ID,
  formatSui,
  shortAddress,
  suiscanTx,
  suiscanObject,
} from "@/lib/sui";
import {
  usePoolState,
  PHASE_LABEL,
  PHASE_DOT,
  poolStateKey,
  type PoolState,
} from "@/lib/hooks/use-pool-state";
import { mintCountsKey } from "@/lib/hooks/use-mint-counts";
import { usePass, PASS_KEY, type PassObject } from "@/lib/hooks/use-pass";

import { TopBar } from "@/components/site/top-bar";
import { CornerFrame } from "@/components/ui/corner-frame";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/icons/country-flag";
import { Crest } from "@/components/icons/crest";
import { PositionBadge } from "@/components/icons/position-badge";
import { playerColors } from "@/lib/team-colors";
import {
  JerseySurface,
  JERSEY_NUMBER_SHADOW,
} from "@/components/jersey/jersey-surface";
import { targetIcons } from "@/lib/target-icons";
import { assertTxSuccess, describeTxError, isUserRejection } from "@/lib/tx-errors";
import { cn } from "@/lib/cn";

type PassStatus = "alive" | "eliminated" | "waiting" | "closed";

export function PassDetail({
  passId,
  players,
}: {
  passId: string;
  players: Player[];
}) {
  const account = useCurrentAccount();
  const { data: pass, isLoading: passLoading } = usePass(passId);
  // Pool state must come from the pass's OWN pool_id (set when it was
  // minted) — NOT the env-default singleton. After a fresh pool spawn,
  // env still points at the old pool, but this pass belongs to whichever
  // pool minted it.
  const poolIdForPass = pass?.pool_id ?? "0x0";
  const { data: pool, isLoading: poolLoading } = usePoolState(poolIdForPass);

  if (passLoading || poolLoading) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <Loader2 className="size-6 mx-auto animate-spin text-zinc-600" />
          <p className="mt-4 text-utility text-zinc-500">Loading pass…</p>
        </div>
      </main>
    );
  }

  if (!pass) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-display-md">Pass not found</h1>
          <p className="mt-4 text-zinc-400">
            This Survival Pass may have been cashed out (and burned), or the ID is wrong.
          </p>
          <p className="mt-3 font-mono text-xs text-zinc-600">
            {shortAddress(passId, 8, 8)}
          </p>
          <a
            href={suiscanObject(passId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1 text-utility text-zinc-500 hover:text-hazard"
          >
            View on Suiscan <ArrowUpRight className="size-3" />
          </a>
        </div>
      </main>
    );
  }

  if (!pool) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-display-md">Pool unavailable</h1>
        </div>
      </main>
    );
  }

  // Note: we used to bail here if pass.pool_id !== env POOL_OBJECT_ID.
  // That gate is gone — the pool state above is now sourced from the pass's
  // own pool_id, so any pass minted against any pool renders correctly.

  const player = players.find((p) => p.id === pass.player_id);
  if (!player) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-display-md">Unknown player</h1>
          <p className="mt-4 text-zinc-400">
            Player ID {pass.player_id} is not in the current roster.
          </p>
        </div>
      </main>
    );
  }

  const isOwner = account?.address === pass.owner;
  const isEliminated = pool.eliminated_players.includes(pass.player_id);
  const status: PassStatus =
    pool.phase === 0 || pool.phase === 1
      ? "waiting"
      : pool.phase === 2 && isEliminated
        ? "eliminated"
        : pool.phase === 2
          ? "alive"
          : "closed";

  return (
    <main className="min-h-screen">
      <TopBar />

      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-14">
          <div className="text-utility text-zinc-500 mb-6 inline-flex items-center gap-3">
            <span>Survival Pass · #{String(player.id).padStart(2, "0")}</span>
            <span className="h-3 w-px bg-zinc-800" />
            <span className={statusToneText(status)}>
              {statusLabelText(status)}
            </span>
          </div>

          {/* Fabric-textured banner. */}
          {(() => {
            const colors = playerColors(player);
            return (
              <JerseySurface
                colors={colors}
                className="relative w-full aspect-[5/3] md:aspect-[16/9] rounded-2xl mb-10 flex items-center justify-center"
              >
                {player.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.image}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover object-top"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <span
                  aria-hidden
                  className="relative z-10 leading-none select-none"
                  style={{
                    fontFamily: "var(--font-xirod)",
                    fontSize: "clamp(8rem, 18vw, 14rem)",
                    color: colors.secondary,
                    letterSpacing: "0.02em",
                    ...JERSEY_NUMBER_SHADOW,
                  }}
                >
                  {player.number ?? 0}
                </span>
              </JerseySurface>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16">
            {/* Left — player info */}
            <div className="lg:col-span-3">
              <div className="text-utility text-zinc-500 mb-2">
                Pass tied to
              </div>
              <h1 className="text-display-lg leading-none">{player.name}</h1>

              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <span className="text-utility uppercase tracking-[0.16em] text-zinc-300">
                  {player.team}
                </span>
                <CountryFlag
                  country={player.country ?? player.team}
                  width={32}
                />
                <Crest club={player.club} size={32} />
                <PositionBadge position={player.position} size="md" />
              </div>

              <div className="mt-10">
                <div className="text-utility text-zinc-500 mb-3">Target</div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-hazard">
                    {targetIcons(player.target.metric).map((Icon, i) => (
                      <Icon key={i} size={22} />
                    ))}
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-hazard">
                    {player.target.human}
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-zinc-900 grid grid-cols-2 gap-6 max-w-md">
                <Meta label="Pass ID">
                  <a
                    href={suiscanObject(passId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-zinc-300 hover:text-hazard inline-flex items-center gap-1"
                  >
                    {shortAddress(passId, 6, 4)}
                    <ArrowUpRight className="size-3" />
                  </a>
                </Meta>
                <Meta label="Owner">
                  <span className="font-mono text-sm text-zinc-300">
                    {shortAddress(pass.owner, 6, 4)}
                  </span>
                </Meta>
              </div>
            </div>

            {/* Right — status panel */}
            <div className="lg:col-span-2">
              <StatusPanel
                status={status}
                pool={pool}
                pass={pass}
                passId={passId}
                player={player}
                isOwner={isOwner}
              />
            </div>
          </div>
        </section>
      </CornerFrame>
    </main>
  );
}

function statusLabelText(status: PassStatus): string {
  return {
    alive: "Through",
    eliminated: "Out",
    waiting: "Kickoff pending",
    closed: "Pool closed",
  }[status];
}

function statusToneText(status: PassStatus): string {
  return {
    alive: "text-hazard",
    eliminated: "text-zinc-500",
    waiting: "text-zinc-300",
    closed: "text-zinc-600",
  }[status];
}

function StatusPanel({
  status,
  pool,
  pass,
  passId,
  player,
  isOwner,
}: {
  status: PassStatus;
  pool: PoolState;
  pass: PassObject;
  passId: string;
  player: Player;
  isOwner: boolean;
}) {
  const poolIdForPass = pass.pool_id;
  let estimatedPayout = 0n;
  if (status === "alive" && pool.alive_count > 0) {
    estimatedPayout = pool.pot_mist / BigInt(pool.alive_count);
  }

  if (status === "waiting") {
    return (
      <Card>
        <div className="text-utility text-zinc-500 mb-2">Pool status</div>
        <h2 className="text-2xl font-semibold">Kickoff pending</h2>
        <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
          Your pass is registered. Wait for the admin to advance the matchday
          and settle the pool — then you&apos;ll see whether {player.name.split(" ")[0]} hit the target.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Stat label="Pot" value={formatSui(pool.pot_mist)} unit="SUI" />
          <Stat
            label="Phase"
            value={PHASE_LABEL[pool.phase] ?? "—"}
          />
        </div>
      </Card>
    );
  }

  if (status === "eliminated") {
    return (
      <Card>
        <div className="text-utility text-zinc-500 mb-2">Outcome</div>
        <h2 className="text-2xl font-semibold text-zinc-200">Out</h2>
        <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
          {player.name} didn&apos;t hit the target. Your stake stays in the pot
          for the survivors.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Stat label="Pot" value={formatSui(pool.pot_mist)} unit="SUI" />
          <Stat label="Survivors" value={String(pool.alive_count)} />
        </div>
      </Card>
    );
  }

  if (status === "alive") {
    return (
      <CashoutPanel
        passId={passId}
        poolId={poolIdForPass}
        playerName={player.name}
        pool={pool}
        estimatedPayout={estimatedPayout}
        isOwner={isOwner}
      />
    );
  }

  return (
    <Card>
      <div className="text-utility text-zinc-500 mb-2">Pool closed</div>
      <p className="mt-2 text-sm text-zinc-400">No further actions.</p>
    </Card>
  );
}

function CashoutPanel({
  passId,
  poolId,
  playerName,
  pool,
  estimatedPayout,
  isOwner,
}: {
  passId: string;
  poolId: string;
  playerName: string;
  pool: PoolState;
  estimatedPayout: bigint;
  isOwner: boolean;
}) {
  const client = useSuiClient();
  const qc = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [phase, setPhase] = useState<"idle" | "signing" | "success" | "error">(
    "idle",
  );
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCashout = async () => {
    try {
      setPhase("signing");
      setError(null);

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::pool::cashout`,
        arguments: [
          tx.object(poolId),
          tx.object(passId),
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      await assertTxSuccess(client, result.digest);

      await Promise.all([
        qc.invalidateQueries({ queryKey: PASS_KEY(passId) }),
        qc.invalidateQueries({ queryKey: poolStateKey(poolId) }),
        qc.invalidateQueries({ queryKey: mintCountsKey(poolId) }),
      ]);

      setPhase("success");
      setDigest(result.digest);
    } catch (e) {
      if (isUserRejection(e)) {
        setPhase("idle"); // user cancelled — back to ready state, no error
        return;
      }
      setPhase("error");
      setError(describeTxError(e) ?? "Cashout failed.");
    }
  };

  if (phase === "success" && digest) {
    return (
      <Card variant="hazard">
        <div className="text-utility text-hazard mb-2">✓ Cashed out</div>
        <h2 className="text-2xl md:text-3xl font-semibold">
          {formatSui(estimatedPayout)} SUI landed in your wallet
        </h2>
        <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
          {playerName} hit the target. Your stake plus a share of the eliminated stakes were transferred to your wallet.
        </p>
        <div className="mt-6">
          <a href={suiscanTx(digest)} target="_blank" rel="noopener noreferrer">
            <Button variant="hazard" size="lg" bullet>
              View transaction <ArrowUpRight className="size-4" />
            </Button>
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="hazard">
      <div className="text-utility text-hazard mb-2">✓ Survived</div>
      <h2 className="text-2xl md:text-3xl font-semibold">
        {playerName} hit the target
      </h2>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat
          label="Your payout"
          value={formatSui(estimatedPayout)}
          unit="SUI"
          accent
        />
        <Stat label="Survivors" value={String(pool.alive_count)} />
        <Stat label="Pot" value={formatSui(pool.pot_mist)} unit="SUI" />
      </div>

      {!isOwner ? (
        <p className="mt-6 text-sm text-zinc-400">
          Only the pass owner can cash out. Connect that wallet (
          <span className="font-mono">{shortAddress("0x0...")}</span>) to claim.
        </p>
      ) : (
        <div className="mt-6">
          <Button
            variant="hazard"
            size="lg"
            bullet
            onClick={handleCashout}
            disabled={phase === "signing"}
          >
            {phase === "signing" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Cashing out…
              </>
            ) : (
              <>Cash out {formatSui(estimatedPayout)} SUI</>
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-red-400 break-words">{error}</div>
      )}
    </Card>
  );
}

function Card({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "hazard";
}) {
  return (
    <div
      className={cn(
        "border p-6 md:p-8",
        variant === "default" && "border-zinc-900",
        variant === "hazard" && "border-hazard ring-1 ring-hazard bg-hazard/[0.03]",
      )}
    >
      {children}
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-utility text-zinc-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-utility text-zinc-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono tabular text-2xl md:text-3xl font-medium leading-none",
            accent ? "text-hazard" : "text-zinc-100",
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
