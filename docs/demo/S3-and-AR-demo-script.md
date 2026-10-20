# Demo video script — S3 Claim abroad + AR evidence guidance

Target length about **2:30** (S3 ≈ 1:45, AR ≈ 0:45). Both flows were played end to end on 2026-10-20 with no page
errors: S3 autoplay finishes in about 41 s at 1×, and AR rejects an early shot then accepts 4 sharp ones.

## Before you record

| Item | Setting |
|---|---|
| S3 | Laptop, browser at least 1600 px wide so the stage panel, phone and Agent Inspector all show. `http://localhost:5173/?scenario=3&lang=en` (add `&lang=zh` for a Chinese take) |
| AR | **A real phone** pointed at a real car (or a toy car on a desk). Same app URL + `/capture?lang=en&record=1`. Without a camera it falls back to a synthetic scene |
| Pacing | Speed only goes 1× / 2× / 4×, and 1× is too fast to narrate. Press **Space** to pause, then **→** to run one step at a time while you talk |
| Clean frame | `?record=1` hides the stage controls (use it for phone-only shots). Keep the top banner "Guided simulator · preset conversations": it is the honest label for judges |
| Reset | **R** resets between takes. `Attack: OFF` must stay off for S3 |

## Segment A — S3 Claim abroad (≈ 1:45)

Story: 林美 is on her Thailand trip and is admitted to hospital in Phuket with dengue.

| # | Press → for | On screen | Say (≈ one breath) | Point at in Inspector |
|---|---|---|---|---|
| 1 | "I'm in hospital in Phuket with dengue. Am I covered?" | Answer + policy card | "Mei is in hospital in Phuket. WeWise finds her travel policy and answers with the exact clause: covered up to ¥500,000, but she must call within 48 hours." | Plan with 3 steps; **Verify: Citations ✓ Numbers ✓**; tap a `TR-3.1` chip to show the source |
| 2 | "What should I do right now?" | Incident guide: local numbers, steps, *Capture evidence with AR guide* | "Health first. Local emergency numbers, what to do, what to avoid, and a deadline reminder." | `incident_library` tool, T0 |
| 3 | Contact the hospital | Connect-party card → *Hospital contacted* notification | "With one tap the insurer's assistance team contacts the hospital and arranges direct billing, so Mei doesn't pay first." | `assistance_case_open` (T2) → `party_invite` (T3); **guard.pii_masked**. In the card, *What they will see: policy number (masked)* |
| 4 | "Here are the Thai hospital bill and discharge note" | Bill and note read and translated | "She uploads the Thai documents. WeWise reads and translates them, and flags that the discharge date is before admission." | `ocr_extract` (T1) → `translate` → `consistency_check` ✗ |
| 5 | "The discharge date should be 25 Dec" | Corrected facts, ¥42,000 estimate | "She corrects it, everything now agrees, and the ¥42,000 estimate is computed by code, not by the model." | `consistency_check` ✓ → `bill_check` |
| 6 | "Prepare my claim kit" | Kit list + **confirm card** | "Everything goes into one claim kit: summary, Thai originals, translations, pre-filled form." | `crossborder_kit_build` (T1) → **`guard.confirm_required`** |
| 7 | Confirm | *Confirmed* | "Nothing leaves without her confirmation, and WeWise never submits for her. She downloads it and submits through the insurer's official channel." | Token-bound confirmation |
| 8 | "How long will it take?" | Plain-language timeline | "It won't promise a date, because only the insurer decides, but it explains what happens next." | Verify ✓ |
| end | Tap **Claims** tab | Claim progress synced | "The claim tab follows along, step by step." | — |

Cut tip: steps 3–5 are the longest. If you need to save time, speed through 4 at 2×.

## Segment B — AR claim evidence guidance (≈ 0:45)

Frame it as a **traffic incident** (the guide asks for vehicle, damage, plate and surroundings). Do not splice it
inside the dengue story, which would look inconsistent.

| # | Do | On screen | Say |
|---|---|---|---|
| 1 | Open *Capture evidence* | Camera with corner brackets, "Whole vehicle · step back…", 1/4 | "After an accident, people don't know what photos the insurer needs. WeWise guides them shot by shot." |
| 2 | Tap **Take photo** immediately | "Too early: the shot is blurry" | "Shoot too early and it refuses the blurry photo…" |
| 3 | Wait for **green** brackets, shoot | Shot 1 Sharp | "…wait for the green frame, and it's accepted." |
| 4 | Move closer → damage; plate; surroundings | 2/4, 3/4, 4/4 | "Close-up of the damage, the number plate, the surroundings." |
| 5 | Scroll to *Evidence pack ready* | Fingerprint, time, place, plate masked | "Each photo is fingerprinted so tampering can be detected, time-stamped, located, and the plate is masked in the shared copy." |
| 6 | **Attach to my claim** | *Attached to your claim* | "One tap attaches it to the claim checklist." End here. |

Avoid on camera:
- **Don't tap "Open claim"** at the end. It opens the sample dengue hospitalisation claim.
- The evidence pack says *Shenzhen* for location and the top notice says *"the camera view is a synthetic scene"*
  even with a live camera. Record in a way that doesn't dwell on these lines, or ask for the small fixes below.

## Closing line tying to deliverable 06 (optional, 5 s)

"Every step you just saw also runs on our live backend sandbox: 72 logged operations, 98 checks, 0 failures,
attacks refused before any tool runs." Show `docs/evidence/06-execution-evidence/README.md` or the
Agent Inspector **JSON** export for a second.

## Recording checklist

- [ ] Browser zoom 100%, notifications off, 1080p or higher, cursor highlight on
- [ ] Fresh reset (**R**) before each take; Attack OFF
- [ ] English take and Chinese take (`?lang=zh`) if both are required
- [ ] AR: phone brightness up, landscape off, real object in frame
- [ ] Export the Inspector JSON after a good S3 take and add it to the evidence folder
