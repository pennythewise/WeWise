"""Resume the operator-installed, loopback-only Tencent approved-memory mirror.

This helper never installs packages, downloads source, processes a conversation,
or accepts caller-supplied paths. The application approval ledger is authoritative.
"""
from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import time
import urllib.error
import urllib.request

PROJECT = Path('/vercel/WeWise')
DATA = Path('/vercel/wewise-data')
VENDOR = Path('/vercel/wewise-runtime/tencent-agent-memory')
CORE = VENDOR / 'MemoryCore'
PIN = 'e9a82935b52741e0c798c75326e90b7144eb4d5f'
URL = 'http://127.0.0.1:8420'
KEY_FILE = DATA / 'tencent-gateway.key'


def private_key() -> str:
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    if KEY_FILE.is_symlink():
        raise RuntimeError('Private memory credential path must be a regular file.')
    if not KEY_FILE.exists():
        descriptor = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w') as output:
            output.write(secrets.token_urlsafe(48))
    KEY_FILE.chmod(0o600)
    key = KEY_FILE.read_text().strip()
    if len(key) < 40:
        raise RuntimeError('Private memory credential is invalid.')
    return key


def ready(key: str) -> bool:
    try:
        with urllib.request.urlopen(URL + '/health', timeout=2) as response:
            info = json.load(response)
        if info.get('status') not in {'ok', 'healthy'}:
            return False
        request = urllib.request.Request(URL + '/v3/core/read', data=json.dumps({'team_id': 'wewise_service_health', 'agent_id': 'wewise_service_health', 'user_id': 'wewise_service_health'}).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'x-tdai-service-id': 'wewise-hackathon'})
        with urllib.request.urlopen(request, timeout=2) as response:
            return json.load(response).get('code') == 0
    except Exception:
        return False


def ensure_memory() -> dict[str, str]:
    key = private_key()
    with (DATA / 'memory-start.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if not ready(key):
            node = shutil.which('node')
            if not node or not (CORE / 'node_modules/tsx').is_dir():
                raise RuntimeError('Pinned Tencent runtime must be installed by the deployment operator.')
            revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=VENDOR, capture_output=True, text=True, check=True).stdout.strip()
            if revision != PIN:
                raise RuntimeError('Tencent runtime differs from the reviewed pinned revision.')
            memory_dir = DATA / 'tencent'
            memory_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            environment = dict(os.environ)
            for name in ('OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DASHSCOPE_API_KEY', 'TDAI_LLM_API_KEY', 'LLM_API_KEY'):
                environment.pop(name, None)
            environment.update({'TDAI_GATEWAY_CONFIG': str(PROJECT / 'backend/tencent-memory.yaml'), 'TDAI_DATA_DIR': str(memory_dir), 'TDAI_GATEWAY_HOST': '127.0.0.1', 'TDAI_GATEWAY_PORT': '8420', 'TDAI_GATEWAY_API_KEY': key, 'V3_STRICT_ISOLATION': 'true', 'TDAI_LLM_BASE_URL': 'http://127.0.0.1:9/v1', 'TDAI_LLM_API_KEY': ''})
            # Do not persist upstream stdout/stderr: it may contain user data.
            process = subprocess.Popen([node, '--import', 'tsx', 'src/gateway/server.ts'], cwd=CORE, env=environment, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            (DATA / 'memory.pid').write_text(str(process.pid))
            for _ in range(70):
                if ready(key):
                    break
                if process.poll() is not None:
                    raise RuntimeError('Private memory runtime failed to start.')
                time.sleep(.4)
            else:
                raise RuntimeError('Private memory runtime startup timeout.')
    return {'TENCENT_MEMORY_URL': URL, 'TDAI_GATEWAY_API_KEY': key}


if __name__ == '__main__':
    ensure_memory()
    print('private_memory_ready')
