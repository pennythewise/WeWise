# WeWise executable evaluation

Measured 2026-10-17T15:48:59.756598+00:00. Base commit `dafa7701a3e9b21578b47a61aeb06e79b12f5b72`; working tree dirty: True.

| Corpus | Passed | Failed | Skipped | Not run |
|---|---:|---:|---:|---:|
| task | 161 | 0 | 2 | 0 |
| attack | 138 | 0 | 1 | 0 |
| support | 0 | 0 | 0 | 0 |

Total measured suite time: 226.364 seconds.

## Interpretation

- Local synthetic regression checks; no live insurer or model-provider acceptance.
- Test durations include setup and do not measure user-turn latency.
- Pass rate describes the named executable corpus, not general hallucination or attack resistance.
- Optional integration skips are not passes. Live provider accuracy, tokens and cost remain unmeasured.

Run `python eval/run.py` to regenerate. See `docs/qa/agent-measurements-local.json` for separately measured streaming turn timings and `docs/REQUIREMENTS_STATUS.md` for feature boundaries.
