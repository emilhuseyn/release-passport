//! Unit tests for the paths the official nfts prompt asks for: control passing on transfer, a sale in the middle of a
//! payout, and every way a seller could try to keep the money or the authority. Promise results are mocked, which makes
//! each interleaving deterministic.
#![allow(unused_must_use)]
use super::*;
use near_contract_standards::non_fungible_token::metadata::NFT_METADATA_SPEC;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, PromiseResult, RuntimeFeesConfig};

const CONTRACT: &str = "rp.relpass-emilh.testnet";
const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const MIN: u64 = 60_000_000_000;
const SHA_A: &str = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const SHA_B: &str = "60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752";
const SHA_X: &str = "fd61a03af4f77d870fc21e05e7e80678095c92d808cfb3b5c279ee04c74aca13";

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn set_full(pred: &str, deposit: u128, ts: u64, results: Vec<PromiseResult>) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc(CONTRACT))
        .predecessor_account_id(acc(pred))
        .signer_account_id(acc(pred))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(1000))
        .block_timestamp(ts);
    testing_env!(b.build(), near_sdk::test_vm_config(), RuntimeFeesConfig::test(), Default::default(), results);
}

fn set(pred: &str, deposit: u128, ts: u64) {
    set_full(pred, deposit, ts, vec![]);
}

fn config() -> Config {
    Config {
        wallet_code_hash: [7u8; 32].into(),
        default_arbiter: acc("arbiter.testnet"),
        min_bond: U128(NEAR / 2),
        min_bounty: U128(NEAR / 10),
        report_stake: U128(NEAR / 20),
        report_window_ns: U64(15 * MIN),
        withdraw_delay_ns: U64(2 * MIN),
        in_flight_timeout_ns: U64(10 * MIN),
    }
}

fn setup() -> Contract {
    set(CONTRACT, 0, 0);
    let c = Contract::new(
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Release Passport".into(),
            symbol: "RPASS".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        },
        config(),
    );
    c
}

/// alice mints demo-tool with a 1 NEAR bond and a 0.2 NEAR bounty, arbiter.testnet as arbiter.
fn minted() -> Contract {
    let mut c = setup();
    set("alice.testnet", NEAR + STORAGE_RESERVE, 1);
    c.create_passport(
        "demo-tool".into(),
        "demo-tool".into(),
        None,
        "https://github.com/x/demo-tool".into(),
        Some(acc("arbiter.testnet")),
        U128(NEAR / 5),
    );
    set(CONTRACT, 0, 2);
    assert!(c.on_wallet_created("demo-tool".into(), Ok(acc(CONTRACT))));
    c
}

fn publish(c: &mut Contract, who: &str, version: &str, sha: &str, ts: u64) {
    set(who, NEAR / 100, ts);
    c.publish_release(
        "demo-tool".into(),
        version.into(),
        vec![Artifact { name: format!("demo-tool-{version}.tgz"), sha256: sha.into(), size: None }],
        None,
    );
}

fn transfer(c: &mut Contract, from: &str, to: &str, ts: u64) {
    set(from, 1, ts);
    c.nft_transfer(acc(to), "demo-tool".into(), None, None);
}

fn p(c: &Contract) -> PassportView {
    c.get_passport("demo-tool".into()).unwrap()
}

/// Money conservation for one passport: every yocto that entered is bonded, withdrawable, in transit or paid out.
fn assert_conserved(c: &Contract, deposited: u128) {
    let v = p(c);
    let pp = &v.passport;
    assert_eq!(pp.bond_locked.0 + pp.free_balance.0 + pp.in_transit.0 + pp.total_paid_out.0, deposited);
}

#[test]
fn mint_creates_token_and_passport() {
    let c = minted();
    let v = p(&c);
    assert_eq!(v.owner_id, acc("alice.testnet"));
    assert_eq!(v.passport.wallet_id, acc("demo-tool.rp.relpass-emilh.testnet"));
    assert_eq!(v.passport.bond_locked.0, NEAR);
    assert_eq!(v.passport.arbiter_id, acc("arbiter.testnet"));
    assert_eq!(c.nft_total_supply().0, 1);
    let extra: serde_json::Value =
        serde_json::from_str(&c.nft_token("demo-tool".into()).unwrap().metadata.unwrap().extra.unwrap()).unwrap();
    assert_eq!(extra["authority"], "alice.testnet");
    assert_eq!(extra["latest_status"], "NO_RELEASE");
}

