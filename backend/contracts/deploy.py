"""Deploy ProofRegistry to an EVM-compatible JSON-RPC endpoint and print the CHAIN_* settings to use.

    CHAIN_RPC_URL=http://127.0.0.1:8545 CHAIN_SUBMITTER_KEY=0x... python backend/contracts/deploy.py

Works with FISCO BCOS nodes that expose the web3-compatible RPC, and with Hardhat or Anvil for local runs.
The bytecode is compiled for the `paris` EVM (no PUSH0) so it stays compatible with consortium chains.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from web3 import Web3

BUILD = Path(__file__).resolve().parent / "build" / "ProofRegistry.json"


def main():
    w3 = Web3(Web3.HTTPProvider(os.environ["CHAIN_RPC_URL"], request_kwargs={"timeout": 30}))
    if w3.eth.chain_id in {1, 10, 56, 137, 8453, 42161}:
        raise SystemExit("Refusing to deploy on a mainnet with real funds. Use a testnet or a consortium chain.")
    account = w3.eth.account.from_key(os.environ["CHAIN_SUBMITTER_KEY"])
    build = json.loads(BUILD.read_text())
    factory = w3.eth.contract(abi=build["abi"], bytecode=build["bytecode"])
    tx = factory.constructor().build_transaction({"from": account.address, "nonce": w3.eth.get_transaction_count(account.address), "chainId": w3.eth.chain_id})
    receipt = w3.eth.wait_for_transaction_receipt(w3.eth.send_raw_transaction(account.sign_transaction(tx).raw_transaction), timeout=60)
    if receipt["status"] != 1:
        raise SystemExit("Deployment reverted.")
    print(f"ProofRegistry deployed at block {receipt['blockNumber']}")
    print("CHAIN_MODE=evm")
    print(f"CHAIN_CONTRACT={receipt['contractAddress']}")
    print(f"CHAIN_SUBMITTER (admin and first submitter)={account.address}")


if __name__ == "__main__":
    main()
