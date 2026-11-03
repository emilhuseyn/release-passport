# Release Passport

A software project's release authority as an NFT that is also a NEAR account. Built at NEAR HACKATHON 2026, track
**NFTs That Do Something** (`nfts`).

Each project gets one NEP-171 token. The token is a real account, `<token>.rp.relpass-emilh.testnet`, created by the
contract with **no access keys**, and it holds the project's security bond. The passport lists every release and the sha256
of each file in it. Anyone can check a download against it before installing. If a release is shown to be tampered with, the
reporter is paid from the bond. Selling the token hands over the right to publish releases, the bond and the earnings, and the
seller keeps nothing: there is no key to keep, and the account obeys only the NFT contract, which obeys only the current holder.

The story behind it is the 2018 event-stream incident, where a maintainer handed an npm package to a stranger who shipped
malware to its users. With a passport, that handover is a visible on-chain transfer with a bond behind every later release.

Live on NEAR testnet: NFT contract `rp.relpass-emilh.testnet`, wallet code global contract
`8z9cDMVKjrEU9xs8oe8mkLRApz62ktHQTs8hSDqJ4vHg`.

## Try it in two minutes (no wallet, no keys, nothing signed)

Node 22 or later. Every command reads live testnet over public RPC.

1. The verifier checks itself. Its own file is release 0.1.0 of the `rp-verify` passport.
   ```
   node cli/rp-verify.mjs cli/rp-verify.mjs
   ```
   Expect `OK  rp-verify 0.1.0  cli/rp-verify.mjs  holder relpass-emilh.testnet  bond 1 NEAR` and exit code 0.

2. A tampered download is not vouched for by anyone.
   ```
   node cli/rp-verify.mjs samples/demo-tool-1.0.0-tampered.tgz
   ```
   Expect `UNKNOWN` and exit code 3.

3. A release with a confirmed tampering report is flagged for everyone, including people who hold the genuine file.
   ```
   node cli/rp-verify.mjs samples/demo-tool-1.0.0.tgz --token demo-tool --version 1.0.0
   ```
   Expect `COMPROMISED  demo-tool 1.0.0` and exit code 2. The reporter was paid 0.2 NEAR from the passport's own account.

4. The passport is an account that nobody can sign for.
   ```
   curl -s https://rpc.testnet.near.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_access_key_list","finality":"final","account_id":"demo-tool.rp.relpass-emilh.testnet"}}'
   ```
   Expect `"keys":[]`. The same account's `view_account` shows `global_contract_hash` `8z9cDMVK...` and a balance equal to the
   bond plus earnings in the passport's ledger.

5. The full story of one passport: mint, release, sponsorship, a report confirmed by the arbiter, the bounty paid, a sale,
   the seller's pending withdrawal cancelled by the sale, a release by the buyer, a withdrawal paid to the buyer.
   ```
   curl -s https://rpc.testnet.near.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"rp.relpass-emilh.testnet","method_name":"passport_history","args_base64":"eyJ0b2tlbl9pZCI6ImRlbW8tdG9vbCIsImZyb21faW5kZXgiOjAsImxpbWl0Ijo1MH0="}}'
   ```
   The result bytes decode to 14 entries from `minted` to `payout_settled`.

6. Unit tests, any OS with Rust 1.99:
   ```
   cargo test
   ```
   Expect 26 tests in `release_passport` and 3 in `passport_wallet`, all passing.

7. The web app (`web/`, `npm install && npm run dev`): Verify (drop a file, hashed in the browser), Passports, a passport
   page that shows the account's keys, code hash, real balance against the ledger and the contract's own keys, History,
   a holder console that only current holders can use, Report and Arbiter pages.

## How control passes on transfer, and what stops the seller from keeping it

The official track prompt asks this directly, so here is the short answer; [THREAT-MODEL.md](THREAT-MODEL.md) has every
attempt with the test that covers it.

- **No key to keep.** A contract-created account has no keys, and the wallet code has no method that adds one.
- **The wallet obeys one account.** `pay` panics with `ERR_NOT_PARENT` unless the caller is the NFT contract.
- **The NFT contract obeys the current holder.** Every release, withdrawal and report decision checks the owner at that
  moment. A transfer raises `holder_epoch` and cancels any pending withdrawal, so a request made before the sale can never
  pay out after it.
- **Money in flight follows the token.** A payout is debited before it starts. If it fails, the amount goes back to the
  token's ledger, so to whoever holds it then, never to an earlier holder.
- **No approvals.** NEP-178 is off, so a seller cannot leave an approval for a second account.
- **`nft_transfer_call` locks the passport** until `nft_resolve_transfer` settles who holds it, so a receiver contract
  cannot act as holder during `nft_on_transfer` and then hand the token back.
- **The arbiter is fixed at mint** and cannot be the minter. A confirmed report marks the release COMPROMISED forever, so
  draining the bond through a friendly arbiter is never silent.

One trust root remains and is shown on every passport page: whoever holds the full access key of the NFT contract account
can upgrade it. During the hackathon that is the operator's key, kept for fixes. After judging the key can be deleted,
which locks the contract.

## Design

| Piece | What it does |
|---|---|
| `contracts/passport_wallet` | Wallet for one passport, 9 KB, written against the raw NEAR host functions. Deployed once as an immutable global contract by code hash, so every passport account runs exactly this code. The near-sdk version was 95 KB, and a global contract burns 10 NEAR per 100 KB. |
| `contracts/release_passport` | NEP-171 contract (near-sdk 5.29.1, near-contract-standards). Mints by creating the sub-account with the bond, attaching the global wallet and checking `parent_id` in one batch, then minting in the callback. Releases with per-file digests and a digest index, revoke, bond, sponsorships, two-phase withdrawals, stake-backed tampering reports with an arbiter, transfer hooks, a `transfer_call` lock, per-token history, NEP-297 events, live NFT metadata in `extra`. |
| `cli/rp-verify.mjs` | Zero-dependency verifier: streams the file through sha256 and asks the contract. |
| `web/` | Vite and `@hot-labs/near-connect`. Reads go to public RPC, writes through the user's wallet. |

Demo settings: report window 15 minutes, withdrawal delay 2 minutes, transfer_call lock timeout 10 minutes, minimum bond
0.5 NEAR, minimum bounty 0.1 NEAR, report stake 0.05 NEAR. Real deployments would use days.

## Build

```
cargo test
cargo near build non-reproducible-wasm --no-abi      # in each contract folder
cargo build -p passport_wallet --target wasm32-unknown-unknown --release
```

On Windows with the GNU toolchain the ABI step of cargo-near fails to link, so `--no-abi` is required there.

## Honest notes

- Testnet only. The demo personas (`relpass-emilh`, `relpass-buyer-emilh`, `relpass-reporter-emilh`,
  `relpass-arbiter-emilh`) are all run by the author.
- The arbiter is a person or a DAO you trust to read evidence. Release Passport does not detect tampering by itself; it
  makes the claim, the decision and the payout public and bonded.
- AI-assisted code: the contracts, tests, CLI and web app were written with Claude Code (Anthropic) and reviewed by the
  author, as the hackathon rules allow (Q-005).
- Libraries: near-sdk 5.29.1, near-contract-standards 5.29.1, @hot-labs/near-connect 0.11.4, Vite 8.3.4.
- The author's other NEAR HACKATHON project is [Patch Fund](https://github.com/emilhuseyn/patch-fund) (track Social
  Money), an independent codebase.

MIT licence.