#[test]
fn failed_wallet_creation_mints_nothing() {
    let mut c = setup();
    set("alice.testnet", NEAR + STORAGE_RESERVE, 1);
    c.create_passport("demo-tool".into(), "t".into(), None, "https://x".into(), None, U128(NEAR / 5));
    set(CONTRACT, 0, 2);
    assert!(!c.on_wallet_created("demo-tool".into(), Err(PromiseError::Failed)));
    assert!(c.get_passport("demo-tool".into()).is_none());
    assert!(c.nft_token("demo-tool".into()).is_none());
}

#[test]
#[should_panic(expected = "ERR_ARBITER_IS_MINTER")]
fn minter_cannot_be_its_own_arbiter() {
    let mut c = setup();
    set("alice.testnet", NEAR + STORAGE_RESERVE, 1);
    c.create_passport("demo-tool".into(), "t".into(), None, "https://x".into(), Some(acc("alice.testnet")), U128(NEAR / 5));
}

#[test]
#[should_panic(expected = "ERR_TOKEN_ID")]
fn token_id_must_be_a_valid_sub_account_label() {
    let mut c = setup();
    set("alice.testnet", NEAR + STORAGE_RESERVE, 1);
    c.create_passport("Demo.Tool".into(), "t".into(), None, "https://x".into(), None, U128(NEAR / 5));
}

#[test]
fn verify_ok_revoked_unknown_mismatch() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    publish(&mut c, "alice.testnet", "1.1.0", SHA_B, 4);
    let m = c.verify_digest(SHA_A.into());
    assert_eq!(m.len(), 1);
    assert_eq!(m[0].verdict, "OK");
    assert_eq!(m[0].owner_id, acc("alice.testnet"));
    assert!(c.verify_digest(SHA_X.into()).is_empty());
    assert_eq!(c.verify_file("demo-tool".into(), "1.0.0".into(), SHA_B.into()).verdict, "MISMATCH");
    assert_eq!(c.verify_file("demo-tool".into(), "9.9.9".into(), SHA_A.into()).verdict, "UNKNOWN");
    set("alice.testnet", 1, 5);
    c.revoke_release("demo-tool".into(), "1.0.0".into(), "signing key leaked".into());
    assert_eq!(c.verify_digest(SHA_A.into())[0].verdict, "REVOKED");
    assert_eq!(c.verify_file("demo-tool".into(), "1.1.0".into(), SHA_B.into()).verdict, "OK");
}

#[test]
#[should_panic(expected = "ERR_NOT_HOLDER")]
fn previous_holder_cannot_publish_after_sale() {
    let mut c = minted();
    transfer(&mut c, "alice.testnet", "bob.testnet", 3);
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 4);
}

#[test]
fn new_holder_can_publish_after_sale() {
    let mut c = minted();
    transfer(&mut c, "alice.testnet", "bob.testnet", 3);
    publish(&mut c, "bob.testnet", "2.0.0", SHA_B, 4);
    assert_eq!(c.get_release("demo-tool".into(), "2.0.0".into()).unwrap().published_by, acc("bob.testnet"));
}

#[test]
fn transfer_raises_epoch_and_cancels_pending_withdrawal() {
    let mut c = minted();
    set("fan.testnet", NEAR / 2, 3);
    c.sponsor("demo-tool".into(), None);
    set("alice.testnet", 1, 4);
    c.request_withdraw("demo-tool".into(), U128(NEAR / 2));
    assert!(p(&c).passport.pending_withdrawal.is_some());
    transfer(&mut c, "alice.testnet", "bob.testnet", 5);
    let v = p(&c);
    assert_eq!(v.passport.holder_epoch, 1);
    assert!(v.passport.pending_withdrawal.is_none());
    let kinds: Vec<String> = c.passport_history("demo-tool".into(), 0, 50).into_iter().map(|h| h.kind).collect();
    assert!(kinds.contains(&"withdraw_cancelled".to_string()));
    assert!(kinds.contains(&"transferred".to_string()));
}

