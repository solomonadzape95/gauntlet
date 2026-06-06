# Gauntlet — demo video script (~2.5 min)

A simple outline: **bold = say it**, _italic = do/show it_, ✂️ = skip / don't
mention. Keep it tight; the product sells itself once they see a pass survive.

## Before you hit record (setup, off-camera)
- Wallet connected + funded with a little mainnet SUI.
- A **live pool already has 2–3 passes minted** so the pot isn't empty and the
  leaderboard looks alive. (Mint from a second wallet or earlier.)
- In the admin Autonomous-loop panel, set the **lock delay short (e.g. 20–30s)**
  so the loop resolves on camera without dead air.
- Have the pool's **live page** and one **Suiscan** tab ready.

---

## 1. Hook (15s)
- **"Gauntlet is a last-player-standing pool for football. You back one player to
  hit a target this matchday — if they do, you survive and split the pot."**
- _Landing page on screen._ Scroll once past the hero.
- ✂️ Don't read the FAQ aloud or explain the tech stack yet.

## 2. How it works (20s)
- _Scroll to the "Four moves" section._
- **"Pick a player, stake 0.1 SUI, the match decides who survived, winners take
  a weighted cut of the pot."**
- **"An AI Game Master sets each player's target before kickoff — harder targets
  pay more."**
- ✂️ Skip the per-step detail; the live demo shows it.

## 3. Pick + mint (35s)
- _Go to Pools → enter the live pool → open a player card._
- **"Every player has one target — score, assist, clean sheet — and a survival
  likelihood."** _(point at the jersey card + target + %.)_
- _Click Mint, approve in the wallet._
- **"That's a Survival Pass NFT, on Sui mainnet. My stake just joined the pot."**
- ✂️ Don't wait on the wallet popup silently — talk over it. Don't show gas math.

## 4. The live pool (30s)
- _Live page._ **"Here's the pool live — the pot, who everyone's backing, and
  each pick's payout if they survive."**
- _Point at the AUTO banner._ **"It runs itself: it locks a bit after the last
  entry, plays the match, then settles — you can see the countdown right here."**
- _(Optional) open Compare players for one beat._
- ✂️ Skip explaining the 30s cron / Convex / how the timer is computed.

## 5. Watch it resolve (30s) — the money shot
- _Let the loop run: lock → the match sim animates → settle._
- **"The match just played out. Survivors are locked in, eliminated stakes roll
  to the winners, and payouts are weighted by how unlikely each pick was."**
- _Point at a survivor's "your share."_

## 6. Withdraw (20s)
- _As a winning wallet, hit the single Withdraw button → approve._
- **"One click cashes out every winning pass. Real SUI, straight to the wallet —
  we take 10%."**
- _(Optional) show the SUI arrive / the Suiscan tx._

## 7. Trust + close (20s)
- **"Everything's on-chain: the pot lives in the contract, no admin can drain
  it, and you can verify every pool on Suiscan."** _(flash the Suiscan object.)_
- **"Built on Sui and Walrus. Autonomous, real-money, and it runs forever — when
  one matchday settles, the next one opens automatically."**
- _End on the landing page or a settled pool._

---

## What to SKIP entirely
- ✂️ Deployment, env vars, Convex, Vercel, the RPC/429 saga, testnet-vs-mainnet,
  publishing the contract — none of it belongs in the pitch.
- ✂️ Admin internals beyond a 3-second glance (if you show admin at all, show the
  **revenue counter** and the **Stop loop** button, nothing more).
- ✂️ Code, schemas, transaction internals.
- ✂️ Long waits — if the loop is mid-countdown, cut/scrub to the resolve.

## If you have 30 extra seconds (optional admin beat)
- _Admin dashboard:_ **"Operator side: live revenue from the 10% fee, and a
  one-switch autonomous loop with a stop button."**
- _Show the step countdown ticking + the Stop loop button._

## One-liners you can reuse
- **"Back a baller, beat the odds, split the pot."**
- **"AI sets the targets. The chain settles the bets."**
- **"Survive the matchday, take your cut."**
