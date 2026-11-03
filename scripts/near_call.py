"""Testnet helper: signed calls through near-cli-rs (keys from the legacy keychain) and views over JSON-RPC.

  py scripts/near_call.py call <signer> <contract> <method> '<json>' <deposit NEAR> [gas Tgas]
  py scripts/near_call.py view <contract> <method> '<json>'
  py scripts/near_call.py keys <account>
  py scripts/near_call.py account <account>

JSON goes to near-cli-rs as base64, which avoids Windows shell quoting.
"""
import base64
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

RPC = "https://rpc.testnet.near.org"
NEAR_EXE = Path(__file__).resolve().parents[2] / "tools" / "node_modules" / "near-cli-rs" / "node_modules" / ".bin_real" / "near.exe"


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": "1", "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.loads(r.read())
    if "error" in out:
        raise SystemExit(json.dumps(out["error"], indent=1))
    return out["result"]


def view(contract, method, args):
    res = rpc("query", {"request_type": "call_function", "finality": "optimistic", "account_id": contract,
                        "method_name": method, "args_base64": base64.b64encode(json.dumps(args).encode()).decode()})
    raw = bytes(res["result"]).decode()
    return json.loads(raw) if raw else None


def call(signer, contract, method, args, deposit, gas="100"):
    b64 = base64.b64encode(json.dumps(args).encode()).decode()
    cmd = [str(NEAR_EXE), "contract", "call-function", "as-transaction", contract, method, "base64-args", b64,
           "prepaid-gas", f"{gas} Tgas", "attached-deposit", deposit, "sign-as", signer, "network-config", "testnet",
           "sign-with-legacy-keychain", "send"]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    text = p.stdout + p.stderr
    keep = [l for l in text.splitlines() if any(k in l for k in ("Transaction ID", "succeeded", "rror", "anicked", "Logs", "EVENT_JSON", "returned"))]
    print("\n".join(keep[:30]))
    return p.returncode


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "call":
        sys.exit(call(a[1], a[2], a[3], json.loads(a[4]), a[5], a[6] if len(a) > 6 else "100"))
    elif a[0] == "view":
        print(json.dumps(view(a[1], a[2], json.loads(a[3]) if len(a) > 3 else {}), indent=1))
    elif a[0] == "keys":
        print(json.dumps(rpc("query", {"request_type": "view_access_key_list", "finality": "final", "account_id": a[1]}), indent=1))
    elif a[0] == "account":
        print(json.dumps(rpc("query", {"request_type": "view_account", "finality": "final", "account_id": a[1]}), indent=1))
