module proof::receipt;

use std::string::String;
use sui::clock::{Self, Clock};
use sui::event;

public struct Receipt has key, store {
    id: UID,
    walrus_blob_id: vector<u8>,
    original_url: String,
    sha256: vector<u8>,
    captured_at_ms: u64,
    signer: address,
}

public struct ReceiptMinted has copy, drop {
    receipt_id: ID,
    walrus_blob_id: vector<u8>,
    signer: address,
    captured_at_ms: u64,
}

public entry fun mint(
    walrus_blob_id: vector<u8>,
    original_url: String,
    sha256: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let signer = ctx.sender();
    let captured_at_ms = clock::timestamp_ms(clock);

    let r = Receipt {
        id: object::new(ctx),
        walrus_blob_id,
        original_url,
        sha256,
        captured_at_ms,
        signer,
    };

    event::emit(ReceiptMinted {
        receipt_id: object::id(&r),
        walrus_blob_id: r.walrus_blob_id,
        signer,
        captured_at_ms,
    });

    transfer::transfer(r, signer);
}

public fun walrus_blob_id(r: &Receipt): &vector<u8> { &r.walrus_blob_id }
public fun original_url(r: &Receipt): &String { &r.original_url }
public fun sha256(r: &Receipt): &vector<u8> { &r.sha256 }
public fun captured_at_ms(r: &Receipt): u64 { r.captured_at_ms }
public fun signer(r: &Receipt): address { r.signer }
