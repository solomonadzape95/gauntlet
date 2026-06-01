module gauntlet::pool;

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;

// === Errors ===
const EWrongPhase: u64 = 0;
const ENotAdmin: u64 = 1;
const EEntryFeeMismatch: u64 = 2;
const EWindowClosed: u64 = 3;
const EPassDead: u64 = 4;
const EWrongPool: u64 = 5;

// === Phases ===
const PHASE_OPEN: u8 = 0;
const PHASE_LOCKED: u8 = 1;
const PHASE_SETTLED: u8 = 2;
const PHASE_CLOSED: u8 = 3;

// === Objects ===

public struct Pool has key {
    id: UID,
    admin: address,
    entry_fee_mist: u64,
    pot: Balance<SUI>,
    total_passes: u64,
    alive_count: u64,
    phase: u8,
    cashout_window_end_ms: u64,
    roster_blob_id: vector<u8>,
    matchday_blob_id: vector<u8>,
    eliminated_players: vector<u16>,
}

public struct Pass has key, store {
    id: UID,
    pool_id: ID,
    player_id: u16,
    minted_at_ms: u64,
}

// === Events ===

public struct PoolCreated has copy, drop {
    pool_id: ID,
    admin: address,
    entry_fee_mist: u64,
    roster_blob_id: vector<u8>,
}

public struct PassMinted has copy, drop {
    pool_id: ID,
    pass_id: ID,
    owner: address,
    player_id: u16,
}

public struct PoolLocked has copy, drop {
    pool_id: ID,
    total_passes: u64,
    pot_mist: u64,
}

public struct PoolSettled has copy, drop {
    pool_id: ID,
    matchday_blob_id: vector<u8>,
    eliminated_player_ids: vector<u16>,
    alive_count: u64,
    pot_mist: u64,
    cashout_window_end_ms: u64,
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

public entry fun create_pool(
    entry_fee_mist: u64,
    roster_blob_id: vector<u8>,
    ctx: &mut TxContext,
) {
    let pool = Pool {
        id: object::new(ctx),
        admin: ctx.sender(),
        entry_fee_mist,
        pot: balance::zero(),
        total_passes: 0,
        alive_count: 0,
        phase: PHASE_OPEN,
        cashout_window_end_ms: 0,
        roster_blob_id,
        matchday_blob_id: vector::empty(),
        eliminated_players: vector::empty(),
    };
    event::emit(PoolCreated {
        pool_id: object::id(&pool),
        admin: pool.admin,
        entry_fee_mist,
        roster_blob_id: pool.roster_blob_id,
    });
    transfer::share_object(pool);
}

public entry fun mint_pass(
    pool: &mut Pool,
    player_id: u16,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(pool.phase == PHASE_OPEN, EWrongPhase);
    assert!(coin::value(&payment) == pool.entry_fee_mist, EEntryFeeMismatch);

    balance::join(&mut pool.pot, coin::into_balance(payment));
    pool.total_passes = pool.total_passes + 1;
    pool.alive_count = pool.alive_count + 1;

    let pass = Pass {
        id: object::new(ctx),
        pool_id: object::id(pool),
        player_id,
        minted_at_ms: clock::timestamp_ms(clock),
    };

    event::emit(PassMinted {
        pool_id: object::id(pool),
        pass_id: object::id(&pass),
        owner: ctx.sender(),
        player_id,
    });

    transfer::transfer(pass, ctx.sender());
}

public entry fun lock_pool(pool: &mut Pool, ctx: &TxContext) {
    assert!(ctx.sender() == pool.admin, ENotAdmin);
    assert!(pool.phase == PHASE_OPEN, EWrongPhase);
    pool.phase = PHASE_LOCKED;
    event::emit(PoolLocked {
        pool_id: object::id(pool),
        total_passes: pool.total_passes,
        pot_mist: balance::value(&pool.pot),
    });
}

public entry fun settle_pool(
    pool: &mut Pool,
    matchday_blob_id: vector<u8>,
    eliminated_player_ids: vector<u16>,
    survivors_count: u64,
    cashout_window_ms: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == pool.admin, ENotAdmin);
    assert!(pool.phase == PHASE_LOCKED, EWrongPhase);

    pool.matchday_blob_id = matchday_blob_id;
    pool.eliminated_players = eliminated_player_ids;
    pool.alive_count = survivors_count;
    pool.phase = PHASE_SETTLED;
    pool.cashout_window_end_ms = clock::timestamp_ms(clock) + cashout_window_ms;

    event::emit(PoolSettled {
        pool_id: object::id(pool),
        matchday_blob_id: pool.matchday_blob_id,
        eliminated_player_ids: pool.eliminated_players,
        alive_count: pool.alive_count,
        pot_mist: balance::value(&pool.pot),
        cashout_window_end_ms: pool.cashout_window_end_ms,
    });
}

public entry fun cashout(
    pool: &mut Pool,
    pass: Pass,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(pool.phase == PHASE_SETTLED, EWrongPhase);
    assert!(object::id(pool) == pass.pool_id, EWrongPool);
    assert!(clock::timestamp_ms(clock) <= pool.cashout_window_end_ms, EWindowClosed);
    assert!(!vector::contains(&pool.eliminated_players, &pass.player_id), EPassDead);

    let pot_value = balance::value(&pool.pot);
    let payout = pot_value / pool.alive_count;
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

    let Pass { id, pool_id: _, player_id: _, minted_at_ms: _ } = pass;
    object::delete(id);
}

public entry fun close_pool(pool: &mut Pool, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == pool.admin, ENotAdmin);
    assert!(pool.phase == PHASE_SETTLED, EWrongPhase);
    assert!(clock::timestamp_ms(clock) > pool.cashout_window_end_ms, EWindowClosed);
    pool.phase = PHASE_CLOSED;
    event::emit(PoolClosed {
        pool_id: object::id(pool),
        leftover_mist: balance::value(&pool.pot),
    });
}

// === Views ===

public fun admin(p: &Pool): address { p.admin }
public fun phase(p: &Pool): u8 { p.phase }
public fun entry_fee_mist(p: &Pool): u64 { p.entry_fee_mist }
public fun pot_value(p: &Pool): u64 { balance::value(&p.pot) }
public fun total_passes(p: &Pool): u64 { p.total_passes }
public fun alive_count(p: &Pool): u64 { p.alive_count }
public fun cashout_window_end_ms(p: &Pool): u64 { p.cashout_window_end_ms }
public fun roster_blob_id(p: &Pool): &vector<u8> { &p.roster_blob_id }
public fun matchday_blob_id(p: &Pool): &vector<u8> { &p.matchday_blob_id }
public fun eliminated_players(p: &Pool): &vector<u16> { &p.eliminated_players }

public fun pass_pool_id(p: &Pass): ID { p.pool_id }
public fun pass_player_id(p: &Pass): u16 { p.player_id }
public fun pass_minted_at_ms(p: &Pass): u64 { p.minted_at_ms }