#[test]
#[should_panic(expected = "ERR_NOT_YET")]
fn withdrawal_waits_for_the_delay() {
    let mut c = minted();
    set("fan.testnet", NEAR / 2, 3);
    c.sponsor("demo-tool".into(), None);
    set("alice.testnet", 1, 4);
    c.request_withdraw("demo-tool".into(), U128(NEAR / 2));
    set("alice.testnet", 0, 4 + MIN);
    c.execute_withdraw("demo-tool".into());
}

#[test]
#[should_panic(expected = "ERR_AMOUNT")]
fn bond_is_never_withdrawable() {
    let mut c = minted();
    set("alice.testnet", 1, 3);
    c.request_withdraw("demo-tool".into(), U128(NEAR / 2));
}

/// U5: alice's withdrawal is in flight when she sells. The payout fails, and the money goes back to the token, which bob
/// now holds. alice got nothing and cannot retry.
#[test]
fn sale_in_the_middle_of_a_failed_withdrawal_credits_the_new_holder() {
    let mut c = minted();
    set("fan.testnet", NEAR / 2, 3);
    c.sponsor("demo-tool".into(), None);
    set("alice.testnet", 1, 4);
    c.request_withdraw("demo-tool".into(), U128(NEAR / 2));
    set("anyone.testnet", 0, 4 + 3 * MIN);
    c.execute_withdraw("demo-tool".into());
    assert_eq!(p(&c).passport.free_balance.0, 0);
    assert_eq!(p(&c).passport.in_transit.0, NEAR / 2);
    transfer(&mut c, "alice.testnet", "bob.testnet", 5 + 3 * MIN);
    set_full(CONTRACT, 0, 6 + 3 * MIN, vec![PromiseResult::Failed]);
    assert!(!c.on_payout("demo-tool".into(), acc("alice.testnet"), U128(NEAR / 2), "withdraw".into()));
    let v = p(&c);
    assert_eq!(v.owner_id, acc("bob.testnet"));
    assert_eq!(v.passport.free_balance.0, NEAR / 2);
    assert_eq!(v.passport.in_transit.0, 0);
    assert_eq!(v.passport.total_paid_out.0, 0);
    assert_conserved(&c, NEAR + NEAR / 2);
}

/// Same race with a successful payout: alice receives what she asked for before the sale, bob's view never counted it.
#[test]
fn sale_in_the_middle_of_a_settled_withdrawal() {
    let mut c = minted();
    set("fan.testnet", NEAR / 2, 3);
    c.sponsor("demo-tool".into(), None);
    set("alice.testnet", 1, 4);
    c.request_withdraw("demo-tool".into(), U128(NEAR / 2));
    set("anyone.testnet", 0, 4 + 3 * MIN);
    c.execute_withdraw("demo-tool".into());
    transfer(&mut c, "alice.testnet", "bob.testnet", 5 + 3 * MIN);
    assert_eq!(p(&c).passport.free_balance.0, 0);
    set_full(CONTRACT, 0, 6 + 3 * MIN, vec![PromiseResult::Successful(vec![])]);
    assert!(c.on_payout("demo-tool".into(), acc("alice.testnet"), U128(NEAR / 2), "withdraw".into()));
    assert_eq!(p(&c).passport.total_paid_out.0, NEAR / 2);
    assert_conserved(&c, NEAR + NEAR / 2);
}

/// U6: a request made before a sale cannot be executed after the token comes back.
#[test]
fn stale_request_after_sale_and_buyback_pays_nothing() {
    let mut c = minted();
    set("fan.testnet", NEAR / 2, 3);
    c.sponsor("demo-tool".into(), None);
    set("alice.testnet", 1, 4);
    c.request_withdraw("demo-tool".into(), U128(NEAR / 2));
    transfer(&mut c, "alice.testnet", "bob.testnet", 5);
    transfer(&mut c, "bob.testnet", "alice.testnet", 6);
    assert!(p(&c).passport.pending_withdrawal.is_none());
    assert_eq!(p(&c).passport.holder_epoch, 2);
}

