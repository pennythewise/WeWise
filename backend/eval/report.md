# WeWise executable evaluation

Measured 2026-10-20T07:04:36.812271+00:00. Base commit `a4a30921a43186972057e5a8f37a8ef4050165b6`; working tree dirty: True.

| Corpus | Passed | Failed | Skipped | Not run |
|---|---:|---:|---:|---:|
| task | 167 | 0 | 2 | 0 |
| attack | 164 | 0 | 1 | 0 |
| support | 0 | 0 | 0 | 0 |

Total measured suite time: 236.58 seconds.

## Interpretation

- Local synthetic regression checks; no live insurer or model-provider acceptance.
- Test durations include setup and do not measure user-turn latency.
- Pass rate describes the named executable corpus, not general hallucination or attack resistance.
- Optional integration skips are not passes. Live provider accuracy, tokens and cost remain unmeasured.

Run `python backend/eval/run.py` to regenerate. See `docs/qa/agent-measurements-local.json` for separately measured streaming turn timings and `docs/REQUIREMENTS_STATUS.md` for feature boundaries.
