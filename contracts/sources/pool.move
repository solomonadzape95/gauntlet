#[allow(lint(self_transfer))]
module gauntlet::pool;

// === Invariant ===
// The Pool's `pot` balance decrements via exactly two paths:
//   1. `settle_pool` skims a fixed platform fee (`fee_bps`, e.g. 10%) to the
//      pre-declared `treasury` address. This is the ONLY admin-side payout and
//      it is bounded by `fee_bps` (asserted <= BPS_DENOM at creation).
//   2. `cashout`, which requires ownership of a valid (non-eliminated) Pass for
//      this exact pool and pays a likelihood-weighted share of the post-fee pot.
// No other entry function may transfer from `pot`. `lock_pool` is state-only.
//
// === Weighting ===
// Each player carries a `weight` (set once, at pool creation, from the roster —
// minters cannot forge it). A survivor's payout is
//   net_pot * pass.weight / surviving_weight
// where `net_pot` is the post-fee pot snapshot taken at settle and
// `surviving_weight` is the summed weight of every pass that wasn't eliminated.
// Rarer survivals carry a higher weight, so they earn a larger slice.

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use sui::vec_map::{Self, VecMap};

// === Errors ===
const EWrongPhase: u64 = 0;
const ENotAdmin: u64 = 1;
const EEntryFeeMismatch: u64 = 2;
const EPassDead: u64 = 3;
const EWrongPool: u64 = 4;
const EUnknownPlayer: u64 = 5;
const EBadWeights: u64 = 6;
const EFeeTooHigh: u64 = 7;

// === Phases ===
const PHASE_OPEN: u8 = 0;
const PHASE_LOCKED: u8 = 1;
const PHASE_SETTLED: u8 = 2;
const PHASE_CLOSED: u8 = 3;

// === Fee ===
const BPS_DENOM: u64 = 10000;
/// Platform fee, in basis points. 1000 = 10%.
const FEE_BPS: u64 = 1000;

// === Objects ===

public struct Pool has key {
    id: UID,
    admin: address,
    /// Receives the platform fee skimmed at settle.
    treasury: address,
    /// Platform fee in basis points (1000 = 10%).
    fee_bps: u64,
    entry_fee_mist: u64,
    pot: Balance<SUI>,
    total_passes: u64,
    alive_count: u64,
    phase: u8,
    roster_blob_id: vector<u8>,
    matchday_blob_id: vector<u8>,
    eliminated_players: vector<u32>,
    /// player_id -> per-pass weight, fixed at creation from the roster.
    player_weight: VecMap<u32, u64>,
    /// player_id -> summed weight of every pass minted on that player.
    weight_by_player: VecMap<u32, u64>,
    /// Sum of every minted pass's weight.
    total_weight: u64,
    /// Summed weight of surviving passes — set at settle, the payout denominator.
    surviving_weight: u64,
    /// Post-fee pot snapshot taken at settle — the payout numerator base.
    net_pot_mist: u64,
}

public struct Pass has key, store {
    id: UID,
    pool_id: ID,
    player_id: u32,
    /// Share weight copied from the pool's player_weight at mint time.
    weight: u64,
    minted_at_ms: u64,
}

// === Events ===

public struct PoolCreated has copy, drop {
    pool_id: ID,
    admin: address,
    treasury: address,
    fee_bps: u64,
    entry_fee_mist: u64,
    roster_blob_id: vector<u8>,
}

public struct PassMinted has copy, drop {
    pool_id: ID,
    pass_id: ID,
    owner: address,
    player_id: u32,
    weight: u64,
}

public struct PoolLocked has copy, drop {
    pool_id: ID,
    total_passes: u64,
    pot_mist: u64,
}

public struct PoolSettled has copy, drop {
    pool_id: ID,
    matchday_blob_id: vector<u8>,
    eliminated_player_ids: vector<u32>,
    alive_count: u64,
    pot_mist: u64,
    net_pot_mist: u64,
    fee_mist: u64,
    surviving_weight: u64,
}

public struct PassCashedOut has copy, drop {
    pool_id: ID,
    pass_id: ID,
    owner: address,
    payout_mist: u64,
}

public struct PoolClosed has copy, drop {
    pool_id: ID,
    leftover_mist: u64,
}

// === Entry functions ===

