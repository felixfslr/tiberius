# Failure Modes — baseline-2026-04-18.json

Generated from `eval/baselines/baseline-2026-04-18.json` (run at 2026-04-18T18:17:38.984Z, n=9).

## Per-dimension aggregates

| Dimension | n | mean | cases < 3 |
|---|---|---|---|
| quality | 9 | 2.33 | 6 |
| confidence | 9 | 0.72 | 9 |
| gold_alignment | 7 | 1.29 | 7 |
| intent_match | 7 | 1.00 | 6 |
| stage_appropriateness | 7 | 2.00 | 4 |
| tone_match | 7 | 3.00 | 2 |

**Systematically low dimensions (mean < 3.5):** confidence (0.72), intent_match (1.00), gold_alignment (1.29), stage_appropriateness (2.00), quality (2.33), tone_match (3.00)

## Top failures

### Lowest quality (top 3)
- **pricing-cold** — quality=1.00, conf=0.81, gold=—
  reply: "For EU fiat pay-ins, pricing is usage-based with no monthly minimums. SEPA Instant pay-ins start from 0.15% + €0.20 per …"
  violations: forbidden: 0.15%, bps
- **convo_01-turn2** — quality=1.00, conf=0.70, gold=1.00
  reply: "Thanks for the detailed context — that’s very helpful. Based on what you described, I don’t want to overstate anything o…"
- **convo_01-turn1** — quality=2.00, conf=0.70, gold=2.00
  reply: "Thanks for clarifying — I understand the setup and why Mollie may not fit. I can’t confirm from my side whether we can s…"

### Lowest gold_alignment (top 3, ivy_real only)
- **hard-factual-unknown** — gold=1.00 intent=1.00 stage=3.00 tone=3.00
  reply: "Thanks, that’s helpful. A VASP licence in India plus demand for EUR/GBP, including MENA, sounds like a good basis for th…"
- **convo_01-turn2** — gold=1.00 intent=1.00 stage=2.00 tone=3.00
  reply: "Thanks for the detailed context — that’s very helpful. Based on what you described, I don’t want to overstate anything o…"
- **convo_17-turn1** — gold=1.00 intent=1.00 stage=0.00 tone=3.00
  reply: "Great to meet you too, and sounds good — looking forward to speaking. In case it’s helpful, here’s the calendar link aga…"

### All failing assertions (3)
- **pricing-cold**: forbidden: 0.15%, bps
- **scheduling-positive**: intent product_fit ≠ expected scheduling
- **hard-factual-unknown**: tool none ∉ {flag_for_review,send_calendly_link}

## Top-3 failure-mode hypotheses (derived from signals above)

- **Tone drift** — replies sound less like Ferdi than the gold set (consider H-TONE: ingest Ferdi-style ToV examples).
- **Stage-mismatch** — replies are pitched at wrong funnel stage (consider H-STAGE: few-shot the state-tracker).
- **Intent drift** — draft pursues a different conversational move than the human would (consider H-SOP: extract implicit rules from training convos).

