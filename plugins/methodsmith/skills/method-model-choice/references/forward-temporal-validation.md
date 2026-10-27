# Forward temporal validation

Fix the intended validation target before selecting a splitter.

- Future deployment requires rolling or expanding calendar windows: train only on earlier observations and assess later periods. Fit preprocessing, tuning, and calibration within the same temporal boundaries.
- Keep patients grouped across training and assessment. Apply a gap or purge when needed for overlapping prediction windows, delayed labels, or outcome maturation; for a 90-day outcome, confirm training labels would be available at the assessment origin.
- `LeaveOneGroupOut` on calendar period uses every other period for training, including future periods. It can assess a justified historical period-transport target, but cannot establish forward performance. Label that target explicitly.
- `TimeSeriesSplit` assumes ordered samples and equally spaced samples for comparable fold durations. Irregular clinical cohorts may require explicit calendar windows. Check its gap units and patient boundaries; a row-count gap does not automatically represent a clinical time interval.
- Preserve chronology even when outcome stratification would improve class balance. Report period-specific sample sizes, events, calibration, and discrimination.

Source: [scikit-learn TimeSeriesSplit documentation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html). Site and period transport remain distinct from forward prediction.
