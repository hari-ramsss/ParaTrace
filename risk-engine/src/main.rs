#![no_std]
#![no_main]

use pallet_revive_uapi::{HostFn, HostFnImpl as api, ReturnFlags, StorageFlags};

// ── Storage key namespaces ─────────────────────────────────────────────────────
// Each wallet gets 3 keys: score, count, volume
// Key layout: [namespace_byte, wallet_20_bytes, padding_11_bytes]

fn score_key(wallet: &[u8; 20]) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = 0x01;
    key[1..21].copy_from_slice(wallet);
    key
}

fn count_key(wallet: &[u8; 20]) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = 0x02;
    key[1..21].copy_from_slice(wallet);
    key
}

fn volume_key(wallet: &[u8; 20]) -> [u8; 32] {
    let mut key = [0u8; 32];
    key[0] = 0x03;
    key[1..21].copy_from_slice(wallet);
    key
}

// ── Storage helpers ────────────────────────────────────────────────────────────

fn read_u32(key: &[u8; 32]) -> u32 {
    let mut buf = [0u8; 32]; // pallet-revive reads into 32-byte output buffer
    let ok = {
        let mut out: &mut [u8] = &mut buf;
        api::get_storage(StorageFlags::empty(), key, &mut out).is_ok()
    };
    if ok {
        u32::from_be_bytes([buf[28], buf[29], buf[30], buf[31]])
    } else {
        0
    }
}

fn write_u32(key: &[u8; 32], val: u32) {
    let mut buf = [0u8; 32];
    let bytes = val.to_be_bytes();
    buf[28..32].copy_from_slice(&bytes);
    api::set_storage(StorageFlags::empty(), key, &buf);
}

fn read_u128(key: &[u8; 32]) -> u128 {
    let mut buf = [0u8; 32];
    let ok = {
        let mut out: &mut [u8] = &mut buf;
        api::get_storage(StorageFlags::empty(), key, &mut out).is_ok()
    };
    if ok {
        u128::from_be_bytes([
            buf[16], buf[17], buf[18], buf[19],
            buf[20], buf[21], buf[22], buf[23],
            buf[24], buf[25], buf[26], buf[27],
            buf[28], buf[29], buf[30], buf[31],
        ])
    } else {
        0
    }
}

fn write_u128(key: &[u8; 32], val: u128) {
    let mut buf = [0u8; 32];
    let bytes = val.to_be_bytes();
    buf[16..32].copy_from_slice(&bytes);
    api::set_storage(StorageFlags::empty(), key, &buf);
}

// ── Risk scoring algorithm ─────────────────────────────────────────────────────

fn compute_score(count: u32, volume: u128, is_hop: bool) -> u8 {
    let mut score: u32 = 0;

    // Transfer frequency risk
    if count > 50      { score += 40; }
    else if count > 10 { score += 20; }
    else if count > 3  { score += 10; }

    // Volume risk (in planck: 1 DOT = 10_000_000_000 planck)
    if volume > 1_000_000_000_000      { score += 35; } // >100 DOT
    else if volume > 100_000_000_000   { score += 15; } // >10 DOT

    // Chain-hopping flag
    if is_hop { score += 25; }

    score.min(100) as u8
}

// ── ABI function selectors (Keccak-256 of signature, first 4 bytes) ─────────
// Run: cast sig "recordTransfer(address,uint128,bool)"
// Run: cast sig "getScore(address)"
// Then paste the results below:
const RECORD_TRANSFER_SEL: [u8; 4] = [0x23, 0x92, 0x3b, 0x5b]; // ← replace
const GET_SCORE_SEL: [u8; 4]       = [0xd4, 0x78, 0x75, 0xd0]; // ← replace

// ── Contract entrypoints ───────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn call() {
    // Read calldata
    let input_size = api::call_data_size() as usize;
    if input_size < 4 {
        api::return_value(ReturnFlags::REVERT, &[]);
    }

    // We only need at most 4 + 20 + 16 + 1 = 41 bytes
    let mut input = [0u8; 64];
    let read_len = input_size.min(64);
    api::call_data_copy(&mut input[..read_len], 0);

    let selector = [input[0], input[1], input[2], input[3]];

    if selector == RECORD_TRANSFER_SEL {
        // Decode arguments:
        // bytes  4..24  → wallet address (20 bytes, left-padded in ABI, so take [16..36] for address)
        // bytes 24..56  → amount uint128 (right 16 bytes of 32-byte ABI word)
        // bytes 56..88  → is_hop bool (last byte of 32-byte ABI word)
        // ABI encoding pads everything to 32 bytes per param:
        // param1 (address): 32 bytes, address in last 20
        // param2 (uint128): 32 bytes, value in last 16
        // param3 (bool):    32 bytes, value in last byte

        let mut wallet = [0u8; 20];
        wallet.copy_from_slice(&input[16..36]); // last 20 bytes of first 32-byte slot

        // For amount, we need to re-read input with bigger buffer since 3 params = 4+96 bytes
        let mut big_input = [0u8; 100];
        let big_read = input_size.min(100);
        api::call_data_copy(&mut big_input[..big_read], 0);

        let amount = u128::from_be_bytes([
            big_input[52], big_input[53], big_input[54], big_input[55],
            big_input[56], big_input[57], big_input[58], big_input[59],
            big_input[60], big_input[61], big_input[62], big_input[63],
            big_input[64], big_input[65], big_input[66], big_input[67],
        ]); // last 16 bytes of second 32-byte slot (bytes 36..68)

        let is_hop = big_input[99] != 0; // last byte of third 32-byte slot (bytes 68..100)

        // Update storage
        let ck = count_key(&wallet);
        let vk = volume_key(&wallet);
        let sk = score_key(&wallet);

        let new_count  = read_u32(&ck).saturating_add(1);
        let new_volume = read_u128(&vk).saturating_add(amount);

        write_u32(&ck, new_count);
        write_u128(&vk, new_volume);

        let score = compute_score(new_count, new_volume, is_hop);
        write_u32(&sk, score as u32);

        // Return: uint8 padded to 32 bytes
        let mut ret = [0u8; 32];
        ret[31] = score;
        api::return_value(ReturnFlags::empty(), &ret);

    } else if selector == GET_SCORE_SEL {
        // Decode: address wallet (last 20 bytes of 32-byte ABI word)
        let mut wallet = [0u8; 20];
        wallet.copy_from_slice(&input[16..36]);

        let sk = score_key(&wallet);
        let score = read_u32(&sk) as u8;

        let mut ret = [0u8; 32];
        ret[31] = score;
        api::return_value(ReturnFlags::empty(), &ret);

    } else {
        // Unknown selector — revert
        api::return_value(ReturnFlags::REVERT, &[]);
    }
}

#[no_mangle]
pub extern "C" fn deploy() {
    // No constructor logic needed
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    // In a PVM no_std environment, we just loop on panic
    loop {}
}