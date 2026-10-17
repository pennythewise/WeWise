"""Durable customer preparation tracker and a separately labelled insurer FSM."""
from __future__ import annotations

from datetime import datetime, timedelta
import json

from fastapi import HTTPException

from .core import now_iso, uid

STAGES = [
    ("RECEIVED", "Received", "模拟收件", "Insurer (simulated)", "The simulated insurer reviews the evidence."),
    ("IN_REVIEW", "Document review", "模拟材料审核", "Insurer (simulated)", "Wait for the simulated review, or open the explanation."),
    ("INFO_REQUESTED", "More information requested", "模拟待补充", "You (simulation)", "Simulate supplying the requested itemised bill; never delay real official reporting."),
    ("ASSESSMENT", "Assessment", "模拟评估", "Insurer (simulated)", "The simulated insurer evaluates the scenario. No real evaluation occurred."),
    ("APPROVED", "Decision: approved", "模拟决定：通过", "Insurer (simulated)", "A simulated approval is separate from simulated payment."),
    ("DECLINED", "Decision: declined", "模拟决定：不通过", "You (simulation)", "Review the synthetic letter and simulate a review / appeal request."),
    ("APPEAL_REQUESTED", "Review requested", "模拟复核申请", "Insurer (simulated)", "The simulated insurer rechecks the scenario."),
    ("PAID", "Payment shown", "模拟付款", "Nobody: simulation complete", "No money moved. Use real official records for an actual case."),
]
STAGE_INFO = {stage: {"id": stage, "label": en, "label_zh": zh, "actor": actor, "next_action": action} for stage, en, zh, actor, action in STAGES}
NEXT = {None: ["RECEIVED"], "RECEIVED": ["IN_REVIEW"], "IN_REVIEW": ["INFO_REQUESTED", "ASSESSMENT"],
        "INFO_REQUESTED": ["ASSESSMENT"], "ASSESSMENT": ["APPROVED", "DECLINED"], "APPROVED": ["PAID"],
        "DECLINED": ["APPEAL_REQUESTED"], "APPEAL_REQUESTED": ["IN_REVIEW"], "PAID": []}
SIM_NOTES = {
    "RECEIVED": "SIMULATED receipt; no insurer received this case.",
    "IN_REVIEW": "SIMULATED document review; the scenario insurer is reviewing the file.",
    "INFO_REQUESTED": "SIMULATED request: an itemised medical bill is missing from this scenario. Waiting on the user in the simulation.",
    "ASSESSMENT": "SIMULATED assessment after documents were supplied; no real insurer assessment occurred.",
    "APPROVED": "SIMULATED approval; no actual claim decision occurred.",
    "DECLINED": "SIMULATED decline letter: the scenario file does not establish the requested expense under the selected benefit. No real claim was declined.",
    "APPEAL_REQUESTED": "SIMULATED review request recorded; no appeal was sent to any insurer or regulator.",
    "PAID": "SIMULATED payment; no money moved.",
}


def init_tables(db):
    db.executescript("""
    CREATE TABLE IF NOT EXISTS claim_simulator_state(claim_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,revision INTEGER NOT NULL,status TEXT,clock_day INTEGER NOT NULL DEFAULT 0,base_at TEXT NOT NULL,receipt_reference TEXT,confirmation_hash TEXT,start_mode TEXT NOT NULL DEFAULT 'scenario_playback');
    CREATE TABLE IF NOT EXISTS claim_simulation_details(event_id TEXT PRIMARY KEY,claim_id TEXT NOT NULL,user_id TEXT NOT NULL,clock_day INTEGER NOT NULL,actor TEXT NOT NULL,next_action TEXT NOT NULL,source_label TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS claim_notifications(id TEXT PRIMARY KEY,claim_id TEXT NOT NULL,user_id TEXT NOT NULL,event_key TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,title_zh TEXT NOT NULL,body TEXT NOT NULL,is_simulated INTEGER NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(claim_id,user_id,event_key));
    """)


