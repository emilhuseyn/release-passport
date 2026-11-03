# Threat model: how a seller could try to keep the money or the authority

Written before the code, as the track prompt asks, and updated to what was built. The last column names a unit test in
`contracts/release_passport/src/tests.rs` or `contracts/passport_wallet/src/lib.rs`, or a check run on testnet.

| # | Seller attempt | What stops it | Test |
|---|---|---|---|
| T1 | Keep a key on the passport account | The contract creates the account, which has no keys, and the wallet code has no method that adds one | testnet: `view_access_key_list` on `demo-tool.rp.relpass-emilh.testnet` is empty |
| T2 | Redeploy the wallet with a backdoor | No keys means nobody can sign a deploy; the code is a global contract by hash, which is immutable | testnet: `view_account` shows `global_contract_hash` `8z9cDMVK...` |
| T3 | Call the wallet directly | `pay` requires the caller to be the parent account (the NFT contract) | `previous_holder_cannot_pay_itself`; testnet: holder's direct `pay` failed with `ERR_NOT_PARENT` |
| T4 | Withdraw the bond just before selling | The bond is never withdrawable; only earnings are, and only after a request and a delay that the buyer can see | `bond_is_never_withdrawable`, `withdrawal_waits_for_the_delay` |
| T5 | Withdraw after the sale with a request made before it | Any transfer clears the pending request; `execute_withdraw` also re-checks requester and holder epoch | `transfer_raises_epoch_and_cancels_pending_withdrawal`; testnet: seller's request cancelled by the sale |
| T6 | Sell, buy back, reuse the old request | The epoch changed twice and the request was cleared at the first transfer | `stale_request_after_sale_and_buyback_pays_nothing` |
| T7 | A payout is in flight at the moment of sale | The ledger is debited when the payout starts; a failed payout is credited back to the token, so to the new holder | `sale_in_the_middle_of_a_failed_withdrawal_credits_the_new_holder`, `sale_in_the_middle_of_a_settled_withdrawal`, `sale_in_the_middle_of_a_failed_bounty_restores_the_bond_on_the_token` |
| T8 | Keep an approval for a second account | NEP-178 approvals are disabled; only the owner can transfer | `nobody_but_the_holder_can_transfer` |
| T9 | `nft_transfer_call` to an own contract that acts as holder during `nft_on_transfer`, then returns the token | The passport is locked until `nft_resolve_transfer`; the lock also expires on its own if the resolve never runs | `passport_is_locked_while_a_transfer_call_settles`, `transfer_call_returned_by_receiver_goes_back_and_unlocks`, `transfer_call_kept_by_receiver_unlocks_for_the_receiver` |
| T10 | Drain the bond through a fake report and a friendly arbiter | The arbiter is fixed at mint and cannot be the minter; a confirmed report marks the release COMPROMISED forever, so the drain is public; the bounty per report is capped | `minter_cannot_be_its_own_arbiter`, `confirmed_report_pays_bounty_and_freezes_nothing_after` |
| T11 | Replace the arbiter before selling | No method changes the arbiter | code review: no setter exists |
| T12 | Escape a pending report by selling | The report and the bond move with the token; withdrawals stay frozen until it is resolved or expires; an arbiter that bought the passport cannot reject reports against it | `report_survives_a_sale_and_rejection_pays_the_new_holder`, `open_report_freezes_withdrawals`, `arbiter_that_bought_the_passport_cannot_reject_reports` |
| T13 | Delete the passport account to recover the funds | The wallet has no delete method and no keys | code review |
| T14 | Burn and re-mint the token to recapture the account | There is no burn; creating an existing account fails and the mint callback refunds everything | `failed_wallet_creation_mints_nothing` |
| T15 | Keep sponsorships that arrive after the sale | A sponsorship is credited to the token when it arrives, so to the holder at that moment | `transfer_raises_epoch_and_cancels_pending_withdrawal` (sponsorship then transfer) |
| T16 | Seller is the NFT contract's deployer and upgrades it | Not solved on-chain during the hackathon. Disclosed: the passport page shows the contract account's keys. After judging the key can be deleted, which locks the contract | README |
| T17 | Keep off-chain authority such as npm or GitHub tokens | Out of scope. Verifiers who check the passport reject releases the old holder publishes after the sale, because `publish_release` checks the current owner | `previous_holder_cannot_publish_after_sale`; testnet: seller's publish failed with `ERR_NOT_HOLDER` |

Other risks, not specific to a seller: a seller can publish a bad release just before selling, and the buyer's bond then
answers for it (the buyer reads the release list and `published_by` first); storage griefing is bounded by deposits and caps
(16 files per release, 64 versions, 64 reports per passport).

Money is also checked as a whole: `assert_conserved` in the tests requires bond + earnings + in transit + paid out to equal
everything that came in, after every interleaving above. On testnet, the passport account's real balance equals the ledger.