/// Create a pool. `player_ids` and `player_weights` are parallel arrays giving
/// the per-pass share weight for every roster player; minters look these up by
/// id, so weights are admin-set and cannot be forged at mint time.
public fun create_pool(
    entry_fee_mist: u64,
    roster_blob_id: vector<u8>,
    treasury: address,
    player_ids: vector<u32>,
    player_weights: vector<u64>,
    ctx: &mut TxContext,
) {
    assert!(FEE_BPS <= BPS_DENOM, EFeeTooHigh);
    let n = vector::length(&player_ids);
    assert!(n == vector::length(&player_weights), EBadWeights);

    let mut player_weight = vec_map::empty<u32, u64>();
    let mut i = 0;
    while (i < n) {
        let pid = *vector::borrow(&player_ids, i);
        let w = *vector::borrow(&player_weights, i);
        // First weight wins on duplicate ids; ignore repeats so the roster
        // can't be poisoned by a trailing dupe.
        if (!vec_map::contains(&player_weight, &pid)) {
            vec_map::insert(&mut player_weight, pid, w);
        };
        i = i + 1;
    };

    let pool = Pool {
        id: object::new(ctx),
        admin: ctx.sender(),
        treasury,
        fee_bps: FEE_BPS,
        entry_fee_mist,
        pot: balance::zero(),
        total_passes: 0,
        alive_count: 0,
        phase: PHASE_OPEN,
        roster_blob_id,
        matchday_blob_id: vector[],
        eliminated_players: vector[],
        player_weight,
        weight_by_player: vec_map::empty<u32, u64>(),
        total_weight: 0,
        surviving_weight: 0,
        net_pot_mist: 0,
    };
    event::emit(PoolCreated {
        pool_id: object::id(&pool),
        admin: pool.admin,
        treasury: pool.treasury,
        fee_bps: pool.fee_bps,
        entry_fee_mist,
        roster_blob_id: pool.roster_blob_id,
    });
    transfer::share_object(pool);
}

public fun mint_pass(
    pool: &mut Pool,
    player_id: u32,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(pool.phase == PHASE_OPEN, EWrongPhase);
    assert!(coin::value(&payment) == pool.entry_fee_mist, EEntryFeeMismatch);
    assert!(vec_map::contains(&pool.player_weight, &player_id), EUnknownPlayer);

    let weight = *vec_map::get(&pool.player_weight, &player_id);

    balance::join(&mut pool.pot, coin::into_balance(payment));
    pool.total_passes = pool.total_passes + 1;
    pool.alive_count = pool.alive_count + 1;
    pool.total_weight = pool.total_weight + weight;
    if (vec_map::contains(&pool.weight_by_player, &player_id)) {
        let cur = vec_map::get_mut(&mut pool.weight_by_player, &player_id);
        *cur = *cur + weight;
    } else {
        vec_map::insert(&mut pool.weight_by_player, player_id, weight);
    };

    let pass = Pass {
        id: object::new(ctx),
        pool_id: object::id(pool),
        player_id,
        weight,
        minted_at_ms: clock::timestamp_ms(clock),
    };

    event::emit(PassMinted {
        pool_id: object::id(pool),
        pass_id: object::id(&pass),
        owner: ctx.sender(),
        player_id,
        weight,
    });

    transfer::transfer(pass, ctx.sender());
}

public fun lock_pool(pool: &mut Pool, ctx: &TxContext) {
    assert!(ctx.sender() == pool.admin, ENotAdmin);
    assert!(pool.phase == PHASE_OPEN, EWrongPhase);
    pool.phase = PHASE_LOCKED;
    event::emit(PoolLocked {
        pool_id: object::id(pool),
        total_passes: pool.total_passes,
        pot_mist: balance::value(&pool.pot),
    });
}

public fun settle_pool(
    pool: &mut Pool,
    matchday_blob_id: vector<u8>,
    eliminated_player_ids: vector<u32>,
    survivors_count: u64,
    ctx: &mut TxContext,
) {
    assert!(ctx.sender() == pool.admin, ENotAdmin);
    assert!(pool.phase == PHASE_LOCKED, EWrongPhase);

    // Sum the weight of every eliminated pass BEFORE the vector is moved into
    // the pool, so surviving_weight = total_weight - eliminated_weight.
    let mut eliminated_weight = 0;
    let n = vector::length(&eliminated_player_ids);
    let mut i = 0;
    while (i < n) {
        let pid = *vector::borrow(&eliminated_player_ids, i);
        if (vec_map::contains(&pool.weight_by_player, &pid)) {
            eliminated_weight =
                eliminated_weight + *vec_map::get(&pool.weight_by_player, &pid);
        };
        i = i + 1;
    };
    pool.surviving_weight = if (pool.total_weight >= eliminated_weight) {
        pool.total_weight - eliminated_weight
    } else {
        0
    };

    // Skim the platform fee to the treasury, then snapshot the net pot that
    // survivors share.
    let pot_val = balance::value(&pool.pot);
    let fee = pot_val * pool.fee_bps / BPS_DENOM;
    if (fee > 0) {
        let fee_balance = balance::split(&mut pool.pot, fee);
        let fee_coin = coin::from_balance(fee_balance, ctx);
        transfer::public_transfer(fee_coin, pool.treasury);
    };
    pool.net_pot_mist = balance::value(&pool.pot);

    pool.matchday_blob_id = matchday_blob_id;
    pool.eliminated_players = eliminated_player_ids;
    pool.alive_count = survivors_count;
    pool.phase = PHASE_SETTLED;

    event::emit(PoolSettled {
        pool_id: object::id(pool),
        matchday_blob_id: pool.matchday_blob_id,
        eliminated_player_ids: pool.eliminated_players,
        alive_count: pool.alive_count,
        pot_mist: pot_val,
        net_pot_mist: pool.net_pot_mist,
        fee_mist: fee,
        surviving_weight: pool.surviving_weight,
    });
}

