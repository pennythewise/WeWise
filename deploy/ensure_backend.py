"""Restart the installed backend after a persistent Sandbox resume.

Called with fixed arguments by the OIDC-authenticated gateway. No model API,
package installation, repository download, or caller-provided command runs here.
"""
from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

from ensure_memory import ensure_memory
from provider_config import PROVIDER_ENV, load_provider_environment, configuration_id

PROJECT = Path('/vercel/WeWise')
DATA = Path('/vercel/wewise-data')
HEALTH = 'http://127.0.0.1:8017/api/health'


def ready(provider_environment, expected_id) -> bool:
    try:
        with urllib.request.urlopen(HEALTH, timeout=2) as response:
            state = json.load(response)
        ai = state.get('ai', {})
        stamp = DATA / 'backend-config.id'
        if not stamp.is_file() or stamp.read_text().strip() != expected_id:
            return False
        retrieval = provider_environment.get('WEWISE_RETRIEVAL_ONLY') != '0'
        return state.get('status') == 'ok' and (
            ai.get('configured') is False and ai.get('retrieval_only_enforced') is True if retrieval
            else ai.get('configured') is True and ai.get('provider') == 'anthropic' and ai.get('model') == provider_environment.get('AI_MODEL'))
    except Exception:
        return False


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    provider_environment = load_provider_environment()
    expected_id = configuration_id(provider_environment)
    memory_environment = ensure_memory()
    with (DATA / 'backend-start.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if ready(provider_environment, expected_id):
            print('backend_ready')
            return
        executable = PROJECT / '.venv/bin/python'
        if not executable.is_file() or not (PROJECT / 'backend/app/main.py').is_file():
            raise RuntimeError('Backend installation required by deployment operator.')
        environment = dict(os.environ)
        # No inherited provider credentials: only the reviewed private file
        # controls activation. The memory sidecar receives none of these.
        for name in (*PROVIDER_ENV, 'AI_API_KEY', 'AI_ENDPOINT', 'AI_BASE_URL', 'OPENAI_API_KEY'):
            environment.pop(name, None)
        environment.update({
            'WEWISE_DATA_DIR': str(DATA),
            'WEWISE_SEED_DEMO': '0',
            'WEWISE_DEMO_WORKSPACES': '1',
            'WEWISE_ENV': 'production',
            'COOKIE_SECURE': '1',
            'WEWISE_ALLOWED_ORIGINS': os.getenv('PUBLIC_ORIGIN', 'https://wewise-retrieval-preview.vercel.app'),
        })
        environment.update(provider_environment)
        # Runtime installation is an operator action. Requests only resume the
        # pinned local services and never download weights or package source.
        embedding_dir = DATA / 'models/multilingual-e5-small'
        if not (embedding_dir / 'model_quantized.onnx').is_file() or not (embedding_dir / 'tokenizer.json').is_file():
            raise RuntimeError('Pinned local embedding assets require operator installation.')
        environment['WEWISE_EMBEDDING_DIR'] = str(embedding_dir)
        environment.update(memory_environment)
        # Reconfiguration must replace only this application's exact uvicorn
        # command. A stale/untrusted pid file cannot select another process.
        expected_command = [str(executable).encode(), b'-m', b'uvicorn', b'backend.app.main:app']
        stopping = []
        for candidate in Path('/proc').glob('[0-9]*/cmdline'):
            try:
                if candidate.read_bytes().split(b'\0')[:4] == expected_command:
                    os.kill(int(candidate.parent.name), signal.SIGTERM)
                    stopping.append(candidate)
            except (OSError, ValueError):
                pass
        deadline = time.monotonic() + 3
        while stopping:
            remaining = []
            for candidate in stopping:
                try:
                    if candidate.read_bytes().split(b'\0')[:4] == expected_command:
                        if time.monotonic() >= deadline:
                            os.kill(int(candidate.parent.name), signal.SIGKILL)
                        remaining.append(candidate)
                except (OSError, ValueError):
                    pass
            stopping = remaining
            if stopping:
                time.sleep(.1)
        stamp = DATA / 'backend-config.id'
        stamp.write_text(expected_id)
        stamp.chmod(0o600)
        with (DATA / 'backend.log').open('ab') as output:
            process = subprocess.Popen(
                [str(executable), '-m', 'uvicorn', 'backend.app.main:app', '--host', '0.0.0.0', '--port', '8017', '--proxy-headers', '--forwarded-allow-ips', '*'],
                cwd=PROJECT, env=environment, stdin=subprocess.DEVNULL,
                stdout=output, stderr=subprocess.STDOUT, start_new_session=True,
            )
        (DATA / 'backend.pid').write_text(str(process.pid))
        for _ in range(75):
            if ready(provider_environment, expected_id):
                print('backend_started')
                return
            if process.poll() is not None:
                raise RuntimeError('Backend failed to start; deployment operator must inspect its private log.')
            time.sleep(0.4)
        raise RuntimeError('Backend startup timeout.')


if __name__ == '__main__':
    main()
