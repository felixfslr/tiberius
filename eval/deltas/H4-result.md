# Eval Delta — eval/baselines/before-H4.json → eval/baselines/after-H4.json

- Before: 2026-04-18T18:35:40.727Z (n=9)
- After:  2026-04-18T18:39:32.600Z (n=9)

## Aggregate deltas

| Group | Metric | Before | After | Δ |
|---|---|---|---|---|
| overall | n | 9.00 | 9.00 | 0.00 |
| overall | pass_rate | 0.78 | 0.78 | 0.00 |
| overall | quality_avg | 2.78 | 2.56 | -0.22 |
| overall | confidence_avg | 0.74 | 0.73 | -0.01 |
| synthetic | n | 2.00 | 2.00 | 0.00 |
| synthetic | pass_rate | 1.00 | 1.00 | 0.00 |
| synthetic | quality_avg | 4.50 | 5.00 | +0.50 |
| ivy_real | n | 7.00 | 7.00 | 0.00 |
| ivy_real | pass_rate | 0.71 | 0.71 | 0.00 |
| ivy_real | quality_avg | 2.29 | 1.86 | -0.43 |
| ivy_real | gold_alignment_avg | 1.43 | 1.29 | -0.14 |
| ivy_real | intent_match_avg | 1.00 | 0.86 | -0.14 |
| ivy_real | stage_appropriateness_avg | 2.14 | 1.86 | -0.29 |
| ivy_real | tone_match_avg | 3.00 | 3.00 | 0.00 |

## Notable movers (|Δquality|≥1 or |Δgold|≥1)

- **competitor-objection**: quality 4.00 → 5.00 (+1.00)
- **convo_18-turn2**: quality 1.00 → 2.00 (+1.00), gold 1.00 → 1.00 (0.00)
- **scheduling-positive**: quality 2.00 → 2.00 (0.00), gold 2.00 → 1.00 (-1.00)
- **convo_01-turn1**: quality 3.00 → 2.00 (-1.00), gold 2.00 → 2.00 (0.00)
- **convo_17-turn1**: quality 3.00 → 2.00 (-1.00), gold 1.00 → 1.00 (0.00)
- **hard-factual-unknown**: quality 4.00 → 2.00 (-2.00), gold 1.00 → 1.00 (0.00)

## Per-case detail

| id | quality | Δ | gold | Δ | conf | Δ |
|---|---|---|---|---|---|---|
| competitor-objection | 4.00→5.00 | +1.00 | —→— | — | 0.93→0.86 | -0.07 |
| convo_01-turn1 | 3.00→2.00 | -1.00 | 2.00→2.00 | 0.00 | 0.70→0.70 | -0.00 |
| convo_01-turn2 | 2.00→2.00 | 0.00 | 2.00→2.00 | 0.00 | 0.70→0.70 | -0.00 |
| convo_17-turn1 | 3.00→2.00 | -1.00 | 1.00→1.00 | 0.00 | 0.69→0.69 | +0.01 |
| convo_17-turn2 | 1.00→1.00 | 0.00 | 1.00→1.00 | 0.00 | 0.70→0.70 | 0.00 |
| convo_18-turn2 | 1.00→2.00 | +1.00 | 1.00→1.00 | 0.00 | 0.71→0.71 | 0.00 |
| hard-factual-unknown | 4.00→2.00 | -2.00 | 1.00→1.00 | 0.00 | 0.71→0.71 | -0.00 |
| pricing-cold | 5.00→5.00 | 0.00 | —→— | — | 0.83→0.79 | -0.04 |
| scheduling-positive | 2.00→2.00 | 0.00 | 2.00→1.00 | -1.00 | 0.71→0.69 | -0.01 |

