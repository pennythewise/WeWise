"""Install a pinned local multilingual encoder, never customer documents."""
from __future__ import annotations
import argparse
import hashlib
import os
from pathlib import Path
import sys

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.semantic_retrieval import MODEL, REVISION, WEIGHTS_SHA256, TOKENIZER_SHA256


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()
    destination = Path(args.directory).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    sources = [("onnx/model_quantized.onnx", "model_quantized.onnx", WEIGHTS_SHA256), ("tokenizer.json", "tokenizer.json", TOKENIZER_SHA256)]
    with httpx.Client(timeout=180, follow_redirects=True) as client:
        for remote, name, expected in sources:
            path = destination / name
            if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == expected:
                print(name + ": verified", flush=True)
                continue
            temp = destination / (name + ".download")
            digest = hashlib.sha256()
            with client.stream("GET", f"https://huggingface.co/{MODEL}/resolve/{REVISION}/{remote}") as response:
                response.raise_for_status()
                with temp.open("wb") as output:
                    for block in response.iter_bytes(1024 * 1024):
                        output.write(block); digest.update(block)
            if digest.hexdigest() != expected:
                temp.unlink(missing_ok=True)
                raise RuntimeError("Downloaded embedding asset hash did not match the pinned revision.")
            os.replace(temp, path)
            print(name + ": installed and verified", flush=True)
    print("Local multilingual assets ready. Set WEWISE_EMBEDDING_DIR to this operator-owned directory.")


if __name__ == "__main__":
    main()
