for (fold in folds$splits) {
  training <- rsample::analysis(fold)
  fitted <- tune::tune_grid(model, resamples = rsample::vfold_cv(training))
}
