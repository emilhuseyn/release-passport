//! Release Passport: one NEP-171 token per software project. The token is also a NEAR account,
//! `<token_id>.<this contract>`, created by this contract with no access keys and running the immutable passport wallet
//! (a global contract by code hash). The wallet obeys only this contract, and this contract obeys only the current token
//! holder, so selling the token hands over the project's release authority and its security bond, and the seller keeps
//! nothing. Every release lists its files' sha256 digests; anyone can check a download before installing it.
//!
//! Approvals (NEP-178) are deliberately off: a seller cannot keep an approval for a second account.
use near_contract_standards::non_fungible_token::core::{ext_nft_receiver, NonFungibleTokenResolver};
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::{NFTContractMetadata, TokenMetadata};
use near_contract_standards::non_fungible_token::{NonFungibleToken, NonFungibleTokenEnumeration, Token, TokenId};
use near_sdk::collections::{LazyOption, LookupMap};
use near_sdk::json_types::{Base58CryptoHash, U128, U64};
use near_sdk::serde_json::{self, json};
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseError, PromiseOrValue,
};

#[cfg(test)]
mod tests;

/// Kept back from the mint deposit to pay for this contract's records about the new passport; the unused part is refunded.
pub const STORAGE_RESERVE: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR
const GAS_PARENT_CHECK: Gas = Gas::from_tgas(5);
const GAS_ON_CREATED: Gas = Gas::from_tgas(60);
const GAS_PAY: Gas = Gas::from_tgas(10);
const GAS_ON_PAYOUT: Gas = Gas::from_tgas(20);
const GAS_RESOLVE_TRANSFER: Gas = Gas::from_tgas(20);
const MAX_FILES: usize = 16;
const MAX_VERSIONS: usize = 64;
const MAX_REPORTS: usize = 64;
const MAX_REFS_PER_DIGEST: usize = 8;

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum StorageKey {
    OwnerById,
    TokenMetadata,
    Enumeration,
    Metadata,
    Passports,
    Releases,
    Digests,
    Reports,
    History,
    PendingMints,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Config {
    /// sha256 of passport_wallet.wasm, deployed once as an immutable global contract.
    pub wallet_code_hash: Base58CryptoHash,
    /// Arbiter used when the minter names none. A passport's arbiter can never change after mint.
    pub default_arbiter: AccountId,
    pub min_bond: U128,
    pub min_bounty: U128,
    pub report_stake: U128,
    pub report_window_ns: U64,
    pub withdraw_delay_ns: U64,
    pub in_flight_timeout_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
pub struct Withdrawal {
    pub requested_by: AccountId,
    pub holder_epoch: u32,
    pub amount: U128,
    pub unlock_at_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Passport {
    pub wallet_id: AccountId,
    pub arbiter_id: AccountId,
    pub minter_id: AccountId,
    pub title: String,
    pub repo_url: String,
    /// Paid to a reporter for each confirmed tampering report, capped by the remaining bond.
    pub bounty: U128,
    /// Backs reports. Leaves the wallet only as a bounty.
    pub bond_locked: U128,
    /// Sponsorships and forfeited report stakes; the holder can withdraw it after a delay.
    pub free_balance: U128,
    /// Debited from the ledger, payout receipt not settled yet.
    pub in_transit: U128,
    /// +1 on every change of holder, so nothing requested by an earlier holder can still execute.
    pub holder_epoch: u32,
    pub in_flight_until_ns: Option<U64>,
    pub pending_withdrawal: Option<Withdrawal>,
    pub open_reports: u32,
    pub report_ids: Vec<u64>,
    pub versions: Vec<String>,
    pub history_len: u32,
    pub total_earned: U128,
    pub total_paid_out: U128,
    pub created_at_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Artifact {
    pub name: String,
    /// 64 lowercase hex characters.
    pub sha256: String,
    pub size: Option<U64>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
pub enum ReleaseStatus {
    Active,
    Revoked { at_ns: U64, reason: String },
    Compromised { at_ns: U64, report_id: u64 },
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Release {
    pub version: String,
    pub files: Vec<Artifact>,
    pub source_url: Option<String>,
    pub status: ReleaseStatus,
    pub published_at_ns: U64,
    pub published_by: AccountId,
    pub holder_epoch: u32,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct DigestRef {
    pub token_id: TokenId,
    pub version: String,
    pub file_name: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
pub enum ReportStatus {
    Open,
    Confirmed { payout: U128, by: AccountId },
    Rejected { by: AccountId },
    Expired,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Report {
    pub id: u64,
    pub token_id: TokenId,
    pub version: String,
    pub reporter: AccountId,
    pub stake: U128,
    pub observed_sha256: String,
    pub evidence_url: String,
    pub note: String,
    pub filed_at_ns: U64,
    pub deadline_ns: U64,
    pub status: ReportStatus,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct HistoryEntry {
    pub seq: u32,
    pub at_ns: U64,
    pub block_height: U64,
    pub kind: String,
    /// Who sent the call.
    pub actor: AccountId,
    pub counterparty: Option<AccountId>,
    pub amount: Option<U128>,
    /// Holder after this entry.
    pub holder: AccountId,
    pub holder_epoch: u32,
    pub ref_id: Option<String>,
}

#[near(serializers = [borsh, json])]
pub struct PendingMint {
    pub minter: AccountId,
    pub title: String,
    pub description: Option<String>,
    pub repo_url: String,
    pub arbiter_id: AccountId,
    pub bounty: U128,
    pub bond: U128,
}

#[near(serializers = [json])]
pub struct PassportView {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub in_flight: bool,
    pub latest_version: Option<String>,
    #[serde(flatten)]
    pub passport: Passport,
}

#[near(serializers = [json])]
pub struct DigestMatch {
    pub verdict: String,
    pub token_id: TokenId,
    pub version: String,
    pub file_name: String,
    pub release_status: ReleaseStatus,
    pub owner_id: AccountId,
    pub wallet_id: AccountId,
    pub bond_locked: U128,
    pub arbiter_id: AccountId,
}

#[near(serializers = [json])]
pub struct VerifyResult {
    /// OK, REVOKED, COMPROMISED, MISMATCH (the version exists but lists no such file), UNKNOWN (no such passport or version).
    pub verdict: String,
    pub file_name: Option<String>,
    pub release_status: Option<ReleaseStatus>,
    pub owner_id: Option<AccountId>,
    pub bond_locked: Option<U128>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    config: Config,
    passports: LookupMap<TokenId, Passport>,
    releases: LookupMap<String, Release>,
    digests: LookupMap<String, Vec<DigestRef>>,
    reports: LookupMap<u64, Report>,
    next_report_id: u64,
    history: LookupMap<String, HistoryEntry>,
    pending_mints: LookupMap<TokenId, PendingMint>,
}

fn now() -> u64 {
    env::block_timestamp()
}

fn emit(event: &str, data: serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({"standard": "release_passport", "version": "1.0.0", "event": event, "data": [data]})
    ));
}

fn valid_token_id(id: &str) -> bool {
    let b = id.as_bytes();
    !b.is_empty()
        && b.len() <= 39
        && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
        && b[0] != b'-'
        && b[b.len() - 1] != b'-'
}

fn valid_version(v: &str) -> bool {
    !v.is_empty() && v.len() <= 32 && v.bytes().all(|c| c.is_ascii_alphanumeric() || b".+-".contains(&c))
}

fn valid_sha256(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

fn release_key(token_id: &str, version: &str) -> String {
    format!("{token_id}/{version}")
}

fn verdict_of(status: &ReleaseStatus) -> &'static str {
    match status {
        ReleaseStatus::Active => "OK",
        ReleaseStatus::Revoked { .. } => "REVOKED",
        ReleaseStatus::Compromised { .. } => "COMPROMISED",
    }
}

/// Raw arguments of the wallet's `pay`: amount (u128 little endian) then the receiver account id.
pub fn pay_args(receiver: &AccountId, amount: u128) -> Vec<u8> {
    let mut v = amount.to_le_bytes().to_vec();
    v.extend_from_slice(receiver.as_bytes());
    v
}

/// Refunds whatever of `attached` the storage growth since `before` did not use; panics if it was not enough.
fn charge_storage(before: u64, attached: u128, payer: &AccountId) {
    let used = env::storage_usage().saturating_sub(before) as u128 * env::storage_byte_cost().as_yoctonear();
    require!(attached >= used, format!("ERR_STORAGE: attach at least {used} yoctoNEAR"));
    let refund = attached - used;
    if refund > 1 {
        Promise::new(payer.clone()).transfer(NearToken::from_yoctonear(refund)).detach();
    }
}

#[near]
impl Contract {
    #[init]
    pub fn new(metadata: NFTContractMetadata, config: Config) -> Self {
        require!(!env::state_exists(), "ERR_ALREADY_INITIALIZED");
        metadata.assert_valid();
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::OwnerById,
                env::current_account_id(),
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                None::<StorageKey>,
            ),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            config,
            passports: LookupMap::new(StorageKey::Passports),
            releases: LookupMap::new(StorageKey::Releases),
            digests: LookupMap::new(StorageKey::Digests),
            reports: LookupMap::new(StorageKey::Reports),
            next_report_id: 0,
            history: LookupMap::new(StorageKey::History),
            pending_mints: LookupMap::new(StorageKey::PendingMints),
        }
    }

    // ---------- mint ----------

    /// Creates the passport's keyless account with the bond in it, then mints the token in the callback. Attach the bond
    /// plus 0.05 NEAR for storage (unused storage money is refunded) and 300 TGas.
    #[payable]
    pub fn create_passport(
        &mut self,
        token_id: TokenId,
        title: String,
        description: Option<String>,
        repo_url: String,
        arbiter_id: Option<AccountId>,
        bounty: U128,
    ) -> Promise {
        require!(valid_token_id(&token_id), "ERR_TOKEN_ID: 1-39 chars of a-z, 0-9 and -, not starting or ending with -");
        require!(self.tokens.owner_by_id.get(&token_id).is_none(), "ERR_TOKEN_EXISTS");
        require!(self.pending_mints.get(&token_id).is_none(), "ERR_MINT_PENDING");
        require!(!title.is_empty() && title.len() <= 64, "ERR_TITLE");
        require!(description.as_ref().map_or(true, |d| d.len() <= 280), "ERR_DESCRIPTION");
        require!(!repo_url.is_empty() && repo_url.len() <= 200, "ERR_REPO_URL");
        let minter = env::predecessor_account_id();
        let arbiter = arbiter_id.unwrap_or_else(|| self.config.default_arbiter.clone());
        require!(arbiter != minter, "ERR_ARBITER_IS_MINTER");
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached > STORAGE_RESERVE, "ERR_DEPOSIT");
        let bond = attached - STORAGE_RESERVE;
        require!(bond >= self.config.min_bond.0, "ERR_BOND_BELOW_MIN");
        require!(bounty.0 >= self.config.min_bounty.0 && bounty.0 <= bond, "ERR_BOUNTY");

        let wallet_id: AccountId = format!("{}.{}", token_id, env::current_account_id()).parse().unwrap();
        self.pending_mints.insert(
            &token_id,
            &PendingMint { minter, title, description, repo_url, arbiter_id: arbiter, bounty, bond: U128(bond) },
        );
        let code_hash: [u8; 32] = self.config.wallet_code_hash.into();
        Promise::new(wallet_id)
            .create_account()
            .transfer(NearToken::from_yoctonear(bond))
            .use_global_contract(code_hash)
            .function_call("parent_id".to_string(), b"{}".to_vec(), NearToken::ZERO, GAS_PARENT_CHECK)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_CREATED).on_wallet_created(token_id))
    }

    #[private]
    pub fn on_wallet_created(
        &mut self,
        token_id: TokenId,
        #[callback_result] parent: Result<AccountId, PromiseError>,
    ) -> bool {
        let pending = self.pending_mints.remove(&token_id).expect("ERR_NO_PENDING_MINT");
        let me = env::current_account_id();
        if !matches!(&parent, Ok(p) if *p == me) {
            // The batch failed as a whole, so the bond came back here. Return everything to the minter.
            Promise::new(pending.minter.clone())
                .transfer(NearToken::from_yoctonear(pending.bond.0 + STORAGE_RESERVE))
                .detach();
            emit("passport_create_failed", json!({"token_id": token_id, "minter_id": pending.minter}));
            return false;
        }
        let before = env::storage_usage();
        let wallet_id: AccountId = format!("{token_id}.{me}").parse().unwrap();
        let metadata = TokenMetadata {
            title: Some(pending.title.clone()),
            description: pending.description.clone(),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: Some(now().to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: None,
            reference: None,
            reference_hash: None,
        };
        self.tokens.internal_mint_with_refund(token_id.clone(), pending.minter.clone(), Some(metadata), None);
        NftMint { owner_id: &pending.minter, token_ids: &[&token_id], memo: None }.emit();
        let passport = Passport {
            wallet_id: wallet_id.clone(),
            arbiter_id: pending.arbiter_id.clone(),
            minter_id: pending.minter.clone(),
            title: pending.title,
            repo_url: pending.repo_url,
            bounty: pending.bounty,
            bond_locked: pending.bond,
            free_balance: U128(0),
            in_transit: U128(0),
            holder_epoch: 0,
            in_flight_until_ns: None,
            pending_withdrawal: None,
            open_reports: 0,
            report_ids: vec![],
            versions: vec![],
            history_len: 0,
            total_earned: U128(0),
            total_paid_out: U128(0),
            created_at_ns: U64(now()),
        };
        self.passports.insert(&token_id, &passport);
        self.record(&token_id, "minted", Some(pending.minter.clone()), Some(pending.bond), None);
        emit(
            "passport_created",
            json!({"token_id": token_id, "owner_id": pending.minter, "wallet_id": wallet_id,
                   "arbiter_id": pending.arbiter_id, "bond": pending.bond, "bounty": pending.bounty}),
        );
        let used = env::storage_usage().saturating_sub(before) as u128 * env::storage_byte_cost().as_yoctonear();
        if STORAGE_RESERVE > used {
            Promise::new(pending.minter).transfer(NearToken::from_yoctonear(STORAGE_RESERVE - used)).detach();
        }
        true
    }

    // ---------- NEP-171 core, with holder hooks ----------

    #[payable]
    pub fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>) {
        assert_one_yocto();
        self.assert_not_in_flight(&token_id);
        let sender = env::predecessor_account_id();
        let (old_owner, _) = self.tokens.internal_transfer(&sender, &receiver_id, &token_id, approval_id, memo);
        self.on_holder_changed(&token_id, &old_owner, &receiver_id, "transferred");
    }

    /// Standard transfer-and-call. While the receiver contract runs, the passport is locked: no release, withdrawal,
    /// report decision or further transfer can happen until `nft_resolve_transfer` settles who holds it.
    #[payable]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        assert_one_yocto();
        self.assert_not_in_flight(&token_id);
        let sender = env::predecessor_account_id();
        let (old_owner, _) = self.tokens.internal_transfer(&sender, &receiver_id, &token_id, approval_id, memo);
        self.on_holder_changed(&token_id, &old_owner, &receiver_id, "transferred");
        let mut p = self.passport(&token_id);
        p.in_flight_until_ns = Some(U64(now() + self.config.in_flight_timeout_ns.0));
        self.passports.insert(&token_id, &p);
        ext_nft_receiver::ext(receiver_id.clone())
            .with_unused_gas_weight(1)
            .nft_on_transfer(sender, old_owner.clone(), token_id.clone(), msg)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_RESOLVE_TRANSFER)
                    .with_unused_gas_weight(0)
                    .nft_resolve_transfer(old_owner, receiver_id, token_id, None),
            )
            .into()
    }

    #[private]
    pub fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<std::collections::HashMap<AccountId, u64>>,
    ) -> bool {
        let stayed = self.tokens.nft_resolve_transfer(
            previous_owner_id.clone(),
            receiver_id.clone(),
            token_id.clone(),
            approved_account_ids,
        );
        let mut p = self.passport(&token_id);
        p.in_flight_until_ns = None;
        self.passports.insert(&token_id, &p);
        if !stayed {
            self.on_holder_changed(&token_id, &receiver_id, &previous_owner_id, "transfer_reverted");
        }
        stayed
    }

    /// The token with live metadata: `extra` holds the current authority, wallet, bond, latest release and status.
    pub fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        let owner_id = self.tokens.owner_by_id.get(&token_id)?;
        let mut metadata = self.tokens.token_metadata_by_id.as_ref().and_then(|m| m.get(&token_id));
        if let (Some(m), Some(p)) = (metadata.as_mut(), self.passports.get(&token_id)) {
            let latest = p.versions.last().cloned();
            let status = latest
                .as_ref()
                .and_then(|v| self.releases.get(&release_key(&token_id, v)))
                .map(|r| verdict_of(&r.status))
                .unwrap_or("NO_RELEASE");
            m.extra = Some(
                json!({"authority": owner_id, "wallet": p.wallet_id, "arbiter": p.arbiter_id, "bond": p.bond_locked,
                       "bounty": p.bounty, "latest": latest, "latest_status": status, "holder_epoch": p.holder_epoch,
                       "open_reports": p.open_reports})
                .to_string(),
            );
        }
        Some(Token { token_id, owner_id, metadata, approved_account_ids: None })
    }

    pub fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit).into_iter().filter_map(|t| self.nft_token(t.token_id)).collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    pub fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, limit)
            .into_iter()
            .filter_map(|t| self.nft_token(t.token_id))
            .collect()
    }

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().unwrap()
    }

    // ---------- releases ----------

    /// Holder only. Attach storage for the new record (about 0.01 NEAR covers 16 files); the rest is refunded.
    #[payable]
    pub fn publish_release(&mut self, token_id: TokenId, version: String, files: Vec<Artifact>, source_url: Option<String>) {
        let holder = self.assert_holder(&token_id);
        let before = env::storage_usage();
        require!(valid_version(&version), "ERR_VERSION");
        let key = release_key(&token_id, &version);
        require!(self.releases.get(&key).is_none(), "ERR_VERSION_EXISTS");
        require!(!files.is_empty() && files.len() <= MAX_FILES, "ERR_FILES: 1-16 files");
        require!(source_url.as_ref().map_or(true, |s| s.len() <= 200), "ERR_SOURCE_URL");
        for f in &files {
            require!(!f.name.is_empty() && f.name.len() <= 128, "ERR_FILE_NAME");
            require!(valid_sha256(&f.sha256), "ERR_SHA256: 64 lowercase hex characters");
        }
        let mut p = self.passport(&token_id);
        require!(p.versions.len() < MAX_VERSIONS, "ERR_TOO_MANY_VERSIONS");
        p.versions.push(version.clone());
        for f in &files {
            let mut refs = self.digests.get(&f.sha256).unwrap_or_default();
            if refs.len() < MAX_REFS_PER_DIGEST {
                refs.push(DigestRef { token_id: token_id.clone(), version: version.clone(), file_name: f.name.clone() });
                self.digests.insert(&f.sha256, &refs);
            }
        }
        let release = Release {
            version: version.clone(),
            files,
            source_url,
            status: ReleaseStatus::Active,
            published_at_ns: U64(now()),
            published_by: holder.clone(),
            holder_epoch: p.holder_epoch,
        };
        self.releases.insert(&key, &release);
        self.passports.insert(&token_id, &p);
        self.record(&token_id, "release_published", None, None, Some(version.clone()));
        emit("release_published", json!({"token_id": token_id, "version": version, "files": release.files.len()}));
        charge_storage(before, env::attached_deposit().as_yoctonear(), &holder);
    }

    /// Holder only, 1 yoctoNEAR. Verifiers then see REVOKED for every file of this version.
    #[payable]
    pub fn revoke_release(&mut self, token_id: TokenId, version: String, reason: String) {
        assert_one_yocto();
        self.assert_holder(&token_id);
        require!(reason.len() <= 200, "ERR_REASON");
        let key = release_key(&token_id, &version);
        let mut r = self.releases.get(&key).expect("ERR_NO_RELEASE");
        require!(r.status == ReleaseStatus::Active, "ERR_NOT_ACTIVE");
        r.status = ReleaseStatus::Revoked { at_ns: U64(now()), reason: reason.clone() };
        self.releases.insert(&key, &r);
        self.record(&token_id, "release_revoked", None, None, Some(version.clone()));
        emit("release_revoked", json!({"token_id": token_id, "version": version, "reason": reason}));
    }

    // ---------- bond, earnings, withdrawals ----------

    /// Anyone can add to the bond. The money goes straight into the passport's account.
    #[payable]
    pub fn fund_bond(&mut self, token_id: TokenId) -> Promise {
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "ERR_DEPOSIT");
        let mut p = self.passport(&token_id);
        p.bond_locked = U128(p.bond_locked.0 + amount);
        self.passports.insert(&token_id, &p);
        self.record(&token_id, "bond_funded", Some(env::predecessor_account_id()), Some(U128(amount)), None);
        emit("bond_funded", json!({"token_id": token_id, "amount": U128(amount)}));
        Promise::new(p.wallet_id).transfer(NearToken::from_yoctonear(amount))
    }

    /// Anyone can pay a project. It belongs to whoever holds the passport when the money arrives.
    #[payable]
    pub fn sponsor(&mut self, token_id: TokenId, memo: Option<String>) -> Promise {
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "ERR_DEPOSIT");
        require!(memo.as_ref().map_or(true, |m| m.len() <= 100), "ERR_MEMO");
        let mut p = self.passport(&token_id);
        p.free_balance = U128(p.free_balance.0 + amount);
        p.total_earned = U128(p.total_earned.0 + amount);
        self.passports.insert(&token_id, &p);
        self.record(&token_id, "sponsored", Some(env::predecessor_account_id()), Some(U128(amount)), memo);
        emit("sponsored", json!({"token_id": token_id, "amount": U128(amount)}));
        Promise::new(p.wallet_id).transfer(NearToken::from_yoctonear(amount))
    }

    /// Holder only, 1 yoctoNEAR. Starts the withdrawal delay. Any transfer of the token cancels the request.
    #[payable]
    pub fn request_withdraw(&mut self, token_id: TokenId, amount: U128) {
        assert_one_yocto();
        let holder = self.assert_holder(&token_id);
        let mut p = self.passport(&token_id);
        require!(p.open_reports == 0, "ERR_OPEN_REPORTS");
        require!(amount.0 > 0 && amount.0 <= p.free_balance.0, "ERR_AMOUNT");
        let w = Withdrawal {
            requested_by: holder,
            holder_epoch: p.holder_epoch,
            amount,
            unlock_at_ns: U64(now() + self.config.withdraw_delay_ns.0),
        };
        p.pending_withdrawal = Some(w.clone());
        self.passports.insert(&token_id, &p);
        self.record(&token_id, "withdraw_requested", None, Some(amount), None);
        emit("withdraw_requested", json!({"token_id": token_id, "amount": amount, "unlock_at_ns": w.unlock_at_ns}));
    }

    #[payable]
    pub fn cancel_withdraw(&mut self, token_id: TokenId) {
        assert_one_yocto();
        self.assert_holder(&token_id);
        let mut p = self.passport(&token_id);
        require!(p.pending_withdrawal.take().is_some(), "ERR_NO_WITHDRAWAL");
        self.passports.insert(&token_id, &p);
        self.record(&token_id, "withdraw_cancelled", None, None, None);
        emit("withdraw_cancelled", json!({"token_id": token_id}));
    }

    /// Anyone may trigger it once the delay is over. Pays only the holder that asked, at the same holder epoch.
    pub fn execute_withdraw(&mut self, token_id: TokenId) -> PromiseOrValue<bool> {
        let mut p = self.passport(&token_id);
        let w = p.pending_withdrawal.clone().expect("ERR_NO_WITHDRAWAL");
        require!(now() >= w.unlock_at_ns.0, "ERR_NOT_YET");
        self.assert_not_in_flight(&token_id);
        let owner = self.owner_of(&token_id);
        p.pending_withdrawal = None;
        if w.requested_by != owner || w.holder_epoch != p.holder_epoch || p.open_reports > 0 || w.amount.0 > p.free_balance.0 {
            self.passports.insert(&token_id, &p);
            self.record(&token_id, "withdraw_dropped", Some(w.requested_by), Some(w.amount), None);
            return PromiseOrValue::Value(false);
        }
        p.free_balance = U128(p.free_balance.0 - w.amount.0);
        self.passports.insert(&token_id, &p);
        PromiseOrValue::Promise(self.start_payout(&token_id, owner, w.amount.0, "withdraw"))
    }

    #[private]
    pub fn on_payout(&mut self, token_id: TokenId, to: AccountId, amount: U128, kind: String) -> bool {
        let ok = env::promise_result_checked(0, 64).is_ok();
        let mut p = self.passport(&token_id);
        p.in_transit = U128(p.in_transit.0.saturating_sub(amount.0));
        if ok {
            p.total_paid_out = U128(p.total_paid_out.0 + amount.0);
        } else if kind == "bounty" {
            // Credited to the token, so to whoever holds it now, never to an earlier holder.
            p.bond_locked = U128(p.bond_locked.0 + amount.0);
        } else {
            p.free_balance = U128(p.free_balance.0 + amount.0);
        }
        self.passports.insert(&token_id, &p);
        let event = if ok { "payout_settled" } else { "payout_failed" };
        self.record(&token_id, event, Some(to.clone()), Some(amount), Some(kind.clone()));
        emit(event, json!({"token_id": token_id, "to": to, "amount": amount, "kind": kind}));
        ok
    }

    // ---------- tampering reports ----------

    /// Anyone. Attach at least the report stake plus storage (0.06 NEAR covers it); the stake is refunded if the report
    /// is confirmed or expires, and goes to the project if the arbiter rejects it.
    #[payable]
    pub fn file_report(
        &mut self,
        token_id: TokenId,
        version: String,
        observed_sha256: String,
        evidence_url: String,
        note: String,
    ) -> U64 {
        let before = env::storage_usage();
        let reporter = env::predecessor_account_id();
        let stake = self.config.report_stake.0;
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= stake, "ERR_STAKE");
        require!(valid_sha256(&observed_sha256), "ERR_SHA256");
        require!(evidence_url.len() <= 200 && note.len() <= 280, "ERR_TEXT_TOO_LONG");
        let release = self.releases.get(&release_key(&token_id, &version)).expect("ERR_NO_RELEASE");
        require!(!matches!(release.status, ReleaseStatus::Compromised { .. }), "ERR_ALREADY_COMPROMISED");
        let mut p = self.passport(&token_id);
        require!(p.report_ids.len() < MAX_REPORTS, "ERR_TOO_MANY_REPORTS");
        let id = self.next_report_id;
        self.next_report_id += 1;
        let report = Report {
            id,
            token_id: token_id.clone(),
            version: version.clone(),
            reporter: reporter.clone(),
            stake: U128(stake),
            observed_sha256,
            evidence_url,
            note,
            filed_at_ns: U64(now()),
            deadline_ns: U64(now() + self.config.report_window_ns.0),
            status: ReportStatus::Open,
        };
        self.reports.insert(&id, &report);
        p.open_reports += 1;
        p.report_ids.push(id);
        self.passports.insert(&token_id, &p);
        self.record(&token_id, "report_filed", Some(reporter.clone()), Some(U128(stake)), Some(id.to_string()));
        emit("report_filed", json!({"token_id": token_id, "version": version, "report_id": id, "reporter": reporter}));
        charge_storage(before, attached - stake, &reporter);
        U64(id)
    }

    /// The passport's arbiter, 1 yoctoNEAR. Confirming marks the release COMPROMISED for good and pays the bounty from
    /// the passport's own account to the reporter.
    #[payable]
    pub fn resolve_report(&mut self, report_id: u64, confirmed: bool, note: String) -> PromiseOrValue<bool> {
        assert_one_yocto();
        require!(note.len() <= 200, "ERR_NOTE");
        let report = self.open_report(report_id);
        let p = self.passport(&report.token_id);
        let caller = env::predecessor_account_id();
        require!(caller == p.arbiter_id, "ERR_NOT_ARBITER");
        self.assert_not_in_flight(&report.token_id);
        if confirmed {
            return PromiseOrValue::Promise(self.confirm_report(report, caller));
        }
        require!(p.arbiter_id != self.owner_of(&report.token_id), "ERR_ARBITER_IS_HOLDER");
        self.reject_report(report, caller);
        PromiseOrValue::Value(false)
    }

    /// The current holder admits a report against its own passport, 1 yoctoNEAR.
    #[payable]
    pub fn admit_report(&mut self, report_id: u64) -> Promise {
        assert_one_yocto();
        let report = self.open_report(report_id);
        let holder = self.assert_holder(&report.token_id);
        self.confirm_report(report, holder)
    }

    /// Anyone, after the report window: the reporter gets the stake back and withdrawals unfreeze.
    pub fn expire_report(&mut self, report_id: u64) -> Promise {
        let mut report = self.open_report(report_id);
        require!(now() >= report.deadline_ns.0, "ERR_NOT_YET");
        report.status = ReportStatus::Expired;
        self.reports.insert(&report_id, &report);
        let mut p = self.passport(&report.token_id);
        p.open_reports -= 1;
        self.passports.insert(&report.token_id, &p);
        self.record(&report.token_id, "report_expired", Some(report.reporter.clone()), None, Some(report_id.to_string()));
        emit("report_expired", json!({"report_id": report_id}));
        Promise::new(report.reporter).transfer(NearToken::from_yoctonear(report.stake.0))
    }

    // ---------- views ----------

    pub fn get_config(&self) -> Config {
        self.config.clone()
    }

    pub fn get_passport(&self, token_id: TokenId) -> Option<PassportView> {
        let passport = self.passports.get(&token_id)?;
        let owner_id = self.tokens.owner_by_id.get(&token_id)?;
        Some(PassportView {
            in_flight: passport.in_flight_until_ns.map_or(false, |t| now() < t.0),
            latest_version: passport.versions.last().cloned(),
            token_id,
            owner_id,
            passport,
        })
    }

    pub fn list_passports(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<PassportView> {
        self.tokens.nft_tokens(from_index, limit).into_iter().filter_map(|t| self.get_passport(t.token_id)).collect()
    }

    pub fn get_release(&self, token_id: TokenId, version: String) -> Option<Release> {
        self.releases.get(&release_key(&token_id, &version))
    }

    pub fn list_releases(&self, token_id: TokenId) -> Vec<Release> {
        self.passports
            .get(&token_id)
            .map(|p| p.versions.iter().filter_map(|v| self.releases.get(&release_key(&token_id, v))).collect())
            .unwrap_or_default()
    }

    /// Every passport release that lists a file with this digest, with the verdict for each.
    pub fn verify_digest(&self, sha256: String) -> Vec<DigestMatch> {
        let sha = sha256.to_ascii_lowercase();
        self.digests
            .get(&sha)
            .unwrap_or_default()
            .into_iter()
            .filter_map(|d| {
                let r = self.releases.get(&release_key(&d.token_id, &d.version))?;
                let p = self.passports.get(&d.token_id)?;
                Some(DigestMatch {
                    verdict: verdict_of(&r.status).to_string(),
                    owner_id: self.tokens.owner_by_id.get(&d.token_id)?,
                    token_id: d.token_id,
                    version: d.version,
                    file_name: d.file_name,
                    release_status: r.status,
                    wallet_id: p.wallet_id,
                    bond_locked: p.bond_locked,
                    arbiter_id: p.arbiter_id,
                })
            })
            .collect()
    }

    /// Checks one file against one release of one passport.
    pub fn verify_file(&self, token_id: TokenId, version: String, sha256: String) -> VerifyResult {
        let sha = sha256.to_ascii_lowercase();
        let unknown = VerifyResult { verdict: "UNKNOWN".into(), file_name: None, release_status: None, owner_id: None, bond_locked: None };
        let (Some(r), Some(p), Some(owner)) = (
            self.releases.get(&release_key(&token_id, &version)),
            self.passports.get(&token_id),
            self.tokens.owner_by_id.get(&token_id),
        ) else {
            return unknown;
        };
        match r.files.iter().find(|f| f.sha256 == sha) {
            Some(f) => VerifyResult {
                verdict: verdict_of(&r.status).into(),
                file_name: Some(f.name.clone()),
                release_status: Some(r.status.clone()),
                owner_id: Some(owner),
                bond_locked: Some(p.bond_locked),
            },
            None => VerifyResult {
                verdict: "MISMATCH".into(),
                file_name: None,
                release_status: Some(r.status.clone()),
                owner_id: Some(owner),
                bond_locked: Some(p.bond_locked),
            },
        }
    }

    pub fn passport_history(&self, token_id: TokenId, from_index: u32, limit: u32) -> Vec<HistoryEntry> {
        let len = self.passports.get(&token_id).map_or(0, |p| p.history_len);
        (from_index..len.min(from_index.saturating_add(limit.min(100))))
            .filter_map(|i| self.history.get(&format!("{token_id}#{i}")))
            .collect()
    }

    pub fn get_report(&self, report_id: u64) -> Option<Report> {
        self.reports.get(&report_id)
    }

    pub fn list_reports(&self, token_id: TokenId) -> Vec<Report> {
        self.passports
            .get(&token_id)
            .map(|p| p.report_ids.iter().filter_map(|id| self.reports.get(id)).collect())
            .unwrap_or_default()
    }

    pub fn is_holder(&self, token_id: TokenId, account_id: AccountId) -> bool {
        self.tokens.owner_by_id.get(&token_id).map_or(false, |o| o == account_id)
    }
}