def notify(db, claim, event_key, kind, title, title_zh, body, simulated=False):
    db.execute("INSERT OR IGNORE INTO claim_notifications VALUES(?,?,?,?,?,?,?,?,?,?,NULL)",
               (uid("ntf_"), claim["id"], claim["user_id"], event_key, kind, title, title_zh, body, int(simulated), now_iso()))


def notifications(db, claim):
    return [dict(row) | {"is_simulated": bool(row["is_simulated"])} for row in db.execute("SELECT id,kind,title,title_zh,body,is_simulated,created_at,read_at FROM claim_notifications WHERE claim_id=? AND user_id=? ORDER BY created_at DESC LIMIT 50", (claim["id"], claim["user_id"]))]


def state(db, claim):
    row = db.execute("SELECT * FROM claim_simulator_state WHERE claim_id=? AND user_id=?", (claim["id"], claim["user_id"])).fetchone()
    return dict(row) if row else None


def start(db, claim, *, token_hash=None, mode="scenario_playback"):
    existing = state(db, claim)
    if existing:
        return existing
    receipt = "SIM-" + uid("")[:12].upper()
    db.execute("INSERT INTO claim_simulator_state VALUES(?,?,?,NULL,0,?,?,?,?)", (claim["id"], claim["user_id"], claim["revision"], now_iso(), receipt, token_hash, mode))
    return state(db, claim)


def transition(db, claim, stage, *, event_day=None):
    current = state(db, claim)
    if not current:
        raise HTTPException(409, "Review and confirm a simulated submission, or explicitly start a preset scenario first.")
    if stage == current["status"]:
        return current
    if stage not in NEXT.get(current["status"], []):
        raise HTTPException(409, {"message": "Invalid simulated stage transition.", "current": current["status"], "allowed": NEXT.get(current["status"], []), "is_simulated": True})
    identifier = uid("sim_")
    day = current["clock_day"] if event_day is None else event_day
    stamp = (datetime.fromisoformat(current["base_at"]) + timedelta(days=day)).isoformat()
    info = STAGE_INFO[stage]
    db.execute("INSERT INTO claim_simulations VALUES(?,?,?,?,?,?)", (identifier, claim["id"], claim["user_id"], stage, SIM_NOTES[stage], stamp))
    db.execute("INSERT INTO claim_simulation_details VALUES(?,?,?,?,?,?,?)", (identifier, claim["id"], claim["user_id"], day, info["actor"], info["next_action"], "Synthetic insurer scenario; not official correspondence"))
    db.execute("UPDATE claim_simulator_state SET status=? WHERE claim_id=? AND user_id=?", (stage, claim["id"], claim["user_id"]))
    notify(db, claim, identifier, "simulation_stage", "SIMULATED · " + info["label"], info["label_zh"], SIM_NOTES[stage], True)
    return state(db, claim)


def playback(db, claim, target):
    """Compatibility route: replay a named synthetic story, not a random status write."""
    current = start(db, claim)
    paths = {"RECEIVED": ["RECEIVED"], "IN_REVIEW": ["RECEIVED", "IN_REVIEW"],
             "INFO_REQUESTED": ["RECEIVED", "IN_REVIEW", "INFO_REQUESTED"],
             "ASSESSMENT": ["RECEIVED", "IN_REVIEW", "ASSESSMENT"],
             "APPROVED": ["RECEIVED", "IN_REVIEW", "ASSESSMENT", "APPROVED"],
             "DECLINED": ["RECEIVED", "IN_REVIEW", "ASSESSMENT", "DECLINED"],
             "PAID": ["RECEIVED", "IN_REVIEW", "ASSESSMENT", "APPROVED", "PAID"]}
    path = paths.get(target, [])
    if current["status"] in path:
        path = path[path.index(current["status"]) + 1:]
    elif current["status"] is not None:
        # Once a scenario is running, only an allowed next state can be chosen.
        return transition(db, claim, target)
    for stage in path:
        transition(db, claim, stage)
    return state(db, claim)


