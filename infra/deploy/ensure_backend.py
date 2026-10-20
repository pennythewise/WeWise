"""Restart the installed retrieval backend after a persistent Sandbox resume.

Called with fixed arguments by the OIDC-authenticated gateway. No model API,
package installation, repository download, or caller-provided command runs here.
"""
from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

from ensure_memory import ensure_memory

PROJECT = Path('/vercel/WeWise')
DATA = Path('/vercel/wewise-data')
HEALTH = 'http://127.0.0.1:8017/api/health'


def ready() -> bool:
    try:
        with urllib.request.urlopen(HEALTH, timeout=2) as response:
            state = json.load(response)
        ai = state.get('ai', {})
        return state.get('status') == 'ok' and ai.get('configured') is False and ai.get('retrieval_only_enforced') is True
    except Exception:
        return False


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    # A lite preview (operator marker file) runs without the optional memory sidecar and local embeddings,
    # falling back to lexical retrieval. The full team preview keeps both as hard requirements.
    lite = (DATA / 'allow-lite').is_file()
    try:
        memory_environment = ensure_memory()
    except RuntimeError:
        if not lite:
            raise
        memory_environment = {}
    with (DATA / 'backend-start.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if ready():
            print('backend_ready')
            return
        executable = PROJECT / '.venv/bin/python'
        if not executable.is_file() or not (PROJECT / 'backend/app/main.py').is_file():
            raise RuntimeError('Backend installation required by deployment operator.')
        environment = dict(os.environ)
        environment.update({
            'WEWISE_DATA_DIR': str(DATA),
            'WEWISE_RETRIEVAL_ONLY': '1',
            'WEWISE_SEED_DEMO': '0',
            'WEWISE_DEMO_WORKSPACES': '1',
            'WEWISE_ENV': 'production',
            'COOKIE_SECURE': '1',
            'WEWISE_ALLOWED_ORIGINS': os.getenv('PUBLIC_ORIGIN', 'https://wewise-retrieval-preview.vercel.app'),
        })
        # Runtime installation is an operator action. Requests only resume the
        # pinned local services and never download weights or package source.
        embedding_dir = DATA / 'models/multilingual-e5-small'
        if (embedding_dir / 'model_quantized.onnx').is_file() and (embedding_dir / 'tokenizer.json').is_file():
            environment['WEWISE_EMBEDDING_DIR'] = str(embedding_dir)
        elif not lite:
            raise RuntimeError('Pinned local embedding assets require operator installation.')
        environment.update(memory_environment)
        # On-chain proofs: the operator places CHAIN_* settings (mode 0600) on the VM; the key never enters Git or the browser.
        chain_env = DATA / 'chain.env'
        if chain_env.is_file():
            for line in chain_env.read_text().splitlines():
                key, sep, value = line.partition('=')
                if sep and key.strip().startswith('CHAIN_'):
                    environment[key.strip()] = value.strip()
        with (DATA / 'backend.log').open('ab') as output:
            process = subprocess.Popen(
                [str(executable), '-m', 'uvicorn', 'backend.app.main:app', '--host', '0.0.0.0', '--port', '8017', '--proxy-headers', '--forwarded-allow-ips', '*'],
                cwd=PROJECT, env=environment, stdin=subprocess.DEVNULL,
                stdout=output, stderr=subprocess.STDOUT, start_new_session=True,
            )
        (DATA / 'backend.pid').write_text(str(process.pid))
        for _ in range(75):
            if ready():
                print('backend_started')
                return
            if process.poll() is not None:
                raise RuntimeError('Backend failed to start; deployment operator must inspect its private log.')
            time.sleep(0.4)
        raise RuntimeError('Backend startup timeout.')


if __name__ == '__main__':
    main()