impl Contract {
    fn passport(&self, token_id: &TokenId) -> Passport {
        self.passports.get(token_id).expect("ERR_NO_PASSPORT")
    }

    fn owner_of(&self, token_id: &TokenId) -> AccountId {
        self.tokens.owner_by_id.get(token_id).expect("ERR_NO_TOKEN")
    }

    fn assert_not_in_flight(&self, token_id: &TokenId) {
        if let Some(p) = self.passports.get(token_id) {
            if let Some(until) = p.in_flight_until_ns {
                require!(now() >= until.0, "ERR_IN_FLIGHT: a transfer_call is still settling");
            }
        }
    }

    /// Returns the caller if it is the current holder and the passport is not locked by a transfer_call.
    fn assert_holder(&self, token_id: &TokenId) -> AccountId {
        let caller = env::predecessor_account_id();
        require!(self.owner_of(token_id) == caller, "ERR_NOT_HOLDER");
        self.assert_not_in_flight(token_id);
        caller
    }

    fn open_report(&self, report_id: u64) -> Report {
        let r = self.reports.get(&report_id).expect("ERR_NO_REPORT");
        require!(r.status == ReportStatus::Open, "ERR_REPORT_CLOSED");
        r
    }

    fn on_holder_changed(&mut self, token_id: &TokenId, from: &AccountId, to: &AccountId, cause: &str) {
        let mut p = self.passport(token_id);
        p.holder_epoch += 1;
        let cancelled = p.pending_withdrawal.take();
        self.passports.insert(token_id, &p);
        if let Some(w) = cancelled {
            self.record(token_id, "withdraw_cancelled", Some(w.requested_by), Some(w.amount), None);
        }
        self.record(token_id, cause, Some(to.clone()), None, Some(from.to_string()));
        emit(
            "holder_changed",
            json!({"token_id": token_id, "old_owner_id": from, "new_owner_id": to, "holder_epoch": p.holder_epoch, "cause": cause}),
        );
    }

