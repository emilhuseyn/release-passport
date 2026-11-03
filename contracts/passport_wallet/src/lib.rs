//! The wallet behind one Release Passport. It is deployed once as an immutable global contract (by code hash) and used by
//! keyless sub-accounts such as `demo-tool.rp.relpass-emilh.testnet`. Only the parent account, the Release Passport NFT
//! contract, can move its money, so whoever holds the NFT controls the wallet and a previous holder controls nothing.
//!
//! Written against the raw NEAR host functions instead of near-sdk: a global contract burns 10 NEAR per 100 KB, and the
//! near-sdk version of these three methods was 95 KB. The logic stays small enough to read in one sitting.
#![cfg_attr(target_arch = "wasm32", no_std)]

/// Splits `<token>.<parent>` and returns the parent, the only account allowed to call `pay`.
pub fn parent_of(account: &[u8]) -> Option<&[u8]> {
    let dot = account.iter().position(|&b| b == b'.')?;
    let parent = &account[dot + 1..];
    if parent.is_empty() {
        None
    } else {
        Some(parent)
    }
}

/// `pay` arguments: 16 bytes of the amount in yoctoNEAR (u128 little endian), then the receiver account id.
pub fn parse_pay_args(input: &[u8]) -> Option<(u128, &[u8])> {
    if input.len() < 17 || input.len() > 16 + 64 {
        return None;
    }
    let mut amount = [0u8; 16];
    amount.copy_from_slice(&input[..16]);
    Some((u128::from_le_bytes(amount), &input[16..]))
}

/// Writes `n` in decimal into `out` and returns the used tail, for the JSON string returned by `balance`.
pub fn u128_decimal(mut n: u128, out: &mut [u8; 40]) -> &[u8] {
    let mut i = out.len();
    loop {
        i -= 1;
        out[i] = b'0' + (n % 10) as u8;
        n /= 10;
        if n == 0 {
            break;
        }
    }
    &out[i..]
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;

    #[link(wasm_import_module = "env")]
    extern "C" {
        fn input(register_id: u64);
        fn read_register(register_id: u64, ptr: u64);
        fn register_len(register_id: u64) -> u64;
        fn current_account_id(register_id: u64);
        fn predecessor_account_id(register_id: u64);
        fn account_balance(balance_ptr: u64);
        fn value_return(value_len: u64, value_ptr: u64);
        fn panic_utf8(len: u64, ptr: u64) -> !;
        fn promise_batch_create(account_id_len: u64, account_id_ptr: u64) -> u64;
        fn promise_batch_action_transfer(promise_index: u64, amount_ptr: u64);
        fn promise_return(promise_id: u64);
    }

    const REG: u64 = 0;

    fn fail(msg: &str) -> ! {
        unsafe { panic_utf8(msg.len() as u64, msg.as_ptr() as u64) }
    }

    fn read_into<'a>(buf: &'a mut [u8]) -> &'a [u8] {
        unsafe {
            let len = register_len(REG) as usize;
            if len > buf.len() {
                fail("ERR_TOO_LONG");
            }
            read_register(REG, buf.as_mut_ptr() as u64);
            &buf[..len]
        }
    }

    fn return_json_string(s: &[u8]) {
        let mut out = [0u8; 70];
        if s.len() + 2 > out.len() {
            fail("ERR_TOO_LONG");
        }
        out[0] = b'"';
        out[1..1 + s.len()].copy_from_slice(s);
        out[1 + s.len()] = b'"';
        unsafe { value_return((s.len() + 2) as u64, out.as_ptr() as u64) }
    }

    #[no_mangle]
    pub extern "C" fn pay() {
        let mut me = [0u8; 64];
        let mut caller = [0u8; 64];
        let mut args = [0u8; 80];
        unsafe { current_account_id(REG) };
        let me = read_into(&mut me);
        unsafe { predecessor_account_id(REG) };
        let caller = read_into(&mut caller);
        match parent_of(me) {
            Some(parent) if parent == caller => {}
            _ => fail("ERR_NOT_PARENT"),
        }
        unsafe { input(REG) };
        let args = read_into(&mut args);
        let (amount, receiver) = match parse_pay_args(args) {
            Some(v) => v,
            None => fail("ERR_BAD_ARGS"),
        };
        let amount = amount.to_le_bytes();
        unsafe {
            let p = promise_batch_create(receiver.len() as u64, receiver.as_ptr() as u64);
            promise_batch_action_transfer(p, amount.as_ptr() as u64);
            promise_return(p);
        }
    }

    #[no_mangle]
    pub extern "C" fn parent_id() {
        let mut me = [0u8; 64];
        unsafe { current_account_id(REG) };
        let me = read_into(&mut me);
        match parent_of(me) {
            Some(parent) => return_json_string(parent),
            None => fail("ERR_NO_PARENT"),
        }
    }

    #[no_mangle]
    pub extern "C" fn balance() {
        let mut raw = [0u8; 16];
        unsafe { account_balance(raw.as_mut_ptr() as u64) };
        let mut digits = [0u8; 40];
        return_json_string(u128_decimal(u128::from_le_bytes(raw), &mut digits));
    }

    #[panic_handler]
    fn on_panic(_: &core::panic::PanicInfo) -> ! {
        fail("ERR_PANIC")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parent_is_everything_after_the_first_dot() {
        assert_eq!(parent_of(b"demo-tool.rp.relpass-emilh.testnet"), Some(&b"rp.relpass-emilh.testnet"[..]));
        assert_eq!(parent_of(b"nodot"), None);
        assert_eq!(parent_of(b"trailing."), None);
    }

    #[test]
    fn pay_args_round_trip() {
        let mut buf = 5_000_000_000_000_000_000_000u128.to_le_bytes().to_vec();
        buf.extend_from_slice(b"reporter.testnet");
        assert_eq!(parse_pay_args(&buf), Some((5_000_000_000_000_000_000_000, &b"reporter.testnet"[..])));
        assert_eq!(parse_pay_args(&buf[..16]), None);
    }

    #[test]
    fn decimal() {
        let mut out = [0u8; 40];
        assert_eq!(u128_decimal(0, &mut out), b"0");
        assert_eq!(u128_decimal(u128::MAX, &mut out), u128::MAX.to_string().as_bytes());
    }
}
