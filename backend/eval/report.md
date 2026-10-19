# WeWise executable evaluation

Measured 2026-10-19T18:40:55.769250+00:00. Base commit `e426e262e020fc1d77364d5a02a7f22002874280`; working tree dirty: True.

| Corpus | Passed | Failed | Skipped | Not run |
|---|---:|---:|---:|---:|
| task | 164 | 0 | 2 | 0 |
| attack | 158 | 0 | 1 | 0 |
| support | 0 | 0 | 0 | 0 |

Total measured suite time: 137.775 seconds.

## Interpretation

- Local synthetic regression checks; no live insurer or model-provider acceptance.
- Test durations include setup and do not measure user-turn latency.
- Pass rate describes the named executable corpus, not general hallucination or attack resistance.
- Optional integration skips are not passes. Live provider accuracy, tokens and cost remain unmeasured.

Run `python backend/eval/run.py` to regenerate. See `docs/qa/agent-measurements-local.json` for separately measured streaming turn timings and `docs/REQUIREMENTS_STATUS.md` for feature boundaries.