def advance(db, claim, days, outcome):
    current = state(db, claim)
    if not current or not current["status"]:
        raise HTTPException(409, "Start the explicitly labelled simulator first.")
    db.execute("UPDATE claim_simulator_state SET clock_day=clock_day+? WHERE claim_id=? AND user_id=?", (days, claim["id"], claim["user_id"]))
    current = state(db, claim)
    # The clock stops at an outstanding customer task. It never silently assumes
    # evidence was supplied or converts an actual case to insurer-submitted.
    for _ in range(4):
        recent = db.execute("SELECT clock_day FROM claim_simulation_details WHERE claim_id=? AND user_id=? ORDER BY rowid DESC LIMIT 1", (claim["id"], claim["user_id"])).fetchone()
        elapsed = current["clock_day"] - (recent["clock_day"] if recent else 0)
        target = None
        duration = 2
        if current["status"] == "RECEIVED" and elapsed >= 1:
            target = "IN_REVIEW"
            duration = 1
        elif current["status"] == "IN_REVIEW" and elapsed >= 2:
            target = "INFO_REQUESTED"
        elif current["status"] == "ASSESSMENT" and elapsed >= 2:
            target = "DECLINED" if outcome == "declined" else "APPROVED"
        elif current["status"] == "APPROVED" and elapsed >= 2:
            target = "PAID"
        if not target:
            break
        current = transition(db, claim, target, event_day=(recent["clock_day"] if recent else 0) + duration)
    return current


def build(db, claim, policy, checklist, evidence, exports, validation):
    confirmed = bool(policy and policy["confirmed"] and claim["policy_revision"] == policy["revision"])
    facts = confirmed and claim["confirmed_revision"] == claim["revision"]
    files = not any(x["missing"] for x in checklist) and not validation["inconsistencies"]
    package = claim["status"] == "PREPARED_NOT_SUBMITTED" and facts and files
    steps = [
        ("POLICY_CONFIRMED", "Confirm policy", "核对保单", confirmed, "You", "Review the exact policy, period and selected benefits."),
        ("INCIDENT_REVIEWED", "Review incident", "核对事故", facts, "You", "Confirm date, place, narrative and benefit requested."),
        ("DOCUMENTS_READY", "Prepare evidence", "备齐材料", files, "You", "Resolve missing documents and factual mismatches."),
        ("PACKAGE_PREPARED", "Review and download", "审核并下载", package, "You", "Review the frozen package and confirm download."),
        ("OFFICIAL_HANDOFF", "Use official insurer channel", "前往官方渠道", False, "You / official insurer channel", "Submit yourself through the current official channel; an app download is not insurer receipt."),
    ]
    active_index = next((i for i, x in enumerate(steps) if not x[3]), len(steps) - 1)
    def audit_time(action, entity_id):
        row = db.execute("SELECT created_at FROM audit_log WHERE user_id=? AND entity_id=? AND action=? ORDER BY created_at DESC LIMIT 1", (claim["user_id"], entity_id, action)).fetchone()
        return row["created_at"] if row else None
    stamps = {"POLICY_CONFIRMED": audit_time("policy_facts_confirmed", policy["id"]) if policy else None,
              "INCIDENT_REVIEWED": audit_time("claim_critical_fields_confirmed", claim["id"]),
              "DOCUMENTS_READY": audit_time("evidence_user_confirmed", claim["id"]),
              "PACKAGE_PREPARED": next((e["created_at"] for e in exports if e["mode"] == "prepared"), None)}
    actual_stages = [{"id": ident, "label": en, "label_zh": zh, "state": "done" if done else "current" if i == active_index else "upcoming", "actor": actor, "next_action": action,
                      "at": stamps.get(ident) if done else None, "timestamp_source": "Recorded audit / export time" if done and stamps.get(ident) else "Not recorded / incomplete", "provenance": "Application preparation records", "is_simulated": False} for i, (ident, en, zh, done, actor, action) in enumerate(steps)]
    actual = {"current_stage": steps[active_index][0], "actor": steps[active_index][4], "next_action": steps[active_index][5], "stages": actual_stages, "is_simulated": False, "submitted": False}
    key = f"actual:{claim['revision']}:{active_index}:{sum(x['missing'] for x in checklist)}:{len(validation['inconsistencies'])}"
    notify(db, claim, key, "preparation", steps[active_index][1], steps[active_index][2], steps[active_index][5])
    current = state(db, claim)
    events = [dict(row) | {"label": "SIMULATED", "is_simulated": True} for row in db.execute("SELECT s.*,d.actor,d.next_action,d.source_label,d.clock_day FROM claim_simulations s LEFT JOIN claim_simulation_details d ON d.event_id=s.id WHERE s.claim_id=? AND s.user_id=? ORDER BY s.rowid", (claim["id"], claim["user_id"]))]
    seen = {event["stage"]: event for event in events}
    current_stage = current["status"] if current else None
    order = ["RECEIVED", "IN_REVIEW", "INFO_REQUESTED", "ASSESSMENT", "DECLINED" if current_stage in {"DECLINED", "APPEAL_REQUESTED"} else "APPROVED", "PAID"]
    if current_stage == "APPEAL_REQUESTED":
        order.insert(-1, "APPEAL_REQUESTED")
    sim_stages = [STAGE_INFO[ident] | {"state": "current" if current_stage == ident else "done" if ident in seen else "upcoming", "at": seen.get(ident, {}).get("created_at"), "provenance": "SIMULATED insurer event", "is_simulated": True} for ident in order]
    simulated = {"current_stage": current_stage, "clock_day": current["clock_day"] if current else 0, "allowed_next_stages": NEXT.get(current_stage, []), "stages": sim_stages, "is_simulated": True,
                 "receipt_reference": current["receipt_reference"] if current else None, "events": events, "start_mode": current["start_mode"] if current else None,
                 "case_revision": current["revision"] if current else None, "current_revision_matches": bool(current and current["revision"] == claim["revision"]), "notice": "Entire insurer pipeline is simulated. It cannot change actual preparation or prove receipt, decision, appeal or payment."}
    return {"actual": actual, "insurer_simulation": simulated}