/// U7: the arbiter confirms tampering, the bounty payout is in flight, alice sells, the payout fails. The bond is
/// restored on the token, so it now backs bob's passport.
#[test]
fn sale_in_the_middle_of_a_failed_bounty_restores_the_bond_on_the_token() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    set("reporter.testnet", NEAR / 20 + NEAR / 100, 4);
    let id = c.file_report("demo-tool".into(), "1.0.0".into(), SHA_X.into(), "https://evidence".into(), "tarball differs".into()).0;
    set("arbiter.testnet", 1, 5);
    c.resolve_report(id, true, "confirmed".into());
    assert_eq!(p(&c).passport.bond_locked.0, NEAR - NEAR / 5);
    assert_eq!(c.verify_digest(SHA_A.into())[0].verdict, "COMPROMISED");
    transfer(&mut c, "alice.testnet", "bob.testnet", 6);
    set_full(CONTRACT, 0, 7, vec![PromiseResult::Failed]);
    c.on_payout("demo-tool".into(), acc("reporter.testnet"), U128(NEAR / 5), "bounty".into());
    let v = p(&c);
    assert_eq!(v.owner_id, acc("bob.testnet"));
    assert_eq!(v.passport.bond_locked.0, NEAR);
    assert_conserved(&c, NEAR);
}

#[test]
fn confirmed_report_pays_bounty_and_freezes_nothing_after() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    set("reporter.testnet", NEAR / 20 + NEAR / 100, 4);
    let id = c.file_report("demo-tool".into(), "1.0.0".into(), SHA_X.into(), "https://e".into(), "n".into()).0;
    assert_eq!(p(&c).passport.open_reports, 1);
    set("arbiter.testnet", 1, 5);
    c.resolve_report(id, true, "ok".into());
    set_full(CONTRACT, 0, 6, vec![PromiseResult::Successful(vec![])]);
    c.on_payout("demo-tool".into(), acc("reporter.testnet"), U128(NEAR / 5), "bounty".into());
    let v = p(&c);
    assert_eq!(v.passport.open_reports, 0);
    assert_eq!(v.passport.total_paid_out.0, NEAR / 5);
    assert!(matches!(c.get_report(id).unwrap().status, ReportStatus::Confirmed { .. }));
    assert_conserved(&c, NEAR);
}

#[test]
#[should_panic(expected = "ERR_OPEN_REPORTS")]
fn open_report_freezes_withdrawals() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    set("fan.testnet", NEAR / 2, 4);
    c.sponsor("demo-tool".into(), None);
    set("reporter.testnet", NEAR / 20 + NEAR / 100, 5);
    c.file_report("demo-tool".into(), "1.0.0".into(), SHA_X.into(), "https://e".into(), "n".into());
    set("alice.testnet", 1, 6);
    c.request_withdraw("demo-tool".into(), U128(NEAR / 2));
}

#[test]
fn report_survives_a_sale_and_rejection_pays_the_new_holder() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    set("reporter.testnet", NEAR / 20 + NEAR / 100, 4);
    let id = c.file_report("demo-tool".into(), "1.0.0".into(), SHA_X.into(), "https://e".into(), "n".into()).0;
    transfer(&mut c, "alice.testnet", "bob.testnet", 5);
    assert_eq!(p(&c).passport.open_reports, 1);
    set("arbiter.testnet", 1, 6);
    c.resolve_report(id, false, "hash matches the published one".into());
    let v = p(&c);
    assert_eq!(v.passport.open_reports, 0);
    assert_eq!(v.passport.free_balance.0, NEAR / 20);
    assert_conserved(&c, NEAR + NEAR / 20);
}

#[test]
#[should_panic(expected = "ERR_NOT_ARBITER")]
fn only_the_arbiter_resolves() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    set("reporter.testnet", NEAR / 20 + NEAR / 100, 4);
    let id = c.file_report("demo-tool".into(), "1.0.0".into(), SHA_X.into(), "https://e".into(), "n".into()).0;
    set("alice.testnet", 1, 5);
    c.resolve_report(id, false, "no".into());
}

#[test]
#[should_panic(expected = "ERR_ARBITER_IS_HOLDER")]
fn arbiter_that_bought_the_passport_cannot_reject_reports() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    set("reporter.testnet", NEAR / 20 + NEAR / 100, 4);
    let id = c.file_report("demo-tool".into(), "1.0.0".into(), SHA_X.into(), "https://e".into(), "n".into()).0;
    transfer(&mut c, "alice.testnet", "arbiter.testnet", 5);
    set("arbiter.testnet", 1, 6);
    c.resolve_report(id, false, "no".into());
}

