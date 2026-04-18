# Eval Delta — eval/baselines/before-H3.json → eval/baselines/after-H3.json

- Before: 2026-04-18T18:30:57.238Z (n=9)
- After:  2026-04-18T18:35:40.727Z (n=9)

## Aggregate deltas

| Group | Metric | Before | After | Δ |
|---|---|---|---|---|
| overall | n | 9.00 | 9.00 | 0.00 |
| overall | pass_rate | 0.78 | 0.78 | 0.00 |
| overall | quality_avg | 2.78 | 2.78 | 0.00 |
| overall | confidence_avg | 0.75 | 0.74 | -0.00 |
| synthetic | n | 2.00 | 2.00 | 0.00 |
| synthetic | pass_rate | 1.00 | 1.00 | 0.00 |
| synthetic | quality_avg | 4.50 | 4.50 | 0.00 |
| ivy_real | n | 7.00 | 7.00 | 0.00 |
| ivy_real | pass_rate | 0.71 | 0.71 | 0.00 |
| ivy_real | quality_avg | 2.29 | 2.29 | 0.00 |
| ivy_real | gold_alignment_avg | 1.29 | 1.43 | +0.14 |
| ivy_real | intent_match_avg | 1.00 | 1.00 | 0.00 |
| ivy_real | stage_appropriateness_avg | 2.00 | 2.14 | +0.14 |
| ivy_real | tone_match_avg | 2.86 | 3.00 | +0.14 |

## Notable movers (|Δquality|≥1 or |Δgold|≥1)

- **hard-factual-unknown**: quality 3.00 → 4.00 (+1.00), gold 1.00 → 1.00 (0.00)
- **convo_01-turn1**: quality 2.00 → 3.00 (+1.00), gold 2.00 → 2.00 (0.00)
- **convo_01-turn2**: quality 2.00 → 2.00 (0.00), gold 1.00 → 2.00 (+1.00)
- **scheduling-positive**: quality 3.00 → 2.00 (-1.00), gold 2.00 → 2.00 (0.00)
- **convo_18-turn2**: quality 2.00 → 1.00 (-1.00), gold 1.00 → 1.00 (0.00)

## Per-case detail

| id | quality | Δ | gold | Δ | conf | Δ |
|---|---|---|---|---|---|---|
| competitor-objection | 4.00→4.00 | 0.00 | —→— | — | 0.93→0.93 | -0.00 |
| convo_01-turn1 | 2.00→3.00 | +1.00 | 2.00→2.00 | 0.00 | 0.70→0.70 | +0.00 |
| convo_01-turn2 | 2.00→2.00 | 0.00 | 1.00→2.00 | +1.00 | 0.70→0.70 | -0.00 |
| convo_17-turn1 | 3.00→3.00 | 0.00 | 1.00→1.00 | 0.00 | 0.71→0.69 | -0.02 |
| convo_17-turn2 | 1.00→1.00 | 0.00 | 1.00→1.00 | 0.00 | 0.70→0.70 | -0.00 |
| convo_18-turn2 | 2.00→1.00 | -1.00 | 1.00→1.00 | 0.00 | 0.71→0.71 | +0.00 |
| hard-factual-unknown | 3.00→4.00 | +1.00 | 1.00→1.00 | 0.00 | 0.71→0.71 | +0.00 |
| pricing-cold | 5.00→5.00 | 0.00 | —→— | — | 0.85→0.83 | -0.02 |
| scheduling-positive | 3.00→2.00 | -1.00 | 2.00→2.00 | 0.00 | 0.70→0.71 | +0.00 |