def explanation(db, claim, mode, channel_url, wording_url, clause=None):
    if mode == "actual":
        updates = db.execute("SELECT note,provenance,event_at FROM claim_updates WHERE claim_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1", (claim["id"], claim["user_id"])).fetchone()
        return {"status": claim["status"], "why": "The app prepares documents. There is no insurer connection, so it cannot know an insurer's queue or decision." + (" The latest user-sourced note is available in the actual updates section." if updates else " No official acknowledgement has been independently verified."),
                "waiting_on": "You / official insurer channel", "next_actions": ["Resolve missing or inconsistent facts.", "Review and download the package.", "Use the insurer's official channel and retain its acknowledgement."], "letter": None, "appeal": None, "is_simulated": False, "source_url": channel_url}
    current = state(db, claim)
    stage = current["status"] if current else None
    info = STAGE_INFO.get(stage, {})
    why = SIM_NOTES.get(stage, "The simulator has not started. Review and confirm its synthetic submission separately.")
    letter = {"quote": SIM_NOTES["DECLINED"], "source_label": "SYNTHETIC scenario letter, not insurer correspondence", "source_url": None} if stage in {"DECLINED", "APPEAL_REQUESTED"} else None
    return {"status": stage, "why": why, "waiting_on": info.get("actor", "You (simulation)"), "next_actions": [info.get("next_action", "Start the simulator explicitly.")], "letter": letter, "clause": clause,
            "appeal": {"steps": ["Read the actual insurer letter and identify the exact clause and missing fact.", "Provide factual clarification or request review through the insurer's official complaint / claim channel.", "If unresolved, use the competent official dispute channel for the actual insurer and jurisdiction. The AI cannot overturn a decision."], "source_url": channel_url} if letter else None,
            "is_simulated": True, "wording_reference": wording_url, "notice": "The quoted decline is explicitly synthetic and is not a claim about the user's policy or legal deadline."}
