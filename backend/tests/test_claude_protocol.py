"""Offline Claude contracts; these fixtures are never live-provider evidence."""
import asyncio
import json

import httpx
import pytest

from backend.app import intelligence, provider_limits


def configure_claude(monkeypatch):
    monkeypatch.delenv("WEWISE_RETRIEVAL_ONLY", raising=False)
    monkeypatch.setenv("AI_PROVIDER", "anthropic")
    monkeypatch.setenv("AI_MODEL", "fixture-claude-not-a-live-model")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-offline-key-never-sent")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://claude-fixture.invalid")
    monkeypatch.setattr(intelligence, "_PROVIDER_RECEIPTS", {})
    monkeypatch.setattr(provider_limits, "reserve", lambda provider: True)


def install_response(monkeypatch, payload, capture=None):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return payload

    class OfflineClient:
        def __init__(self, **kwargs):
            assert kwargs["follow_redirects"] is False

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            if capture is not None:
                capture.append((url, kwargs))
            return Response()

    monkeypatch.setattr(intelligence.httpx, "AsyncClient", OfflineClient)


@pytest.mark.task
@pytest.mark.parametrize("base,expected", [
    ("https://claude-fixture.invalid", "https://claude-fixture.invalid/v1/messages"),
    ("https://claude-fixture.invalid/v1/", "https://claude-fixture.invalid/v1/messages"),
    ("https://claude-fixture.invalid/v1/messages", "https://claude-fixture.invalid/v1/messages"),
    ("https://claude-fixture.invalid/proxy/v1", "https://claude-fixture.invalid/proxy/v1/messages"),
])
def test_claude_endpoint_forms_use_native_messages_contract(monkeypatch, base, expected):
    configure_claude(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_BASE_URL", base)
    captured = []
    install_response(monkeypatch, {"stop_reason": "end_turn", "content": [{"type": "text", "text": '{"translation":"Fixture only."}'}]}, captured)
    output = asyncio.run(intelligence.request_json("Fixture instructions", "Fixture data"))
    assert output == {"translation": "Fixture only."}
    url, request = captured[0]
    assert url == expected
    assert request["headers"]["anthropic-version"] == "2023-06-01"
    assert request["headers"]["x-api-key"] == "fake-offline-key-never-sent"
    assert request["json"]["messages"] == [{"role": "user", "content": "Fixture data"}]
    assert request["json"]["system"] == "Fixture instructions"
    assert request["json"]["max_tokens"] == 1500
    assert "tools" not in request["json"]
    assert intelligence.ai_config()["live_verified"] is False


@pytest.mark.task
def test_claude_mock_transport_cannot_create_live_receipt(monkeypatch):
    configure_claude(monkeypatch)
    original_client = intelligence._NETWORK_HTTP_CLIENT

    def fixture_response(request):
        return httpx.Response(200, json={"stop_reason": "end_turn", "content": [{"type": "text", "text": '{"fixture":true}'}]})

    monkeypatch.setattr(intelligence.httpx, "AsyncClient", lambda **kwargs: original_client(transport=httpx.MockTransport(fixture_response), **kwargs))
    assert asyncio.run(intelligence.request_json("Fixture", "{}")) == {"fixture": True}
    assert intelligence.ai_config()["live_verified"] is False


@pytest.mark.attack
@pytest.mark.parametrize("base", [
    "http://claude-fixture.invalid", "ftp://localhost", "https://user:password@claude-fixture.invalid",
    "https://claude-fixture.invalid/v1?credential=never", "https://claude-fixture.invalid/#fragment", "",
])
def test_claude_invalid_endpoint_fails_before_request(monkeypatch, base):
    configure_claude(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_BASE_URL", base)
    captured = []
    install_response(monkeypatch, {}, captured)
    with pytest.raises(RuntimeError):
        asyncio.run(intelligence.request_json("Fixture", "{}"))
    assert captured == []


@pytest.mark.attack
@pytest.mark.parametrize("payload", [
    None, [], {"stop_reason": [], "content": [{"type": "text", "text": '{"fixture":true}'}]},
    {"stop_reason": "max_tokens", "content": [{"type": "text", "text": '{"answer":"partial"}'}]},
    {"stop_reason": "refusal", "content": [{"type": "text", "text": '{"answer":"refusal"}'}]},
    {"stop_reason": "tool_use", "content": [{"type": "tool_use", "name": "submit_claim"}]},
    {"stop_reason": "end_turn", "content": [{"type": "tool_use", "name": "submit_claim"}]},
    {"stop_reason": "end_turn", "content": [{"type": "text", "text": None}]},
    {"stop_reason": "end_turn", "content": [{"type": "text", "text": "null"}]},
    {"stop_reason": "end_turn", "content": [{"type": "text", "text": "[]"}]},
    {"stop_reason": "end_turn", "content": []},
])
def test_claude_nonfinal_or_malformed_responses_fail_closed(monkeypatch, payload):
    configure_claude(monkeypatch)
    install_response(monkeypatch, payload)
    with pytest.raises(ValueError):
        asyncio.run(intelligence.request_json("Fixture", "{}"))
    assert intelligence.ai_config()["live_verified"] is False


@pytest.mark.task
def test_claude_prompt_accepts_original_chinese_source_in_english_interface(monkeypatch):
    configure_claude(monkeypatch)
    quote = "申请意外医疗保险金时，应当提供医疗诊断证明和医疗费用原始凭证。"
    selected = {"answer": quote + " [C1]", "citation_ids": ["C1"], "claims": [{"text": quote, "quote": quote, "citation_ids": ["C1"]}]}
    captured = []
    install_response(monkeypatch, {"stop_reason": "end_turn", "content": [{"type": "text", "text": json.dumps(selected, ensure_ascii=False)}]}, captured)
    citations = [{"id": "C1", "page": 12, "quote": quote}]
    result = asyncio.run(intelligence.call_model("Which documents? Contact synthetic@fixture.test", citations, "en", {}, {}))
    assert intelligence.verify_model_output(result, citations) == (selected["answer"], citations, None)
    system = captured[0][1]["json"]["system"]
    assert "Retain the original source language" in system
    assert "localized notices" in system
    assert "Write in English" not in system
    assert "synthetic@fixture.test" not in captured[0][1]["json"]["messages"][0]["content"]


@pytest.mark.task
def test_claude_selector_materializes_selected_original_excerpts_in_order(monkeypatch):
    configure_claude(monkeypatch)
    captured = []
    install_response(monkeypatch, {"stop_reason": "end_turn", "content": [{"type": "text", "text": '{"selected_excerpt_ids":["E2","E1"]}'}]}, captured)
    citations = [{"id": "C1", "page": 2, "quote": "申请时应当提供\n医疗费用原始凭证。"},
                 {"id": "C2", "page": 12, "quote": "请提供\n登\n机牌及旅行证明。"}]
    output = asyncio.run(intelligence.call_model("需要哪些证明？", citations, "zh", {}, {}))
    assert output["citation_ids"] == ["C2", "C1"]
    assert output["claims"][0]["text"] == citations[1]["quote"]
    assert output["claims"][1]["text"] == citations[0]["quote"]
    assert output["answer"] == citations[1]["quote"] + " [C2]\n\n" + citations[0]["quote"] + " [C1]"
    assert intelligence.verify_model_output(output, citations)[0] == output["answer"]
    body = json.loads(captured[0][1]["json"]["messages"][0]["content"])
    assert [entry["excerpt_id"] for entry in body["evidence"]] == ["E1", "E2"]
    assert "exactly one field" in captured[0][1]["json"]["system"]


@pytest.mark.task
def test_claude_selector_masks_external_copy_but_preserves_private_original(monkeypatch):
    configure_claude(monkeypatch)
    captured = []
    install_response(monkeypatch, {"stop_reason": "end_turn", "content": [{"type": "text", "text": '{"selected_excerpt_ids":["E1"]}'}]}, captured)
    quote = "被保险人：林美。保单编号：SYNTHETIC-PRIVATE-42。联系 synthetic@fixture.test，电话13812345678。"
    citations = [{"id": "C1", "page": 1, "quote": quote}]
    output = asyncio.run(intelligence.call_model("查看保单", citations, "zh", {"email": "synthetic@fixture.test"}, {"insured_name": "林美", "policy_number": "SYNTHETIC-PRIVATE-42"}))
    outbound = captured[0][1]["json"]["messages"][0]["content"]
    for private in ("林美", "SYNTHETIC-PRIVATE-42", "synthetic@fixture.test", "13812345678"):
        assert private not in outbound
    assert "[INSURED_NAME]" in outbound and "[POLICY_NUMBER]" in outbound
    assert output["claims"][0]["quote"] == quote
    assert output["answer"] == quote + " [C1]"
    assert intelligence.verify_model_output(output, citations)[0] == output["answer"]


@pytest.mark.attack
@pytest.mark.parametrize("payload", [
    {"selected_excerpt_ids": ["E1"], "answer": "Your claim is approved."},
    {"selected_excerpt_ids": ["E1"], "reasoning": "Invented reasoning"},
    {"selected_excerpt_ids": ["E99"]}, {"selected_excerpt_ids": ["C1"]},
    {"selected_excerpt_ids": ["E1", "E1"]},
    {"selected_excerpt_ids": "E1"}, {"selected_excerpt_ids": [True]},
    {"selected_excerpt_ids": [["E1"]]},
    {"selected_excerpt_ids": ["E1", "E2", "E3", "E4", "E5", "E6", "E7"]},
    {"answer": "Your claim is approved."},
    {"answer": "Your claim is approved. [C1]", "citation_ids": ["C1"], "claims": [{"text": "Your claim is approved.", "quote": "Your claim is approved.", "citation_ids": ["C1"]}]},
])
def test_claude_selector_rejects_freeform_unknown_duplicate_and_unbounded_outputs(monkeypatch, payload):
    configure_claude(monkeypatch)
    install_response(monkeypatch, {"stop_reason": "end_turn", "content": [{"type": "text", "text": json.dumps(payload)}]})
    citations = [{"id": f"C{index}", "page": index, "quote": f"Original policy evidence passage number {index}."} for index in range(1, 8)]
    with pytest.raises(ValueError):
        asyncio.run(intelligence.call_model("What evidence is needed?", citations, "en", {}, {}))


@pytest.mark.task
def test_claude_selector_excerpts_are_bounded_original_substrings(monkeypatch):
    configure_claude(monkeypatch)
    captured = []
    install_response(monkeypatch, {"stop_reason": "end_turn", "content": [{"type": "text", "text": '{"selected_excerpt_ids":["E1"]}'}]}, captured)
    quote = "Medical evidence must be reviewed.\n" * 80
    citations = [{"id": "C1", "page": 2, "quote": quote}]
    output = asyncio.run(intelligence.call_model("medical evidence", citations, "en", {}, {}))
    excerpt = output["claims"][0]["quote"]
    assert 10 <= len(excerpt) <= 600 and excerpt in quote
    assert intelligence.verify_model_output(output, citations)[0]


@pytest.mark.task
def test_claude_empty_selection_is_abstention_not_transport_failure(client, monkeypatch):
    configure_claude(monkeypatch)
    install_response(monkeypatch, {"stop_reason": "end_turn", "content": [{"type": "text", "text": '{"selected_excerpt_ids":[]}'}]})
    policy = client.get("/api/policies").json()["policies"][0]
    client.patch("/api/policies/" + policy["id"], json={"fields": {}, "confirmed": True})
    result = client.post("/api/chat", json={"message": "门诊医疗理赔需要哪些材料？", "policy_id": policy["id"]}).json()
    assert result["engine"] == "retrieval_only" and result["citations"]
    events = [event for event in result["trace"] if event["stage"] == "model"]
    assert any(event["status"] == "abstained" and event["reason"] == "no_relevant_excerpt_selected" for event in events)
    assert not any(event.get("reason") == "provider_unavailable_or_invalid" for event in events)


@pytest.mark.attack
@pytest.mark.parametrize("output", [
    None, [], "not an object",
    {"answer": "The policy covers outpatient treatment. [C1]", "citation_ids": ["C1"], "claims": [{"text": "The policy covers outpatient treatment.", "citation_ids": [["C1"]]}]},
    {"answer": "The policy covers outpatient treatment. [C1]", "citation_ids": ["C1"], "claims": [{"text": "The policy covers outpatient treatment.", "citation_ids": [{"id": "C1"}]}]},
    {"answer": "The policy does not cover outpatient treatment. [C1]", "citation_ids": ["C1"], "claims": [{"text": "The policy does not cover outpatient treatment.", "citation_ids": ["C1"]}]},
])
def test_claude_malformed_assertions_and_reversed_meaning_are_rejected(output):
    answer, citations, rejection = intelligence.verify_model_output(output, [{"id": "C1", "quote": "The policy covers outpatient treatment."}])
    assert answer is None and citations == [] and rejection


@pytest.mark.task
def test_claude_pdf_line_break_cleanup_returns_original_source_quote():
    quote = "并提供\n下列证明和资料：登\n机牌及医疗费用原始凭证。"
    text = quote.replace("\n", "")
    output = {"answer": text + " [C1]", "citation_ids": ["C1"], "claims": [{"text": text, "quote": quote, "citation_ids": ["C1"]}]}
    answer, used, rejection = intelligence.verify_model_output(output, [{"id": "C1", "quote": "申请材料如下。" + quote + "请核对完整条款。"}])
    assert rejection is None and used
    assert answer == quote + " [C1]"
    assert "登\n机牌" in answer


@pytest.mark.attack
@pytest.mark.parametrize("text,quote,extra", [
    ("并提供下列证明和资料。", "并提供\n下列证明和资料：", ""),
    ("不必提供下列证明和资料：", "并提供\n下列证明和资料：", ""),
    ("并提供下列证明和资料：", "并提供\n下列证明和资料：", "\nYour claim is approved."),
    ("并提供下列证明和资料：", "并提供下列证明和资料：", ""),
    ("并提供下列证明和资料：", None, ""),
])
def test_claude_whitespace_canonicalization_never_accepts_other_changes(text, quote, extra):
    source = "并提供\n下列证明和资料："
    claim = {"text": text, "citation_ids": ["C1"]}
    if quote is not None:
        claim["quote"] = quote
    output = {"answer": text + " [C1]" + extra, "citation_ids": ["C1"], "claims": [claim]}
    assert intelligence.verify_model_output(output, [{"id": "C1", "quote": source}])[0] is None


@pytest.mark.attack
@pytest.mark.parametrize("quote,text", [
    ("guaranteed\npayout is provided.", "guaranteedpayout is provided."),
    ("The stated amount is 100\n000.", "The stated amount is 100000."),
])
def test_claude_whitespace_canonicalization_retains_authority_and_numeric_guards(quote, text):
    output = {"answer": text + " [C1]", "citation_ids": ["C1"], "claims": [{"text": text, "quote": quote, "citation_ids": ["C1"]}]}
    assert intelligence.verify_model_output(output, [{"id": "C1", "quote": quote}])[0] is None


@pytest.mark.task
def test_claude_grounded_chat_accepts_verified_original_page_extract(client, monkeypatch):
    configure_claude(monkeypatch)
    policy = client.get("/api/policies").json()["policies"][0]
    assert client.patch("/api/policies/" + policy["id"], json={"fields": {}, "confirmed": True}).status_code == 200
    calls = []

    class SourceSelectingClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            evidence = json.loads(kwargs["json"]["messages"][0]["content"])["evidence"]
            selected = None
            for source in evidence:
                text = source["quote"][:180].strip()
                candidate = {"answer": text + " [" + source["id"] + "]", "citation_ids": [source["id"]], "claims": [{"text": text, "quote": text, "citation_ids": [source["id"]]}]}
                if "[EMAIL]" not in text and "[INSURED_NAME]" not in text and intelligence.verify_model_output(candidate, evidence)[0]:
                    selected = candidate
                    break
            assert selected is not None
            calls.append(url)

            class Response:
                def raise_for_status(self):
                    return None

                def json(self):
                    return {"stop_reason": "end_turn", "content": [{"type": "text", "text": json.dumps(selected, ensure_ascii=False)}]}

            return Response()

    monkeypatch.setattr(intelligence.httpx, "AsyncClient", SourceSelectingClient)
    response = client.post("/api/chat", json={"message": "门诊医疗理赔需要哪些材料和证明？", "policy_id": policy["id"], "locale": "en"})
    assert response.status_code == 200, response.text
    result = response.json()
    assert calls and result["engine"] == "claude_api", result
    assert any(item["stage"] == "model" and item["status"] == "ok" for item in result["trace"])
    for citation in result["citations"]:
        original = client.get("/api/documents/" + citation["document_id"]).json()
        page = next(page for page in original["pages"] if page["page"] == citation["page"])
        assert citation["quote"] in page["text"]
    assert intelligence.ai_config()["live_verified"] is False


@pytest.mark.task
def test_claude_budget_exhaustion_uses_retrieval_without_network(client, monkeypatch):
    configure_claude(monkeypatch)
    policy = client.get("/api/policies").json()["policies"][0]
    client.patch("/api/policies/" + policy["id"], json={"fields": {}, "confirmed": True})
    reservations = []

    def exhausted(provider):
        reservations.append(provider)
        return False

    monkeypatch.setattr(provider_limits, "reserve", exhausted)
    captured = []
    install_response(monkeypatch, {}, captured)
    result = client.post("/api/chat", json={"message": "门诊医疗理赔需要哪些材料？", "policy_id": policy["id"]}).json()
    assert reservations == ["claude"] and captured == []
    assert result["engine"] == "retrieval_only" and result["citations"]
    assert any(item["stage"] == "model" and item["status"] == "fallback" for item in result["trace"])
    assert any(item.get("reason") == "budget_exhausted" for item in result["trace"])


@pytest.mark.attack
@pytest.mark.parametrize("translation", ["My contact is [EMAIL].", "My contacts are [EMAIL], [EMAIL], [EMAIL]."])
def test_claude_translation_rejects_lost_or_duplicated_redactions(client, monkeypatch, translation):
    configure_claude(monkeypatch)
    install_response(monkeypatch, {"stop_reason": "end_turn", "content": [{"type": "text", "text": json.dumps({"translation": translation})}]})
    result = client.post("/api/assistance-summary", json={"text": "联系 first@synthetic.test 或 second@synthetic.test", "locale": "en", "consent_external_processing": True}).json()
    assert result["translated"] is False and result["external_delivery"] is False
    assert result["original_text"] == "联系 first@synthetic.test 或 second@synthetic.test"
