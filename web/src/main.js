// Release Passport web app. Reads go straight to public NEAR RPC; writes go through the user's wallet (near-connect).
// Everything shown comes from the contract, and every action is enforced by the contract, not by this page.
import { NearConnector } from "@hot-labs/near-connect";

const CONTRACT = "rp.relpass-emilh.testnet";
const RPCS = ["https://rpc.testnet.near.org", "https://test.rpc.fastnear.com"];
const EXPLORER = "https://testnet.nearblocks.io";
const TGAS = 1_000_000_000_000n;
const YOCTO = 10n ** 24n;

const appRoot = document.getElementById("app");
document.getElementById("contract-id").textContent = CONTRACT;

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? esc(u) : "#");
const near = (y) => {
  if (y === undefined || y === null) return "-";
  const v = BigInt(y);
  const whole = v / YOCTO;
  const frac = ((v % YOCTO) * 10_000n) / YOCTO;
  return `${whole}.${frac.toString().padStart(4, "0")}`.replace(/\.?0+$/, "") || "0";
};
const toYocto = (n) => {
  const [w, f = ""] = String(n).trim().split(".");
  return (BigInt(w || "0") * YOCTO + BigInt((f + "0".repeat(24)).slice(0, 24))).toString();
};
const when = (ns) => (ns ? new Date(Number(BigInt(ns) / 1_000_000n)).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "-");
const acct = (a) => (a ? `<a class="mono" href="${EXPLORER}/address/${esc(a)}" target="_blank" rel="noopener">${esc(a)}</a>` : "-");
const statusName = (s) => (typeof s === "string" ? s : Object.keys(s || {})[0] || "-");
const verdictOf = (s) => ({ Active: "OK", Revoked: "REVOKED", Compromised: "COMPROMISED" })[statusName(s)] || "UNKNOWN";
const tag = (v) => `<span class="tag v-${esc(v)}">${esc(v)}</span>`;

async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "rp", method, params }),
      });
      const out = await res.json();
      if (out.error) throw new Error(out.error.data || out.error.message || JSON.stringify(out.error));
      return out.result;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

async function view(method, args = {}, contract = CONTRACT) {
  const r = await rpc("query", {
    request_type: "call_function",
    finality: "optimistic",
    account_id: contract,
    method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  });
  const text = new TextDecoder().decode(new Uint8Array(r.result));
  return text ? JSON.parse(text) : null;
}

const viewAccount = (id) => rpc("query", { request_type: "view_account", finality: "final", account_id: id });
const viewKeys = (id) => rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: id });

async function sha256Hex(file) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- wallet ----------

const connector = new NearConnector({ network: "testnet" });
let account = null;
const walletBtn = document.getElementById("wallet");

function setAccount(id) {
  account = id;
  walletBtn.textContent = id ? `${id} · sign out` : "Connect wallet";
}

connector.on("wallet:signIn", (t) => {
  setAccount(t.accounts?.[0]?.accountId || null);
  route();
});
connector.on("wallet:signOut", () => {
  setAccount(null);
  route();
});
(async () => {
  try {
    const w = await connector.wallet();
    const accs = await w.getAccounts();
    if (accs?.length) setAccount(accs[0].accountId);
    route();
  } catch {
    /* not signed in */
  }
})();

walletBtn.addEventListener("click", async () => {
  try {
    if (account) {
      const w = await connector.wallet();
      await w.signOut();
      setAccount(null);
      route();
    } else {
      await connector.connect();
    }
  } catch (e) {
    alert(`Wallet: ${e.message || e}`);
  }
});

async function callContract(methodName, args, depositYocto = "0", gasTgas = 100n) {
  if (!account) throw new Error("Connect a testnet wallet first.");
  const w = await connector.wallet();
  return w.signAndSendTransaction({
    receiverId: CONTRACT,
    actions: [
      { type: "FunctionCall", params: { methodName, args, gas: (gasTgas * TGAS).toString(), deposit: depositYocto } },
    ],
  });
}