    /// Debits first, then asks the wallet to pay. `on_payout` settles or credits the token back.
    fn start_payout(&mut self, token_id: &TokenId, to: AccountId, amount: u128, kind: &str) -> Promise {
        let mut p = self.passport(token_id);
        p.in_transit = U128(p.in_transit.0 + amount);
        self.passports.insert(token_id, &p);
        self.record(token_id, "payout_started", Some(to.clone()), Some(U128(amount)), Some(kind.to_string()));
        Promise::new(p.wallet_id)
            .function_call("pay".to_string(), pay_args(&to, amount), NearToken::ZERO, GAS_PAY)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_PAYOUT).on_payout(
                token_id.clone(),
                to,
                U128(amount),
                kind.to_string(),
            ))
    }

    fn confirm_report(&mut self, mut report: Report, by: AccountId) -> Promise {
        let token_id = report.token_id.clone();
        let key = release_key(&token_id, &report.version);
        let mut release = self.releases.get(&key).expect("ERR_NO_RELEASE");
        release.status = ReleaseStatus::Compromised { at_ns: U64(now()), report_id: report.id };
        self.releases.insert(&key, &release);
        let mut p = self.passport(&token_id);
        let bounty = p.bounty.0.min(p.bond_locked.0);
        p.bond_locked = U128(p.bond_locked.0 - bounty);
        p.open_reports -= 1;
        self.passports.insert(&token_id, &p);
        report.status = ReportStatus::Confirmed { payout: U128(bounty), by: by.clone() };
        self.reports.insert(&report.id, &report);
        self.record(&token_id, "report_confirmed", Some(report.reporter.clone()), Some(U128(bounty)), Some(report.id.to_string()));
        emit(
            "release_compromised",
            json!({"token_id": token_id, "version": report.version, "report_id": report.id, "bounty": U128(bounty), "by": by}),
        );
        let refund = Promise::new(report.reporter.clone()).transfer(NearToken::from_yoctonear(report.stake.0));
        if bounty == 0 {
            return refund;
        }
        refund.detach();
        self.start_payout(&token_id, report.reporter, bounty, "bounty")
    }

    fn reject_report(&mut self, mut report: Report, by: AccountId) {
        let token_id = report.token_id.clone();
        report.status = ReportStatus::Rejected { by };
        self.reports.insert(&report.id, &report);
        let mut p = self.passport(&token_id);
        p.open_reports -= 1;
        p.free_balance = U128(p.free_balance.0 + report.stake.0);
        p.total_earned = U128(p.total_earned.0 + report.stake.0);
        let wallet = p.wallet_id.clone();
        self.passports.insert(&token_id, &p);
        self.record(&token_id, "report_rejected", Some(report.reporter.clone()), Some(report.stake), Some(report.id.to_string()));
        emit("report_resolved", json!({"report_id": report.id, "confirmed": false}));
        Promise::new(wallet).transfer(NearToken::from_yoctonear(report.stake.0)).detach();
    }

    fn record(&mut self, token_id: &TokenId, kind: &str, counterparty: Option<AccountId>, amount: Option<U128>, ref_id: Option<String>) {
        let mut p = self.passport(token_id);
        let seq = p.history_len;
        let entry = HistoryEntry {
            seq,
            at_ns: U64(now()),
            block_height: U64(env::block_height()),
            kind: kind.to_string(),
            actor: env::predecessor_account_id(),
            counterparty,
            amount,
            holder: self.owner_of(token_id),
            holder_epoch: p.holder_epoch,
            ref_id,
        };
        self.history.insert(&format!("{token_id}#{seq}"), &entry);
        p.history_len += 1;
        self.passports.insert(token_id, &p);
    }
}
