# Demo video script — Video A: AR claim evidence · Video B: S4 claim end to end

Your parts are **S4 "Claim end to end"** (domestic claim) and the **AR evidence capture**. S3 is the Thailand
cross-border claim, which is someone else's. Both flows below were played headless on 2026-10-20 on `main` + this
branch with no page errors: S4 autoplay finishes in about 37 s at 1×, and AR rejects an early shot then accepts 4.

| Scenario | Name in the app | Owner |
|---|---|---|
| S1 | Upload and understand a policy | — |
| S2 | Compare with a judge (insurance comparison) | — |
| S3 | Claim abroad (Thailand), cross-border | not you |
| **S4** | **Claim end to end**: pre-screen, documents, confirm, submit | **you** |
| S5 | Attack: hidden instruction in a document | — |
| S6 | Attack: over-reach (payout change, wife's policy, fake insurer staff) | — |
| S7 | Fallback and handoff | — |

---

## Video A — AR claim evidence (≈ 45 s)

Story: a minor car collision in Nanshan, Shenzhen. The app guides the driver through four evidence photos.

**Footage you can use** (all AI-generated: fictional car, plate 粤B·5MT32 and street; no real person or vehicle):

- `ar-walkthrough-en.mp4` / `ar-walkthrough-zh.mp4`: screen recording of the app's AR screen at phone size
  (860×1864, 34 s). Use it as-is, or as a reference for your own take.
- `evidence-broll/*.mp4`: 4 s handheld-style clips of each shot (1080×1440), plus `evidence-reel.mp4` (14.5 s). Cut
  these in as "what the person sees through the phone" before or next to the app screen.
- To record it yourself: `http://localhost:5173/capture?lang=en&mockcam=1`. `mockcam=1` shows the four photos
  instead of your webcam; without a camera it does this automatically.

| # | Do | On screen | Say |
|---|---|---|---|
| 1 | B-roll: `wide.mp4` | Handheld view of the damaged car | "After a crash, most people don't know which photos the insurer needs." |
| 2 | Open *Claims → Capture scene evidence (AR guide)* | Camera view, white brackets, "1 / 4" | "WeWise turns the camera into a checklist, shot by shot." |
| 3 | Tap the shutter immediately | Image out of focus → "Too early: the shot is blurry" | "Shoot before it's steady and it refuses the blurry photo…" |
| 4 | Wait for **green** brackets, shoot | *Whole vehicle · Sharp* | "…wait for the green frame, and it's accepted." |
| 5 | Shoot damage, plate, surroundings | 2/4, 3/4, 4/4, thumbnails fill in | "The damage close-up, the number plate, the road and signs." |
| 6 | Scroll to *Evidence pack ready* | Fingerprint · time · Nanshan, Shenzhen · plate masked | "Each photo is fingerprinted so tampering shows, time-stamped and located, and the plate is masked in the shared copy." |
| 7 | **Attach to my claim** | *Attached to your claim* | "One tap attaches it to the claim." |

Avoid on camera: don't tap **Open claim** after attaching, because it opens the dengue claim from Video B.

---

## Video B — S4 claim end to end + claim features (≈ 2:15)

Story: 林美 (Mei) was admitted to hospital with dengue on 10 Oct and claims on her Ping An e-Sheng Bao Medical.

Open `http://localhost:5173/?scenario=4&lang=en` at least 1600 px wide (stage panel, phone and Agent Inspector all
visible). 1× is too fast to narrate: press **Space** to pause, **→** for one step at a time. **R** resets.

### Part 1 — the claim (scripted S4, ≈ 1:35)

| # | Press → for | On screen | Say | Point at in Inspector |
|---|---|---|---|---|
| 1 | "I was admitted on 10 Oct" | *Claim pre-screen · Likely covered*: waiting period timeline, no exclusions, still needed: discharge summary, itemised bill | "Mei tells WeWise she was admitted on 10 October. Before any paperwork it pre-screens: waiting period served, no exclusion matched, and two documents still missing." | `policy_lookup` → `waiting_period_check` → `exclusion_check`; **Verify: citations ✓ numbers ✓** (HS-4.2, HS-7.1) |
| 2 | (same answer) | "Only the insurer decides… submit by about 11 Jan 2027 [HS-7.1]" | "It never promises approval, and it gives the deadline from the clause." | Tap the `HS-7.1` chip to show the source |
| 3 | "Prepare my documents" | Checklist, 3 of 5 ready | "It builds the checklist for a hospitalisation claim and checks what's already on file." | `checklist_build`, `claim_docs_list` |
| 4 | → (claim opens) | Step 1 *Confirm policy* → Step 2 *Prepare claim documents*, the 5 AI agents | "In the claim, five agents do the paperwork: collect documents, cross-check, check the bill, fill the form, chase what's missing." | — |
| 5 | Upload discharge summary | Fields read; **discharge date earlier than admission** flagged | "It reads the discharge summary, masks her name, and catches that the discharge date is before the admission date." | `ocr_extract` (T1), **guard.pii_masked**, `consistency_check` ✗ |
| 6 | Fix → 13 Oct, upload bill, confirm all | 5 / 5 prepared | "She corrects it, adds the bill, which adds up, and confirms every field herself." | `consistency_check` ✓ |
| 7 | Step 3 *Review and submit* | All confirmed · total ¥18,420 · payout account read-only •••• 4821 | "The payout account is read-only. WeWise can't change where money goes." | — |
| 8 | Submit | **Confirm** sheet: what is sent, to whom, expires in 5 min | "Submitting is irreversible, so nothing is sent until she confirms." | **guard.confirm_required**, `claim_submit` is **T3** |
| 9 | (submitted) | *Submitted · HM-CL-70418*, timeline | "Submitted. Materials prepared is not approval: the insurer reviews it now." | — |
| 10 | Advance 3 days | Push: *Ping An needs one more thing* → *Info requested · Waiting on you* | "Three days later the insurer asks for a pharmacy bill, and WeWise tells her straight away." | `notify.push` |
| 11 | "Why is it taking long?" | Plain-language answer: waiting on you, next step, 90-day deadline | "And it explains the delay in plain words: it's waiting on her, not the insurer." | Verify ✓ |

### Part 2 — the rest of the claim features (manual, ≈ 40 s)

Pause autoplay, then tap through:

| # | Tap | Show | Say |
|---|---|---|---|
| 12 | **Claims** tab | *Needs your action* vs *In progress and closed*, "Waiting on you" badges | "All her claims in one place, sorted by who has to act." |
| 13 | *Ankle fracture treatment* | Info requested, timeline | "Another claim, with the insurer's request shown on its timeline." |
| 14 | *Illness treatment, Dec 2025* | **Why it was declined**, with the clause quoted; *What you can do next*: add information, appeal, regulator hotline 12378 | "When a claim is declined, it shows the exact clause and what she can do: add information, appeal, or call the regulator. It explains, but it can't overturn." |
| 15 | *Capture scene evidence (AR guide)* | AR screen | "And for accidents, the AR guide from the other video." (cut to Video A, or end here) |

### Recording checklist

- [ ] `?lang=en` take and `?lang=zh` take if both are needed
- [ ] Reset (**R**) before every take; **Attack: OFF**
- [ ] Browser zoom 100 %, notifications off, 1080p or higher
- [ ] Keep the top banner "Guided simulator · preset conversations": it's the honest label for judges
- [ ] After a good S4 take, export the Inspector **JSON** and add it to `docs/evidence/06-execution-evidence/`