async function act(button, fn) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Waiting for wallet...";
  try {
    await fn();
    button.textContent = "Done";
    setTimeout(route, 1500);
  } catch (e) {
    button.disabled = false;
    button.textContent = label;
    alert(e.message || String(e));
  }
}

// ---------- pages ----------

function verdictCard(v, body) {
  const meaning = {
    OK: "The file matches an active release in a Release Passport.",
    REVOKED: "The project's current holder revoked this release. Do not install it.",
    COMPROMISED: "An arbiter confirmed a tampering report against this release. Do not install it.",
    UNKNOWN: "No Release Passport lists this file. Do not install it on the passport's word.",
    MISMATCH: "This release exists, but it lists no file with this digest.",
  }[v];
  return `<div class="verdict v-${esc(v)}"><div class="big">${esc(v)}</div><p>${meaning}</p>${body || ""}</div>`;
}

async function pageVerify(app) {
  app.innerHTML = `
    <h1>Check a download before you install it</h1>
    <p class="lede">Drop a release file here. Your browser computes its sha256 locally, nothing is uploaded, and the
    Release Passport contract on NEAR testnet says whether a project vouches for that exact file.</p>
    <label class="drop" id="drop">
      <input type="file" id="file" />
      <strong>Drop a file</strong> or click to choose one
      <div class="muted" id="hash"></div>
    </label>
    <div class="row" style="margin-top:12px">
      <span class="muted">No file at hand?</span>
      <button class="btn ghost" id="try-good" type="button">Check a published release</button>
      <button class="btn ghost" id="try-bad" type="button">Check a tampered copy</button>
    </div>
    <div id="result"></div>
    <h2>Or from a terminal</h2>
    <div class="panel"><code>node cli/rp-verify.mjs samples/demo-tool-1.0.0.tgz</code>
      <p class="muted">No wallet, no dependencies. Exit code 0 OK, 2 revoked or compromised, 3 unknown.</p></div>`;
  const drop = app.querySelector("#drop");
  const input = app.querySelector("#file");
  const check = async (file) => {
    const out = app.querySelector("#result");
    app.querySelector("#hash").textContent = "hashing...";
    const sha = await sha256Hex(file);
    app.querySelector("#hash").innerHTML = `<span class="mono">${sha}</span> · ${esc(file.name)}`;
    out.innerHTML = `<p class="muted">Asking the contract...</p>`;
    try {
      const matches = await view("verify_digest", { sha256: sha });
      if (!matches.length) return (out.innerHTML = verdictCard("UNKNOWN"));
      out.innerHTML = matches
        .map((m) =>
          verdictCard(
            m.verdict,
            `<dl class="kv" style="margin-top:10px">
              <dt>Passport</dt><dd><a href="#/p/${esc(m.token_id)}">${esc(m.token_id)}</a> · version ${esc(m.version)} · ${esc(m.file_name)}</dd>
              <dt>Current holder</dt><dd>${acct(m.owner_id)}</dd>
              <dt>Security bond</dt><dd>${near(m.bond_locked)} NEAR in ${acct(m.wallet_id)}</dd>
              <dt>Arbiter</dt><dd>${acct(m.arbiter_id)}</dd>
            </dl>`,
          ),
        )
        .join("");
    } catch (e) {
      out.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    }
  };
  input.addEventListener("change", () => input.files[0] && check(input.files[0]));
  const sample = async (name) => {
    const blob = await (await fetch(`./samples/${name}`)).blob();
    check(new File([blob], name));
  };
  app.querySelector("#try-good").onclick = () => sample("rp-verify.mjs");
  app.querySelector("#try-bad").onclick = () => sample("demo-tool-1.0.0-tampered.tgz");
  // Deep links for judges: #/?try=good, #/?try=bad, #/?try=compromised run a sample check on load.
  const tryIt = new URLSearchParams(location.hash.split("?")[1] || "").get("try");
  if (tryIt === "good") sample("rp-verify.mjs");
  if (tryIt === "bad") sample("demo-tool-1.0.0-tampered.tgz");
  if (tryIt === "compromised") sample("demo-tool-1.0.0.tgz");
  drop.addEventListener("dragover", (e) => (e.preventDefault(), drop.classList.add("over")));
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    if (e.dataTransfer.files[0]) check(e.dataTransfer.files[0]);
  });
}

