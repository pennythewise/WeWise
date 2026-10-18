import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'deploy'))
from provider_config import load_provider_environment, configuration_id


def test_private_config_and_invalid_fallback(tmp_path):
    target = tmp_path / 'providers.json'
    assert load_provider_environment(target) == {'WEWISE_RETRIEVAL_ONLY': '1'}
    environment = {'WEWISE_RETRIEVAL_ONLY': '0', 'AI_PROVIDER': 'anthropic', 'AI_MODEL': 'test-model', 'ANTHROPIC_API_KEY': 'fake-test-key'}
    target.write_text(json.dumps({'version': 1, 'environment': environment}))
    target.chmod(0o600)
    assert load_provider_environment(target) == environment
    changed = {**environment, 'ANTHROPIC_API_KEY': 'different-fake-key'}
    assert configuration_id(environment) != configuration_id(changed)
    for invalid in ({**environment, 'PATH': '/bad'}, {**environment, 'AI_PROVIDER':'evil'}, {**environment, 'ANTHROPIC_BASE_URL': 'https://attacker.invalid'}, {**environment, 'ANTHROPIC_API_KEY':'bad\nkey'}):
        target.write_text(json.dumps({'version': 1, 'environment': invalid}))
        assert load_provider_environment(target) == {'WEWISE_RETRIEVAL_ONLY': '1'}
    target.write_text('not json')
    assert load_provider_environment(target) == {'WEWISE_RETRIEVAL_ONLY': '1'}


def test_no_symlink_or_world_readable_secret(tmp_path):
    import os
    if os.name == 'nt':
        return
    target = tmp_path / 'providers.json'
    target.write_text('{}')
    target.chmod(0o644)
    assert load_provider_environment(target) == {'WEWISE_RETRIEVAL_ONLY': '1'}
    link = tmp_path / 'link'
    link.symlink_to(target)
    assert load_provider_environment(link) == {'WEWISE_RETRIEVAL_ONLY': '1'}
