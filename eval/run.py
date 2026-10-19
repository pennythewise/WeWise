"""Run the executable task/attack corpus and save evidence with honest limits.

Run with .venv/Scripts/python.exe eval/run.py. Provider keys and optional services
are disabled by isolated pytest fixtures. This reports regression assertions, not
real insurer acceptance, population-level AI accuracy or production assurance.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import statistics
import subprocess
import sys
import time

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class Evidence:
    def __init__(self):
        self.cases = {}

    def pytest_collection_modifyitems(self, items):
        for item in items:
            group = "attack" if item.get_closest_marker("attack") else "task" if item.get_closest_marker("task") else "support"
            self.cases[item.nodeid] = {"id": item.nodeid, "group": group, "status": "not_run", "seconds": 0}

    def pytest_runtest_logreport(self, report):
        entry = self.cases[report.nodeid]
        entry["seconds"] += report.duration
        if report.failed:
            entry.update(status="failed", failure=str(report.longrepr)[-5000:])
        elif report.skipped:
            entry["status"] = "skipped"
        elif report.when == "call" and entry["status"] != "failed":
            entry["status"] = "passed"


def main():
    evidence = Evidence()
    started = time.perf_counter()
    code = pytest.main([str(ROOT / "backend/tests"), "-q"], plugins=[evidence])
    cases = list(evidence.cases.values())
    sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, capture_output=True).stdout.strip()
    dirty = bool(subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, text=True, capture_output=True).stdout.strip())
    report = {"checked_at": datetime.now(timezone.utc).isoformat(), "base_commit": sha, "working_tree_dirty": dirty,
              "duration_seconds": round(time.perf_counter()-started, 3), "exit_code": int(code), "cases": cases,
              "limits": ["Local synthetic regression checks; no live insurer or model-provider acceptance.",
                         "Test durations include setup and do not measure user-turn latency.",
                         "Pass rate describes the named executable corpus, not general hallucination or attack resistance.",
                         "Optional integration skips are not passes. Live provider accuracy, tokens and cost remain unmeasured."]}
    out = ROOT / "eval"
    out.mkdir(exist_ok=True)
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# WeWise executable evaluation", "", f"Measured {report['checked_at']}. Base commit `{sha}`; working tree dirty: {dirty}.", "",
             "| Corpus | Passed | Failed | Skipped | Not run |", "|---|---:|---:|---:|---:|"]
    for group in ("task", "attack", "support"):
        group_cases = [c for c in cases if c["group"] == group]
        counts = [sum(c["status"] == status for c in group_cases) for status in ("passed", "failed", "skipped", "not_run")]
        lines.append(f"| {group} | " + " | ".join(map(str, counts)) + " |")
        folder = out / ("attack_suite" if group == "attack" else "golden_tasks" if group == "task" else "support")
        folder.mkdir(exist_ok=True)
        (folder / "cases.json").write_text(json.dumps(group_cases, ensure_ascii=False, indent=2), encoding="utf-8")
    lines += ["", f"Total measured suite time: {report['duration_seconds']} seconds.", "", "## Interpretation", ""] + ["- " + value for value in report["limits"]]
    lines += ["", "Run `python eval/run.py` to regenerate. See `docs/qa/agent-measurements-local.json` for separately measured streaming turn timings and `docs/REQUIREMENTS_STATUS.md` for feature boundaries."]
    failures = [c for c in cases if c["status"] == "failed"]
    if failures:
        lines += ["", "## Failures", ""] + [f"- `{c['id']}`" for c in failures]
    (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return int(code)


if __name__ == "__main__":
    raise SystemExit(main())