public fun cashout(
    pool: &mut Pool,
    pass: Pass,
    ctx: &mut TxContext,
) {
    assert!(pool.phase == PHASE_SETTLED, EWrongPhase);
    assert!(object::id(pool) == pass.pool_id, EWrongPool);
    assert!(!vector::contains(&pool.eliminated_players, &pass.player_id), EPassDead);

    // Weighted share of the post-fee pot. net_pot_mist and surviving_weight are
    // both fixed at settle, so each pass's payout is independent of cashout
    // order and the shares sum to net_pot_mist (modulo integer dust).
    let payout = if (pool.surviving_weight == 0) {
        0
    } else {
        let raw =
            (pool.net_pot_mist as u128) * (pass.weight as u128)
                / (pool.surviving_weight as u128);
        raw as u64
    };
    // Never attempt to split more than the pot holds (guards the final dust).
    let available = balance::value(&pool.pot);
    let payout = if (payout > available) { available } else { payout };

    pool.alive_count = pool.alive_count - 1;

    let payout_balance = balance::split(&mut pool.pot, payout);
    let payout_coin = coin::from_balance(payout_balance, ctx);

    event::emit(PassCashedOut {
        pool_id: object::id(pool),
        pass_id: object::id(&pass),
        owner: ctx.sender(),
        payout_mist: payout,
    });

    transfer::public_transfer(payout_coin, ctx.sender());

    let Pass { id, pool_id: _, player_id: _, weight: _, minted_at_ms: _ } = pass;
    object::delete(id);
}

public fun close_pool(pool: &mut Pool, ctx: &mut TxContext) {
    assert!(ctx.sender() == pool.admin, ENotAdmin);
    assert!(pool.phase == PHASE_SETTLED, EWrongPhase);
    pool.phase = PHASE_CLOSED;

    // Sweep any leftover dust (rounding remainder from weighted cashouts, or
    // unclaimed survivor shares) to the treasury so nothing is stranded in the
    // shared object forever.
    let leftover = balance::value(&pool.pot);
    if (leftover > 0) {
        let dust = balance::split(&mut pool.pot, leftover);
        transfer::public_transfer(coin::from_balance(dust, ctx), pool.treasury);
    };

    event::emit(PoolClosed {
        pool_id: object::id(pool),
        leftover_mist: leftover,
    });
}

// === Views ===

public fun admin(p: &Pool): address { p.admin }
public fun treasury(p: &Pool): address { p.treasury }
public fun fee_bps(p: &Pool): u64 { p.fee_bps }
public fun phase(p: &Pool): u8 { p.phase }
public fun entry_fee_mist(p: &Pool): u64 { p.entry_fee_mist }
public fun pot_value(p: &Pool): u64 { balance::value(&p.pot) }
public fun total_passes(p: &Pool): u64 { p.total_passes }
public fun alive_count(p: &Pool): u64 { p.alive_count }
public fun total_weight(p: &Pool): u64 { p.total_weight }
public fun surviving_weight(p: &Pool): u64 { p.surviving_weight }
public fun net_pot_mist(p: &Pool): u64 { p.net_pot_mist }
public fun roster_blob_id(p: &Pool): &vector<u8> { &p.roster_blob_id }
public fun matchday_blob_id(p: &Pool): &vector<u8> { &p.matchday_blob_id }
public fun eliminated_players(p: &Pool): &vector<u32> { &p.eliminated_players }

public fun pass_pool_id(p: &Pass): ID { p.pool_id }
public fun pass_player_id(p: &Pass): u32 { p.player_id }
public fun pass_weight(p: &Pass): u64 { p.weight }
public fun pass_minted_at_ms(p: &Pass): u64 { p.minted_at_ms }