#[test]
fn holder_can_admit_and_report_can_expire() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    publish(&mut c, "alice.testnet", "1.1.0", SHA_B, 4);
    set("reporter.testnet", NEAR / 20 + NEAR / 100, 5);
    let a = c.file_report("demo-tool".into(), "1.0.0".into(), SHA_X.into(), "https://e".into(), "n".into()).0;
    set("reporter.testnet", NEAR / 20 + NEAR / 100, 6);
    let b = c.file_report("demo-tool".into(), "1.1.0".into(), SHA_X.into(), "https://e".into(), "n".into()).0;
    set("alice.testnet", 1, 7);
    c.admit_report(a);
    set("anyone.testnet", 0, 7 + 16 * MIN);
    c.expire_report(b);
    assert_eq!(c.get_report(b).unwrap().status, ReportStatus::Expired);
    assert_eq!(p(&c).passport.open_reports, 0);
}

#[test]
#[should_panic(expected = "ERR_IN_FLIGHT")]
fn passport_is_locked_while_a_transfer_call_settles() {
    let mut c = minted();
    set("alice.testnet", 1, 3);
    let _ = c.nft_transfer_call(acc("evil.testnet"), "demo-tool".into(), None, None, "x".into());
    // The receiver tries to act as holder during nft_on_transfer.
    publish(&mut c, "evil.testnet", "6.6.6", SHA_X, 4);
}

#[test]
fn transfer_call_returned_by_receiver_goes_back_and_unlocks() {
    let mut c = minted();
    set("alice.testnet", 1, 3);
    let _ = c.nft_transfer_call(acc("evil.testnet"), "demo-tool".into(), None, None, "x".into());
    set_full(CONTRACT, 0, 4, vec![PromiseResult::Successful(b"true".to_vec())]);
    assert!(!c.nft_resolve_transfer(acc("alice.testnet"), acc("evil.testnet"), "demo-tool".into(), None));
    let v = p(&c);
    assert_eq!(v.owner_id, acc("alice.testnet"));
    assert_eq!(v.passport.holder_epoch, 2);
    assert!(!v.in_flight);
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 5);
}

#[test]
fn transfer_call_kept_by_receiver_unlocks_for_the_receiver() {
    let mut c = minted();
    set("alice.testnet", 1, 3);
    let _ = c.nft_transfer_call(acc("market.testnet"), "demo-tool".into(), None, None, "x".into());
    set_full(CONTRACT, 0, 4, vec![PromiseResult::Successful(b"false".to_vec())]);
    assert!(c.nft_resolve_transfer(acc("alice.testnet"), acc("market.testnet"), "demo-tool".into(), None));
    assert_eq!(p(&c).owner_id, acc("market.testnet"));
    assert_eq!(p(&c).passport.holder_epoch, 1);
}

#[test]
#[should_panic(expected = "Approval extension is disabled")]
fn nobody_but_the_holder_can_transfer() {
    let mut c = minted();
    transfer(&mut c, "mallory.testnet", "mallory.testnet", 3);
}

#[test]
fn history_tells_the_story() {
    let mut c = minted();
    publish(&mut c, "alice.testnet", "1.0.0", SHA_A, 3);
    set("fan.testnet", NEAR / 2, 4);
    c.sponsor("demo-tool".into(), Some("thanks".into()));
    transfer(&mut c, "alice.testnet", "bob.testnet", 5);
    let h = c.passport_history("demo-tool".into(), 0, 50);
    let kinds: Vec<&str> = h.iter().map(|e| e.kind.as_str()).collect();
    assert_eq!(kinds, vec!["minted", "release_published", "sponsored", "transferred"]);
    assert_eq!(h[3].holder, acc("bob.testnet"));
    assert_eq!(h[2].amount, Some(U128(NEAR / 2)));
}

#[test]
fn pay_args_layout_matches_the_wallet() {
    let a = pay_args(&acc("reporter.testnet"), 5);
    assert_eq!(&a[..16], &5u128.to_le_bytes());
    assert_eq!(&a[16..], b"reporter.testnet");
}