async function pagePassports(app) {
  app.innerHTML = `<h1>Passports</h1><p class="lede">Every passport is an NFT and a NEAR account with no keys.</p><div id="list">Loading...</div>`;
  const list = await view("list_passports", { from_index: "0", limit: 50 });
  app.querySelector("#list").innerHTML = list.length
    ? `<table><tr><th>Passport</th><th>Holder</th><th>Bond</th><th>Latest</th><th>Reports</th></tr>${list
        .map(
          (p) => `<tr><td><a href="#/p/${esc(p.token_id)}">${esc(p.token_id)}</a><div class="muted">${esc(p.title)}</div></td>
          <td>${acct(p.owner_id)}</td><td>${near(p.bond_locked)} NEAR</td><td>${esc(p.latest_version || "-")}</td>
          <td>${p.open_reports} open / ${p.report_ids.length}</td></tr>`,
        )
        .join("")}</table>`
    : `<p class="muted">No passports yet.</p>`;
}

async function pagePassport(app, token) {
  app.innerHTML = `<p class="muted">Loading ${esc(token)}...</p>`;
  const p = await view("get_passport", { token_id: token });
  if (!p) return (app.innerHTML = `<h1>${esc(token)}</h1><p>No such passport.</p>`);
  const [releases, reports, wallet, keys, contractKeys, parent] = await Promise.all([
    view("list_releases", { token_id: token }),
    view("list_reports", { token_id: token }),
    viewAccount(p.wallet_id),
    viewKeys(p.wallet_id),
    viewKeys(CONTRACT),
    view("parent_id", {}, p.wallet_id).catch(() => null),
  ]);
  const ledger = BigInt(p.bond_locked) + BigInt(p.free_balance) + BigInt(p.in_transit);
  app.innerHTML = `
    <h1>${esc(p.title)} <span class="muted mono">${esc(token)}</span></h1>
    <p class="lede"><a href="${safeUrl(p.repo_url)}" target="_blank" rel="noopener">${esc(p.repo_url)}</a> ·
      <a href="#/p/${esc(token)}/history">history</a></p>
    <div class="grid">
      <div class="panel"><div class="muted">Current holder</div>${acct(p.owner_id)}<div class="muted">holder epoch ${p.holder_epoch}</div></div>
      <div class="panel"><div class="muted">Security bond</div><strong>${near(p.bond_locked)} NEAR</strong><div class="muted">bounty per confirmed report ${near(p.bounty)} NEAR</div></div>
      <div class="panel"><div class="muted">Withdrawable earnings</div><strong>${near(p.free_balance)} NEAR</strong><div class="muted">earned ${near(p.total_earned)}, paid out ${near(p.total_paid_out)}</div></div>
      <div class="panel"><div class="muted">Arbiter (fixed at mint)</div>${acct(p.arbiter_id)}<div class="muted">${p.open_reports} open reports</div></div>
    </div>
    <h2>The passport is an account</h2>
    <div class="panel"><dl class="kv">
      <dt>Account</dt><dd>${acct(p.wallet_id)}</dd>
      <dt>Access keys</dt><dd>${keys.keys.length === 0 ? `<strong>none</strong> · nobody can sign for this account, so no seller can keep a key` : `<span class="error">${keys.keys.length} key(s)</span>`}</dd>
      <dt>Code</dt><dd>global contract <span class="mono">${esc(wallet.global_contract_hash || wallet.code_hash)}</span> (immutable, by hash)</dd>
      <dt>Obeys</dt><dd>${parent ? acct(parent) : "-"} only</dd>
      <dt>Real balance</dt><dd>${near(wallet.amount)} NEAR · ledger says ${near(ledger.toString())} NEAR</dd>
      <dt>Trust root</dt><dd>the NFT contract ${acct(CONTRACT)} has ${contractKeys.keys.length} access key(s); whoever holds them can upgrade it</dd>
    </dl></div>
    ${p.pending_withdrawal ? `<div class="notice">Pending withdrawal of ${near(p.pending_withdrawal.amount)} NEAR by ${esc(p.pending_withdrawal.requested_by)}, unlocks ${when(p.pending_withdrawal.unlock_at_ns)}. Any transfer cancels it.</div>` : ""}
    <h2>Releases</h2>
    ${releases.length ? releases.map((r) => `<div class="panel" style="margin-bottom:10px">
      <div class="row"><strong>${esc(r.version)}</strong> ${tag(verdictOf(r.status))} <span class="muted">published ${when(r.published_at_ns)} by ${esc(r.published_by)}</span></div>
      ${statusName(r.status) === "Revoked" ? `<p class="muted">Reason: ${esc(r.status.Revoked.reason)}</p>` : ""}
      <table><tr><th>File</th><th>sha256</th></tr>${r.files.map((f) => `<tr><td>${esc(f.name)}</td><td class="mono">${esc(f.sha256)}</td></tr>`).join("")}</table>
    </div>`).join("") : `<p class="muted">No releases yet.</p>`}
    <h2>Tampering reports</h2>
    ${reports.length ? `<table><tr><th>#</th><th>Version</th><th>Reporter</th><th>Status</th><th>Note</th></tr>${reports.map((r) => `<tr>
      <td>${r.id}</td><td>${esc(r.version)}</td><td>${acct(r.reporter)}</td><td>${esc(statusName(r.status))}${r.status.Confirmed ? ` · bounty ${near(r.status.Confirmed.payout)} NEAR` : ""}</td>
      <td>${esc(r.note)} ${r.evidence_url ? `<a href="${safeUrl(r.evidence_url)}" target="_blank" rel="noopener">evidence</a>` : ""}</td></tr>`).join("")}</table>` : `<p class="muted">No reports.</p>`}
    <h2>Support this project</h2>
    <div class="row"><input type="text" id="amt" value="0.1" size="6" /> NEAR
      <button class="btn" id="sponsor">Sponsor (goes to the current holder)</button>
      <button class="btn ghost" id="fund">Add to the bond</button></div>`;
  app.querySelector("#sponsor").onclick = (e) =>
    act(e.target, () => callContract("sponsor", { token_id: token, memo: null }, toYocto(app.querySelector("#amt").value), 50n));
  app.querySelector("#fund").onclick = (e) =>
    act(e.target, () => callContract("fund_bond", { token_id: token }, toYocto(app.querySelector("#amt").value), 50n));
}

async function pageHistory(app, token) {
  app.innerHTML = `<p class="muted">Loading...</p>`;
  const [p, h] = await Promise.all([view("get_passport", { token_id: token }), view("passport_history", { token_id: token, from_index: 0, limit: 100 })]);
  app.innerHTML = `<h1>History of <a href="#/p/${esc(token)}">${esc(token)}</a></h1>
    <p class="lede">Every mint, release, payment, report and change of holder, read from the contract. Earned ${near(p?.total_earned)} NEAR, paid out ${near(p?.total_paid_out)} NEAR.</p>
    <table><tr><th>#</th><th>When</th><th>What</th><th>By</th><th>Counterparty</th><th>Amount</th><th>Holder after</th></tr>
    ${h.map((e) => `<tr><td>${e.seq}</td><td>${when(e.at_ns)}</td><td>${esc(e.kind.replaceAll("_", " "))}${e.ref_id ? ` <span class="muted">${esc(e.ref_id)}</span>` : ""}</td>
      <td>${acct(e.actor)}</td><td>${acct(e.counterparty)}</td><td>${e.amount ? `${near(e.amount)} NEAR` : ""}</td><td>${acct(e.holder)} <span class="muted">epoch ${e.holder_epoch}</span></td></tr>`).join("")}
    </table>`;
}

async function pageConsole(app) {
  if (!account) {
    app.innerHTML = `<h1>Holder console</h1><p class="lede">Only current passport holders can use this page. Connect a NEAR testnet wallet.</p>
      <button class="btn" id="go">Connect wallet</button>`;
    app.querySelector("#go").onclick = () => connector.connect();
    return;
  }
  const owned = await view("nft_tokens_for_owner", { account_id: account, from_index: "0", limit: 50 });
  if (!owned.length) {
    app.innerHTML = `<h1>Holder console</h1><div class="notice">Not a current holder of any passport. If you sold one, its releases,
      bond and earnings now answer to the buyer, and the contract rejects every action from you.</div>`;
    return;
  }
  app.innerHTML = `<h1>Holder console</h1><p class="lede">Signed in as ${acct(account)}. The contract checks holdership again on every call.</p><div id="tokens" class="stack"></div>`;
  for (const t of owned) {
    const p = await view("get_passport", { token_id: t.token_id });
    const el = document.createElement("div");
    el.className = "panel";
    el.innerHTML = `<h2 style="margin-top:0"><a href="#/p/${esc(t.token_id)}">${esc(t.token_id)}</a></h2>
      <form class="pub"><strong>Publish a release</strong>
        <label>Version <input type="text" name="version" placeholder="1.2.0" required /></label>
        <label>Files (hashed in your browser) <input type="file" name="files" multiple required /></label>
        <label>Source URL <input type="text" name="src" placeholder="https://github.com/..." /></label>
        <button class="btn">Publish</button></form>
      <h2>Revoke a release</h2>
      <div class="row"><select class="rv">${p.versions.map((v) => `<option>${esc(v)}</option>`).join("")}</select>
        <input type="text" class="reason" placeholder="reason" /><button class="btn ghost revoke">Revoke</button></div>
      <h2>Earnings: ${near(p.free_balance)} NEAR withdrawable</h2>
      <div class="row"><input type="text" class="wamt" value="${near(p.free_balance)}" size="8" /> NEAR
        <button class="btn ghost req">Request withdrawal</button><button class="btn ghost exe">Execute</button><button class="btn ghost can">Cancel</button></div>
      ${p.pending_withdrawal ? `<p class="muted">Pending ${near(p.pending_withdrawal.amount)} NEAR, unlocks ${when(p.pending_withdrawal.unlock_at_ns)}</p>` : ""}
      <h2>Transfer (hands over authority, bond and earnings)</h2>
      <div class="row"><input type="text" class="to" placeholder="buyer.testnet" /><button class="btn ghost xfer">Transfer</button></div>`;
    app.querySelector("#tokens").appendChild(el);
    const id = t.token_id;
    el.querySelector(".pub").onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      act(f.querySelector("button"), async () => {
        const files = [];
        for (const file of f.files.files) files.push({ name: file.name, sha256: await sha256Hex(file), size: String(file.size) });
        await callContract("publish_release", { token_id: id, version: f.version.value.trim(), files, source_url: f.src.value.trim() || null }, toYocto("0.02"));
      });
    };
    el.querySelector(".revoke").onclick = (e) =>
      act(e.target, () => callContract("revoke_release", { token_id: id, version: el.querySelector(".rv").value, reason: el.querySelector(".reason").value || "revoked by holder" }, "1"));
    el.querySelector(".req").onclick = (e) =>
      act(e.target, () => callContract("request_withdraw", { token_id: id, amount: toYocto(el.querySelector(".wamt").value) }, "1"));
    el.querySelector(".exe").onclick = (e) => act(e.target, () => callContract("execute_withdraw", { token_id: id }, "0"));
    el.querySelector(".can").onclick = (e) => act(e.target, () => callContract("cancel_withdraw", { token_id: id }, "1"));
    el.querySelector(".xfer").onclick = (e) =>
      act(e.target, () => callContract("nft_transfer", { receiver_id: el.querySelector(".to").value.trim(), token_id: id }, "1"));
  }
}

async function pageReport(app) {
  const cfg = await view("get_config");
  app.innerHTML = `<h1>Report a tampered release</h1>
    <p class="lede">You saw a file that claims to be a release but differs from its passport. Stake ${near(cfg.report_stake)} NEAR.
    If the passport's arbiter confirms, the release is marked COMPROMISED for everyone and you receive the bounty from the
    passport's own account plus your stake back. If the window ends without a decision, your stake comes back.</p>
    <form id="rep">
      <label>Passport <input type="text" name="token" placeholder="demo-tool" required /></label>
      <label>Version <input type="text" name="version" placeholder="1.0.0" required /></label>
      <label>The file you received (hashed locally) <input type="file" name="file" required /></label>
      <label>Evidence URL <input type="text" name="evidence" placeholder="https://..." /></label>
      <label>What is wrong <textarea name="note" rows="3" maxlength="280"></textarea></label>
      <button class="btn">File report</button></form>`;
  app.querySelector("#rep").onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    act(f.querySelector("button"), async () =>
      callContract(
        "file_report",
        { token_id: f.token.value.trim(), version: f.version.value.trim(), observed_sha256: await sha256Hex(f.file.files[0]), evidence_url: f.evidence.value.trim(), note: f.note.value.trim() },
        (BigInt(cfg.report_stake) + BigInt(toYocto("0.01"))).toString(),
      ),
    );
  };
}

async function pageArbiter(app) {
  if (!account) {
    app.innerHTML = `<h1>Arbiter</h1><p class="lede">Arbiters confirm or reject tampering reports for the passports that named them. Connect a testnet wallet.</p>`;
    return;
  }
  const list = await view("list_passports", { from_index: "0", limit: 50 });
  const mine = list.filter((p) => p.arbiter_id === account);
  const reports = (await Promise.all(mine.map((p) => view("list_reports", { token_id: p.token_id })))).flat().filter((r) => r.status === "Open");
  app.innerHTML = `<h1>Arbiter</h1><p class="lede">Signed in as ${acct(account)}. You arbitrate ${mine.length} passport(s).</p>
    ${reports.length ? reports.map((r) => `<div class="panel" style="margin-bottom:10px" data-id="${r.id}">
      <strong>#${r.id} · ${esc(r.token_id)} ${esc(r.version)}</strong> <span class="muted">by ${esc(r.reporter)}, deadline ${when(r.deadline_ns)}</span>
      <p>${esc(r.note)}</p><p class="mono">observed ${esc(r.observed_sha256)}</p>
      ${r.evidence_url ? `<p><a href="${safeUrl(r.evidence_url)}" target="_blank" rel="noopener">evidence</a></p>` : ""}
      <div class="row"><button class="btn yes">Confirm tampering</button><button class="btn ghost no">Reject</button></div></div>`).join("") : `<p class="muted">No open reports.</p>`}`;
  app.querySelectorAll("[data-id]").forEach((el) => {
    const id = Number(el.dataset.id);
    el.querySelector(".yes").onclick = (e) => act(e.target, () => callContract("resolve_report", { report_id: id, confirmed: true, note: "confirmed" }, "1"));
    el.querySelector(".no").onclick = (e) => act(e.target, () => callContract("resolve_report", { report_id: id, confirmed: false, note: "rejected" }, "1"));
  });
}

// ---------- router ----------

async function route() {
  const h = location.hash.replace(/^#/, "").split("?")[0] || "/";
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${h}`));
  // A fresh container per navigation: a slow page that finishes late writes into a detached element, not over this one.
  const app = document.createElement("div");
  appRoot.replaceChildren(app);
  try {
    let m;
    if (h === "/") await pageVerify(app);
    else if (h === "/passports") await pagePassports(app);
    else if ((m = h.match(/^\/p\/([a-z0-9-]+)\/history$/))) await pageHistory(app, m[1]);
    else if ((m = h.match(/^\/p\/([a-z0-9-]+)$/))) await pagePassport(app, m[1]);
    else if (h === "/console") await pageConsole(app);
    else if (h === "/report") await pageReport(app);
    else if (h === "/arbiter") await pageArbiter(app);
    else app.innerHTML = `<p>Not found. <a href="#/">Verify a file</a></p>`;
  } catch (e) {
    app.innerHTML = `<p class="error">${esc(e.message || e)}</p>`;
  }
}

window.addEventListener("hashchange", route);
route();
