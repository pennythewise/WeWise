# WeWise executable evaluation

Measured 2026-10-20T13:20:34.504792+00:00. Base commit `1bee5207df651253f0601054e8d0d0c291ce939b`; working tree dirty: False.

| Corpus | Passed | Failed | Skipped | Not run |
|---|---:|---:|---:|---:|
| task | 167 | 0 | 2 | 0 |
| attack | 180 | 0 | 1 | 0 |
| support | 24 | 0 | 0 | 0 |

Total measured suite time: 258.509 seconds.

## Interpretation

- Local synthetic regression checks; no live insurer or model-provider acceptance.
- Test durations include setup and do not measure user-turn latency.
- Pass rate describes the named executable corpus, not general hallucination or attack resistance.
- Optional integration skips are not passes. Live provider accuracy, tokens and cost remain unmeasured.

Run `python backend/eval/run.py` to regenerate. See `docs/qa/agent-measurements-local.json` for separately measured streaming turn timings and `docs/REQUIREMENTS_STATUS.md` for feature boundaries.
