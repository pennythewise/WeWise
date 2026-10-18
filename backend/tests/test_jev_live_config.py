"""No live provider calls: mocked HTTP cannot establish live verification."""
import asyncio
import json

import httpx
import pytest

from backend.app import jev_adapter as jev


@pytest.fixture(autouse=True)
def isolated_jev(monkeypatch):
    monkeypatch.setenv("TYPESAFE_API_KEY", "fixture-not-a-real-key")
    monkeypatch.setenv("TYPESAFE_MODEL", "jev-latest")
    monkeypatch.delenv("WEWISE_RETRIEVAL_ONLY", raising=False)
    monkeypatch.setattr(jev, "_live_receipts", {})


def envelope(*, confidence=.9, choice="buying", criteria=None):
    criteria = criteria or jev.INTENTS
    probabilities = {key: .9 if key == choice else .1/(len(criteria)-1) for key in criteria}
    return {"model": "jev-1.13.0", "answers": {"intent": {"type": "choice", "choice": choice, "confidence": confidence, "probabilities": probabilities}}, "usage": {"input_tokens": 90, "output_tokens": 18}}


@pytest.mark.task
def test_key_configuration_does_not_claim_live_verification():
    health = jev.jev_health()
    assert health["configured"] and not health["verified_live"]
    assert health["last_live_success"] is None


@pytest.mark.task
def test_valid_mocked_response_is_advisory_not_live_verification():
    result = asyncio.run(jev.suggest("compare insurance", transport=httpx.MockTransport(lambda request: httpx.Response(200, json=envelope()))))
    assert result["used"] and result["suggestion"] == "buying"
    assert result["model"] == "jev-1.13.0"
    assert result["usage"]["input_tokens"] == 90
    assert not jev.jev_health()["verified_live"]


@pytest.mark.task
def test_recorded_success_only_applies_to_current_key_model_and_enabled_mode(monkeypatch):
    # A hand-created local receipt tests health scoping only; no network occurs.
    jev._live_receipts[jev._configuration_id()] = {"at": "synthetic-test", "model": "jev-fixture", "question": "intent"}
    assert jev.jev_health()["verified_live"]
    monkeypatch.setenv("TYPESAFE_MODEL", "jev-preview")
    assert not jev.jev_health()["verified_live"]
    monkeypatch.setenv("TYPESAFE_MODEL", "jev-latest")
    monkeypatch.setenv("TYPESAFE_API_KEY", "rotated-fixture-key")
    assert not jev.jev_health()["verified_live"]
    monkeypatch.setenv("TYPESAFE_API_KEY", "fixture-not-a-real-key")
    monkeypatch.setenv("WEWISE_RETRIEVAL_ONLY", "1")
    assert not jev.jev_health()["configured"] and not jev.jev_health()["verified_live"]


@pytest.mark.attack
@pytest.mark.parametrize("choice", [[], {}, None, True, 1, "arbitrary_command"])
def test_non_string_and_unlisted_choice_fails_without_raising(choice):
    data = envelope()["answers"]["intent"]
    data["choice"] = choice
    assert jev.validated_choice(data, jev.INTENTS) is None


@pytest.mark.attack
@pytest.mark.parametrize("patch", [
    {"model": None}, {"model": "<html>provider error</html>"}, {"answers": []},
    {"usage": {"input_tokens": True, "output_tokens": 12}},
    {"usage": {"input_tokens": -1, "output_tokens": 12}}, {"usage": {}},
])
def test_invalid_http_envelope_is_not_a_success(patch):
    result = asyncio.run(jev.suggest("insurance", transport=httpx.MockTransport(lambda request: httpx.Response(200, json=envelope() | patch))))
    assert not result["used"] and result["reason"] == "invalid_provider_response"
    assert not jev.jev_health()["verified_live"]


@pytest.mark.task
def test_low_confidence_valid_response_abstains_with_safe_metadata():
    result = asyncio.run(jev.suggest("ambiguous", transport=httpx.MockTransport(lambda request: httpx.Response(200, json=envelope(confidence=.2)))))
    assert not result["used"] and result["provider_response_valid"] is True
    assert result["reason"] == "invalid_or_uncertain_choice"


@pytest.mark.attack
def test_probability_distribution_must_sum_to_one():
    answer = envelope()["answers"]["intent"]
    answer["probabilities"]["buying"] = .91
    assert jev.validated_choice(answer, jev.INTENTS) is None


@pytest.mark.attack
def test_inconsistent_confidence_cannot_inflate_the_distribution_gate():
    data = envelope()["answers"]["intent"]
    data["confidence"] = .99
    data["probabilities"] = {key: .76 if key == "buying" else .24/(len(jev.INTENTS)-1) for key in jev.INTENTS}
    assert jev.validated_choice(data, jev.INTENTS) is None


@pytest.mark.task
def test_document_classifier_features_contain_no_original_values_or_names():
    text = "Patient: Fictional Alice\nHospital: Private clinic\nDiagnosis: sensitive narrative\nInvoice: 123456 JPY\nPolicy number: P-SECRET\nEmail: alice@example.com"
    features = jev.classification_features(text)
    assert set(features) == {"medical_record", "invoice", "policy_schedule"}
    assert not any(value in json.dumps(features) for value in ("Fictional", "Alice", "123456", "SECRET", "sensitive", "alice@"))


@pytest.mark.attack
def test_common_reference_and_contact_data_are_minimized():
    result = jev.minimized_text("usr_abcdef pol_abcdef doc_abcdef user@example.com 13812345678 Bearer sk-secretfixture")
    assert "abcdef" not in result and "user@example.com" not in result and "13812345678" not in result and "sk-secretfixture" not in result


@pytest.mark.attack
def test_exhausted_persistent_budget_prevents_any_http_client(monkeypatch):
    from backend.app import provider_limits
    calls = []
    monkeypatch.setattr(provider_limits, "reserve", lambda provider: calls.append(provider) or False)
    def forbidden(*args, **kwargs):
        pytest.fail("Budget denial must occur before constructing the HTTP client")
    monkeypatch.setattr(jev.httpx, "AsyncClient", forbidden)
    result = asyncio.run(jev.suggest("compare my insurance"))
    assert result["used"] is False and result["reason"] == "budget_exhausted"
    assert calls == ["jev"] and not jev.jev_health()["verified_live"]


@pytest.mark.attack
def test_unauthorized_provider_keeps_fallback_and_does_not_echo_error_body():
    result = asyncio.run(jev.suggest("insurance question", transport=httpx.MockTransport(lambda request: httpx.Response(401, json={"detail": "private-provider-error-fixture"}))))
    assert result["used"] is False and result["reason"] == "provider_unavailable_or_invalid"
    assert "private-provider-error-fixture" not in json.dumps(result)
    assert jev.jev_health()["configured"] is True and jev.jev_health()["verified_live"] is False
