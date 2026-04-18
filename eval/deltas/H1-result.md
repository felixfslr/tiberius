# Eval Delta — eval/baselines/before-H1.json → eval/baselines/after-H1.json

- Before: 2026-04-18T18:17:38.984Z (n=9)
- After:  2026-04-18T18:25:48.885Z (n=9)

## Aggregate deltas

| Group | Metric | Before | After | Δ |
|---|---|---|---|---|
| overall | n | 9.00 | 9.00 | 0.00 |
| overall | pass_rate | 0.67 | 0.67 | 0.00 |
| overall | quality_avg | 2.33 | 2.44 | +0.11 |
| overall | confidence_avg | 0.72 | 0.75 | +0.03 |
| synthetic | n | 2.00 | 2.00 | 0.00 |
| synthetic | pass_rate | 0.50 | 0.50 | 0.00 |
| synthetic | quality_avg | 2.50 | 2.00 | -0.50 |
| ivy_real | n | 7.00 | 7.00 | 0.00 |
| ivy_real | pass_rate | 0.71 | 0.71 | 0.00 |
| ivy_real | quality_avg | 2.29 | 2.57 | +0.29 |
| ivy_real | gold_alignment_avg | 1.29 | 1.29 | 0.00 |
| ivy_real | intent_match_avg | 1.00 | 1.00 | 0.00 |
| ivy_real | stage_appropriateness_avg | 2.00 | 2.00 | 0.00 |
| ivy_real | tone_match_avg | 3.00 | 2.86 | -0.14 |

## Notable movers (|Δquality|≥1 or |Δgold|≥1)

- **convo_01-turn1**: quality 2.00 → 3.00 (+1.00), gold 2.00 → 2.00 (0.00)
- **convo_01-turn2**: quality 1.00 → 2.00 (+1.00), gold 1.00 → 2.00 (+1.00)
- **pricing-cold**: quality 1.00 → 0.00 (-1.00)
- **scheduling-positive**: quality 4.00 → 5.00 (+1.00), gold 2.00 → 1.00 (-1.00)
- **convo_17-turn1**: quality 2.00 → 1.00 (-1.00), gold 1.00 → 1.00 (0.00)

## Per-case detail

| id | quality | Δ | gold | Δ | conf | Δ |
|---|---|---|---|---|---|---|
| competitor-objection | 4.00→4.00 | 0.00 | —→— | — | 0.73→0.93 | +0.20 |
| convo_01-turn1 | 2.00→3.00 | +1.00 | 2.00→2.00 | 0.00 | 0.70→0.70 | -0.00 |
| convo_01-turn2 | 1.00→2.00 | +1.00 | 1.00→2.00 | +1.00 | 0.70→0.70 | +0.00 |
| convo_17-turn1 | 2.00→1.00 | -1.00 | 1.00→1.00 | 0.00 | 0.69→0.69 | 0.00 |
| convo_17-turn2 | 2.00→2.00 | 0.00 | 1.00→1.00 | 0.00 | 0.70→0.70 | -0.00 |
| convo_18-turn2 | 2.00→2.00 | 0.00 | 1.00→1.00 | 0.00 | 0.70→0.71 | +0.01 |
| hard-factual-unknown | 3.00→3.00 | 0.00 | 1.00→1.00 | 0.00 | 0.71→0.71 | +0.00 |
| pricing-cold | 1.00→0.00 | -1.00 | —→— | — | 0.81→0.89 | +0.08 |
| scheduling-positive | 4.00→5.00 | +1.00 | 2.00→1.00 | -1.00 | 0.71→0.70 | -0.00 |

