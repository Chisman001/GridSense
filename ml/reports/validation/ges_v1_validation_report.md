# GES v1 validation report

Status: **non-production validation only**. No application, schema, model, or UI files were modified.

## Approved methodology

- Components: Cost Burden 50%, Generator Dependency 25%, Operational Reliability 25%.
- Raw formulas: `C = total_energy_cost / monthly_revenue`; `D = generator_hours / (generator_hours + grid_hours)`; `S = outage_hours / (operating_hours_per_day * days_in_month)`.
- CostScore = `100 * (1 - min(max(C, 0), 1))`.
- GenScore uses frozen `Dmin=0.006077`, `Dmax=0.241246`.
- OpScore uses frozen `Smin=0.048013`, `Smax=0.296079`.
- GES = `0.50*CostScore + 0.25*GenScore + 0.25*OpScore`, clamped to `[0, 100]`.
- Bands: 90–100 Excellent, 75–89 Good, 50–74 Needs Improvement, 0–49 Critical.
- Invalid inputs yield unavailable GES, not an imputed value.

Dataset: `C:\Proj\GridSense\ml\datasets\final\energy_records.csv`
Rows: 3600
Generated at: 2026-08-13T15:28:30.981942+00:00

## Component statistics

| Metric | n | min | P10 | P25 | P50 | P75 | P90 | P95 | max | mean | std |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| cost_burden | 3600 | 0.007871 | 0.098470 | 0.172120 | 0.272548 | 0.429795 | 0.652804 | 0.847821 | 1.763366 | 0.338389 | 0.251393 |
| cost_score | 3600 | 0.000000 | 34.719593 | 57.020536 | 72.745163 | 82.787973 | 90.153049 | 93.470759 | 99.212898 | 66.855948 | 22.676036 |
| generator_dependency | 3600 | 0.006077 | 0.030694 | 0.050678 | 0.077371 | 0.111698 | 0.139998 | 0.156509 | 0.241246 | 0.082663 | 0.041871 |
| gen_score | 3600 | 0.000000 | 43.053331 | 55.087272 | 69.683732 | 81.034506 | 89.532157 | 92.874006 | 100.000000 | 67.433544 | 17.804499 |
| outage_fraction | 3600 | 0.048013 | 0.075317 | 0.092676 | 0.120650 | 0.148788 | 0.177217 | 0.198781 | 0.296079 | 0.124183 | 0.040541 |
| op_score | 3600 | 0.000009 | 47.915402 | 59.375738 | 70.718727 | 81.995520 | 88.993379 | 91.544802 | 100.000000 | 69.294291 | 16.342904 |
| ges | 3600 | 16.716086 | 47.815753 | 59.279633 | 69.570224 | 78.224928 | 84.204647 | 87.711177 | 95.974778 | 67.609932 | 14.288054 |

## Rating distribution

- Available scores: 3600
- Unavailable scores: 0

- Excellent: 106 (2.94%)
- Good: 1124 (31.22%)
- Needs Improvement: 1932 (53.67%)
- Critical: 438 (12.17%)

## Representative records

- `REC-000049` Bakery SME 003 (Bakery, Solar): C=0.0858, D=0.0176, S=0.1520, CostScore=91.42, GenScore=95.10, OpScore=58.10, GES=84.01 (Good)
- `REC-000001` Factory SME 001 (Factory, Generator): C=0.2984, D=0.1075, S=0.1180, CostScore=70.16, GenScore=56.87, OpScore=71.77, GES=67.24 (Needs Improvement)
- `REC-000005` Factory SME 001 (Factory, Generator): C=0.2620, D=0.2086, S=0.2265, CostScore=73.80, GenScore=13.89, OpScore=28.05, GES=47.39 (Critical)
- `REC-000025` Cold Room SME 002 (Cold Room, Grid): C=1.0782, D=0.0501, S=0.0807, CostScore=0.00, GenScore=81.30, OpScore=86.80, GES=42.03 (Critical)
- `REC-001241` Hospital SME 052 (Hospital, Generator): C=1.7634, D=0.1501, S=0.1501, CostScore=0.00, GenScore=38.76, OpScore=58.85, GES=24.40 (Critical)
- `REC-003386` Factory SME 142 (Factory, Hybrid): C=0.2157, D=0.2275, S=0.2961, CostScore=78.43, GenScore=5.86, OpScore=0.00, GES=40.68 (Critical)

## Boundary behavior

- `cost_revenue_zero`: GES 84.02
- `cost_revenue_half`: GES 59.02
- `cost_revenue_at_one`: GES 34.02
- `cost_revenue_above_one`: GES 34.02
- `d_below_dmin`: GES 79.00
- `d_above_dmax`: GES 54.00
- `s_below_smin`: GES 75.02
- `s_above_smax`: GES 50.02
- `invalid_zero_revenue`: GES unavailable
- `invalid_zero_powered_hours`: GES unavailable
- `invalid_zero_operating_hours`: GES unavailable
- `invalid_month`: GES unavailable

## Correlations

Pearson and Spearman matrices are in the JSON report. Correlation is not causation.

## Observations

- GES was recomputed from raw fields; stored generator_dependency and outage_severity were not used as scoring inputs.
- energy_efficiency_score is absent from the ML dataset and was not used.
- All 3,600 records produced a valid GES.
- 115 records have cost burden >= 1.0 and therefore CostScore = 0.
- Calibration clips: D below Dmin=1, D above Dmax=1, S below Smin=1, S above Smax=0.
- Approved rating bands on this dataset: Excellent 2.94%, Good 31.22%, Needs Improvement 53.67%, Critical 12.17%.

## Warnings

- Some synthetic months have energy cost greater than monthly revenue. Those rows receive CostScore 0 and are pulled toward Critical.
- Frozen D/S min-max constants are taken from this synthetic snapshot. Live app records with operating_hours stored as monthly hours would mis-compute S.
- The application currently lets users type generatorDependency, outageSeverity, revenueEnergyRatio, and energyEfficiencyScore. Production GES must ignore those columns.

## Production changes

None. This validation did not modify schema, APIs, Analytics, Reports, Forecast, or historical scores.

