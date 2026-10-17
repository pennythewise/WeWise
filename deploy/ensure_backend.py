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
        # The public retrieval preview uses its approved local ledger. Tencent
        # memory is only enabled after a separate hosted service is configured.
        environment.pop('TENCENT_MEMORY_URL', None)
        environment.pop('TDAI_GATEWAY_API_KEY', None)
        with (DATA / 'backend.log').open('ab') as output:
            process = subprocess.Popen(
                [str(executable), '-m', 'uvicorn', 'backend.app.main:app', '--host', '0.0.0.0', '--port', '8017', '--proxy-headers', '--forwarded-allow-ips', '*'],
                cwd=PROJECT, env=environment, stdin=subprocess.DEVNULL,
                stdout=output, stderr=subprocess.STDOUT, start_new_session=True,
            )
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
