"""Load only deployment-operator provider settings from a private local file.

The gateway accepts no provider settings from callers. Absent or invalid
configuration always selects retrieval-only mode. Credentials stay outside
the checkout, source bundles, gateway requests and public health responses.
"""
import hashlib
import json
import os
from pathlib import Path
import stat

PROVIDER_ENV = frozenset({
    'WEWISE_RETRIEVAL_ONLY', 'AI_PROVIDER', 'AI_MODEL', 'ANTHROPIC_BASE_URL',
    'ANTHROPIC_API_KEY', 'TYPESAFE_API_KEY', 'TYPESAFE_MODEL',
    'WEWISE_CLAUDE_DAILY_LIMIT', 'WEWISE_JEV_DAILY_LIMIT',
})
FALLBACK = {'WEWISE_RETRIEVAL_ONLY': '1'}


def load_provider_environment(path=Path('/vercel/wewise-data/providers.json')):
    path = Path(path)
    try:
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or (os.name != 'nt' and info.st_mode & 0o077) or info.st_size > 16384:
            return dict(FALLBACK)
        config = json.loads(path.read_text())
        environment = config.get('environment')
        if config.get('version') != 1 or not isinstance(environment, dict) or not set(environment) <= PROVIDER_ENV:
            return dict(FALLBACK)
        if any(not isinstance(v, str) or any(ord(c) < 32 for c in v) for v in environment.values()):
            return dict(FALLBACK)
        if environment.get('WEWISE_RETRIEVAL_ONLY') != '0':
            return dict(FALLBACK)
        # This prototype enables native Claude only. Other endpoint/provider
        # migrations require a reviewed operator change, never a user URL.
        if environment.get('AI_PROVIDER') != 'anthropic' or environment.get('ANTHROPIC_BASE_URL', 'https://api.anthropic.com') != 'https://api.anthropic.com':
            return dict(FALLBACK)
        if not environment.get('ANTHROPIC_API_KEY', '').strip() or not environment.get('AI_MODEL', '').strip():
            return dict(FALLBACK)
        return dict(environment)
    except (OSError, ValueError, AttributeError, TypeError):
        return dict(FALLBACK)


def configuration_id(environment):
    # Internal restart comparison only. Never return this key-derived digest
    # through health or other public endpoints.
    return hashlib.sha256(json.dumps(environment, sort_keys=True).encode()).hexdigest()
