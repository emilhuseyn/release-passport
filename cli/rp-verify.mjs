#!/usr/bin/env node
// Checks a downloaded file against Release Passport on NEAR testnet before you install it. No dependencies, no wallet,
// nothing signed: it hashes the file and asks the contract over public RPC.
//
//   node cli/rp-verify.mjs <file> [--token demo-tool --version 1.0.0] [--contract rp.relpass-emilh.testnet] [--rpc URL]
//
// Exit codes: 0 OK, 2 REVOKED or COMPROMISED, 3 MISMATCH or UNKNOWN, 1 error.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const file = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const contract = opt("contract", "rp.relpass-emilh.testnet");
const rpcs = [opt("rpc", "https://rpc.testnet.near.org"), "https://test.rpc.fastnear.com"];
const token = opt("token");
const version = opt("version");

if (!file) {
  console.error("usage: node cli/rp-verify.mjs <file> [--token <id> --version <v>] [--contract <account>] [--rpc <url>]");
  process.exit(1);
}

const sha256 = await new Promise((resolve, reject) => {
  const h = createHash("sha256");
  createReadStream(file).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
});

async function view(method, params) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "rp",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: contract,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(params)).toString("base64"),
    },
  });
  let lastError;
  for (const url of rpcs) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const out = await res.json();
      if (out.error) throw new Error(JSON.stringify(out.error));
      return JSON.parse(Buffer.from(out.result.result).toString());
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const near = (yocto) => (Number(BigInt(yocto) / 10n ** 20n) / 10_000).toString();
const exitFor = { OK: 0, REVOKED: 2, COMPROMISED: 2, MISMATCH: 3, UNKNOWN: 3 };

try {
  console.log(`sha256 ${sha256}  ${file}`);
  if (token && version) {
    const r = await view("verify_file", { token_id: token, version, sha256 });
    const who = r.owner_id ? `  holder ${r.owner_id}  bond ${near(r.bond_locked)} NEAR` : "";
    console.log(`${r.verdict}  ${token} ${version}${r.file_name ? `  ${r.file_name}` : ""}${who}`);
    process.exit(exitFor[r.verdict] ?? 1);
  }
  const matches = await view("verify_digest", { sha256 });
  if (matches.length === 0) {
    console.log("UNKNOWN  no Release Passport lists this file. Do not install it on the passport's word.");
    process.exit(3);
  }
  for (const m of matches) {
    console.log(`${m.verdict}  ${m.token_id} ${m.version}  ${m.file_name}  holder ${m.owner_id}  bond ${near(m.bond_locked)} NEAR  arbiter ${m.arbiter_id}`);
  }
  console.log(`passport: https://testnet.nearblocks.io/address/${matches[0].wallet_id}`);
  const worst = matches.some((m) => m.verdict !== "OK") ? matches.find((m) => m.verdict !== "OK").verdict : "OK";
  process.exit(exitFor[worst]);
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
