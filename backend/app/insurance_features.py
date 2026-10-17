"""Reviewed educational workflows and code-owned arithmetic.

Reference templates do not establish the requirements of an issued policy. No
catalogue price, payout probability or personal entitlement is invented here.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any

FAMILIES = [
    ("life", "Life protection", "寿险"), ("medical", "Medical reimbursement", "医疗险"),
    ("critical_illness", "Critical illness", "重疾险"), ("accident", "Personal accident", "意外险"),
    ("motor", "Motor", "车险"), ("travel", "Travel", "旅行险"),
    ("home", "Home and property", "家财险"), ("savings", "Savings and annuity", "储蓄 / 年金"),
    ("sme", "Business property and liability", "企业险"),
]

DOCUMENT_LABELS = {
    "policy": "Policy schedule and applicable wording / 保单及适用条款",
    "identity": "Identity and applicant authority / 身份及申请权限",
    "claim_form": "Reviewed application / 已审核申请表",
    "travel_proof": "Trip and travel dates / 旅程证明",
    "medical_record": "Medical record and recorded diagnosis / 病历及诊断",
    "original_expense": "Expense evidence and itemisation / 费用凭证及明细",
    "discharge_record": "Discharge summary / 出院记录",
    "incident_evidence": "Incident / police / third-party evidence / 事故事实证明",
    "prior_settlement": "Other payer settlement / 医保或其他支付方结算",
    "authority": "Guardian / representative authority / 监护或委托授权",
    "death_evidence": "Accepted death evidence / 死亡证明材料",
    "beneficiary": "Beneficiary / relationship entitlement / 受益或关系证明",
    "disability_report": "Relevant disability assessment / 伤残评定",
    "disease_evidence": "Definition-specific pathology / tests / 病理及检查",
    "driver_vehicle": "Driving and vehicle records / 驾驶证及行驶证",
    "repair_loss": "Loss list and repair evidence / 损失清单及维修凭证",
    "property_interest": "Ownership / tenancy interest / 产权或租赁权益",
    "business_authority": "Business licence and authority / 营业执照及授权",
    "financial_loss": "Claim-related accounting / employment evidence / 损失相关账目或用工证明",
    "carrier_report": "Carrier delay / baggage report / 承运人延误或行李证明",
    "booking_loss": "Booking and non-refundable loss / 预订及不可退损失",
    "entitlement": "Payment entitlement / policy-service request / 给付资格或保全申请",
    "other": "Additional evidence / 补充材料",
}

# Sources are the official references researched in the team's China workflow
# design. These are examples, never interchangeable personal policy rules.
SOURCE = {
    "travel": "https://pts.allianz.com.cn/portal/resources/material/clauses/NLC_AXWL02_231.pdf",
    "medical": "https://health.pingan.com/P/C/PAH/claimOnline",
    "critical_illness": "https://m.health.pingan.com/share/products/zdjb.html",
    "accident": "https://pa-ssl.pingan.com/personal/insurance/pay7.jsp",
    "life": "https://life.pingan.com/",
    "motor": "https://auto.pingan.com/",
    "home": "https://property.pingan.com/",
    "savings": "https://life.pingan.com/",
    "sme": "https://property.pingan.com/",
}

_BRANCHES = [
    ("life", "death", "Death benefit", "身故给付", ["death_evidence", "beneficiary"]),
    ("medical", "medical_expense", "Hospital / outpatient expenses", "住院 / 门诊费用", ["medical_record", "original_expense"]),
    ("critical_illness", "defined_illness", "Defined serious illness", "合同约定重大疾病", ["medical_record", "disease_evidence"]),
    ("accident", "accident_medical", "Accidental injury", "意外伤害", ["incident_evidence", "medical_record", "original_expense"]),
    ("motor", "vehicle_damage", "Vehicle accident / damage", "车辆事故 / 损失", ["driver_vehicle", "incident_evidence", "repair_loss"]),
    ("travel", "outpatient_accident", "Accidental outpatient treatment abroad", "境外意外门诊", ["travel_proof", "medical_record", "original_expense"]),
    ("home", "property_damage", "Damage to insured property", "承保财产损失", ["property_interest", "incident_evidence", "repair_loss"]),
    ("savings", "annuity_maturity", "Annuity / maturity / surrender service", "年金 / 满期 / 退保服务", ["entitlement"]),
    ("sme", "business_loss", "Business property / liability loss", "企业财产 / 责任损失", ["business_authority", "incident_evidence", "repair_loss", "financial_loss"]),
    ("travel", "flight_delay", "Flight delay", "航班延误", ["travel_proof", "carrier_report"]),
    ("travel", "baggage_loss", "Baggage loss / delay", "行李丢失 / 延误", ["travel_proof", "carrier_report", "repair_loss"]),
    ("travel", "trip_cancellation", "Trip cancellation", "旅行取消", ["travel_proof", "booking_loss", "incident_evidence"]),
]


def requirements(family: str, benefit: str, incident: dict) -> list[dict]:
    branch = next((x for x in _BRANCHES if x[0] == family and x[1] == benefit), None)
    if branch is None:
        branch = next((x for x in _BRANCHES if x[0] == family), None)
    categories = ["policy", "identity", "claim_form"] + (branch[4] if branch else ["other"])
    conditions: dict[str, str] = {}
    additions = [
        (incident.get("treatment_type") == "inpatient", "discharge_record", "Inpatient treatment / 住院治疗"),
        (incident.get("prior_reimbursement"), "prior_settlement", "Another payer has reimbursed expenses / 已有其他支付方结算"),
        (incident.get("minor") or incident.get("applicant_role") in {"guardian", "authorized_representative"}, "authority", "Guardian or authorized representative / 监护或授权申请"),
        (incident.get("disability"), "disability_report", "A disability benefit is requested / 申请伤残给付"),
        (incident.get("death"), "death_evidence", "A death benefit is requested / 申请身故给付"),
        (incident.get("death"), "beneficiary", "Death-benefit entitlement must be established / 核对身故给付资格"),
        (incident.get("police_involved") or incident.get("third_party_involved"), "incident_evidence", "Police or third party involved / 涉警或第三方"),
    ]
    for applies, category, condition in additions:
        if applies and category not in categories:
            categories.append(category)
            conditions[category] = condition
    where = {"medical_record": "Treating hospital / 就诊医疗机构", "original_expense": "Hospital billing desk / 收费处", "carrier_report": "Airline or carrier / 航空公司或承运人", "incident_evidence": "Relevant authority or involved party / 相关机构或当事方", "policy": "Your issued policy and insurer / 已签发保单及保险公司", "authority": "Guardian / principal and insurer requirements / 监护人、委托人及保险公司要求"}
    return [{"id": category, "label": DOCUMENT_LABELS[category], "condition": conditions.get(category),
             "where_to_get": where.get(category, "Obtain from the issuer or your records; confirm the insurer's exact format / 向出具方获取并核对保险公司格式"),
             "source_url": SOURCE.get(family), "rule_status": "reference_only"} for category in dict.fromkeys(categories)]


def incident_library(family: str = "", country: str = "China") -> dict:
    items = []
    for line, benefit, title, zh, _ in _BRANCHES:
        if family and line != family:
            continue
        items.append({"id": f"{line}_{benefit}", "family": line, "title": title, "title_zh": zh, "benefit": benefit,
                      "steps": ["Prioritize immediate safety and appropriate medical / emergency help.", "Report promptly through the official channel in the issued policy; do not wait for a complete document pack.", "Record the time, place and factual loss; preserve originals when safe.", "Check the exact benefit, wording, endorsements and notification instructions.", "Review extracted facts and the evidence list before preparing a draft or official handoff."],
                      "purchase_documents": [{"id": "identity", "label": "Applicant and insured identity / 投保人与被保险人身份", "condition": "Only the information requested by the selected official channel"}, {"id": "needs", "label": "Needs, eligibility and truthful disclosure / 需求、资格及如实告知", "condition": "Family-specific questions; never invent health answers"}, {"id": "risk_facts", "label": "Relevant trip / vehicle / property / business facts / 旅程、车辆、财产或经营信息", "condition": f"As required for {line}; supporting uploads only if the insurer requests them"}],
                      "claim_documents": requirements(line, benefit, {}), "source_url": SOURCE[line], "country": country,
                      "rule_status": "reference_only", "notice": "Educational starting checklist. Exact insurer / issued wording / benefit / channel governs. Only the reviewed Allianz outpatient example supports a prepared package; other cases remain labelled drafts. Annuity or surrender is a policy service, not necessarily an insured claim."})
    return {"families": [{"id": x, "label": en, "label_zh": zh} for x, en, zh in FAMILIES], "items": items,
            "sources": [{"family": x, "url": url, "type": "official_reference"} for x, url in SOURCE.items()], "is_live_insurer": False}


def money(value: Any) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def estimate_cost(bill_amount: float, currency: str, terms: dict) -> dict:
    """Only user-reviewed scenario arithmetic; excluded / ineligible is unknown."""
    needed = ["limit", "deductible", "coinsurance_percent"]
    missing = [name for name in needed if terms.get(name) is None]
    verified = terms.get("confirmed") and bool(str(terms.get("source_note", "")).strip())
    if missing or not verified or terms.get("eligible") is False:
        return {"known": False, "insurer_pays": None, "you_pay": None, "currency": currency, "missing": missing,
                "reason": "Confirm the source terms and eligibility before estimating. Unknown is not zero coverage.", "assumptions": ["No personal entitlement or insurer decision is inferred."]}
    bill, deductible, limit = money(bill_amount), money(terms["deductible"]), money(terms["limit"])
    eligible_amount = max(Decimal(0), bill - deductible)
    share = Decimal(1) - Decimal(str(terms["coinsurance_percent"])) / 100
    covered = min(limit, (eligible_amount * share).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return {"known": True, "currency": currency, "bill_amount": float(bill), "insurer_pays": float(covered), "you_pay": float(bill - covered),
            "breakdown": [{"step": "bill", "amount": float(bill)}, {"step": "after_deductible", "amount": float(eligible_amount)}, {"step": "after_coinsurance_and_limit", "amount": float(covered)}],
            "assumptions": ["User-reviewed scenario terms, not a live quote.", "All input expenses assumed eligible; exclusions, sublimits, prior reimbursement and schedule changes can change the result.", "Premium is separate from this claim bill. No currency conversion is performed."],
            "source_note": terms["source_note"], "engine": "decimal_arithmetic", "is_claim_decision": False}


def comparison(products: list[dict], needs: dict, scenario: dict | None = None) -> dict:
    criteria = ["coverage_fit", "exclusions", "deductible", "waiting_period", "renewal", "affordability", "claim_friction", "scenario_out_of_pocket"]
    rows = []
    for criterion in criteria:
        vals = []
        for product in products:
            if criterion == "coverage_fit":
                value, status = product.get("benefit_notes", ""), "documented"
            elif criterion == "exclusions":
                value, status = "; ".join(product.get("limitations", [])), "documented"
            else:
                value, status = "Not established by this reference catalogue; request the actual schedule / quote.", "unknown"
            vals.append({"product_id": product["id"], "value": value, "status": status})
        rows.append({"criterion": criterion, "label": criterion.replace("_", " ").title(), "values": vals})
    cost_examples = []
    if scenario:
        for terms in scenario.get("terms", []):
            if terms.get("product_id") in {p["id"] for p in products}:
                cost_examples.append({"product_id": terms["product_id"], **estimate_cost(scenario["bill_amount"], scenario["currency"], terms)})
    top = max((p["score"] for p in products), default=0)
    tied = [p["id"] for p in products if p["score"] == top]
    advocates = [{"product_id": p["id"], "case_for": [p.get("benefit_notes", ""), f"Source-described matches: {', '.join(p['matched_priorities']) or 'none'}."],
                  "cautions": p.get("limitations", []) + ["Budget, selected limits and eligibility have not been verified."],
                  "when_it_wins": "Only if its issued terms better fit your confirmed priorities and reviewed scenario costs; this limited catalogue cannot establish that today."} for p in products]
    verdict = "No unique best product is established. Review the tied references and obtain the missing issued terms / quotes." if len(tied) != 1 else "One reference matches more requested feature tags; this is not an overall suitability winner. Review missing terms and costs with a licensed professional."
    return {"comparison_rows": rows, "advocates": advocates, "cost_examples": cost_examples,
            "judge": {"type": "deterministic_feature_match", "engine": "deterministic_rules", "price_used": False, "claims_probability_used": False,
                      "criteria": criteria, "summary": verdict, "tied_product_ids": tied, "no_unique_winner": len(tied) != 1,
                      "when_each_wins": [{"product_id": a["product_id"], "condition": a["when_it_wins"]} for a in advocates],
                      "disclosure": "Advocate and judge sections are code-generated fact arguments, not multiple model calls. A feature-tag count does not establish full suitability. Cheapest is not the default winner."}}


DEMO_AGENTS = [
    {"id": "demo_agent_zh_sh", "name": "Demo adviser Chen / 演示顾问陈", "languages": ["zh", "en"], "city": "Shanghai", "rating": 4.8, "sla_minutes": 30, "sla_met_rate": .95, "load": .3},
    {"id": "demo_agent_zh_sz", "name": "Demo adviser Lin / 演示顾问林", "languages": ["zh"], "city": "Shenzhen", "rating": 4.7, "sla_minutes": 45, "sla_met_rate": .92, "load": .2},
    {"id": "demo_agent_en_bj", "name": "Demo adviser Wang / 演示顾问王", "languages": ["zh", "en"], "city": "Beijing", "rating": 4.9, "sla_minutes": 60, "sla_met_rate": .9, "load": .5},
]


def match_agents(language: str, city: str) -> dict:
    agents = []
    for item in DEMO_AGENTS:
        matched_language = language in item["languages"]
        local = bool(city) and city.casefold() == item["city"].casefold()
        score = .4 * item["rating"] / 5 + .3 * item["sla_met_rate"] + .2 * int(local) + .1 * (1 - item["load"])
        agents.append(item | {"language": ", ".join(item["languages"]), "score": round(score, 4), "language_match": matched_language,
                              "why_chosen": ["Language matches" if matched_language else "Language needs confirmation", "Same recorded city" if local else "Remote location", f"Synthetic rating {item['rating']}/5; synthetic SLA {item['sla_minutes']} minutes", f"Synthetic load {int(item['load'] * 100)}%"], "is_simulated": True, "licensed_status": "Fictional directory only; no actual license or partner verified"})
    agents.sort(key=lambda a: (not a["language_match"], -a["score"], a["id"]))
    return {"agents": agents, "is_simulated": True, "notice": "Fictional matching demonstration. No real agent, promised SLA, lead delivery or commission."}
