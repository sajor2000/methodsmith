# Source-reported or explicitly reconstructed uncertainty on the analysis scale.
effect_uncertainty <- function(dat, is_ratio) {
  fail <- function(message) stop("pool_effects.R: uncertainty: ", message, call. = FALSE)
  field <- function(name, i, default = NA) {
    if (name %in% names(dat)) dat[[name]][[i]] else default
  }
  dat$te <- if (is_ratio) log(dat$effect) else dat$effect
  dat$se_te <- numeric(nrow(dat))
  dat$uncertainty_method <- character(nrow(dat))
  if (any(!is.finite(dat$te))) fail("effect must be finite on the analysis scale")
  for (i in seq_len(nrow(dat))) {
    provenance <- field("uncertainty_source", i)
    if (is.na(provenance) || !nzchar(trimws(as.character(provenance)))) {
      fail("each row needs uncertainty_source from the read source")
    }
    se <- field("standard_error", i)
    if (!is.na(se)) {
      if (!is.numeric(se) || !is.finite(se) || se <= 0) fail("standard_error must be finite and positive")
      scale <- field("standard_error_scale", i)
      if (is.na(scale) || scale != if (is_ratio) "log" else "identity") {
        fail("standard_error_scale must match the analysis scale (log for ratios, identity otherwise)")
      }
      dat$se_te[[i]] <- se
      dat$uncertainty_method[[i]] <- "reported_SE"
      next
    }
    method <- field("ci_method", i)
    if (is.na(method) || !method %in% c("wald_normal", "wald_t")) {
      fail("CI reconstruction requires wald_normal or wald_t; inspect unknown/non-Wald intervals")
    }
    level <- field("ci_level", i)
    if (!is.numeric(level) || !is.finite(level) || level <= 0 || level >= 1) {
      fail("ci_level must be an explicit fraction between 0 and 1")
    }
    critical <- qnorm((1 + level) / 2)
    if (method == "wald_t") {
      df <- field("ci_df", i)
      if (!is.numeric(df) || !is.finite(df) || df <= 0) fail("wald_t requires positive ci_df")
      critical <- qt((1 + level) / 2, df)
    }
    bounds <- c(field("effect_lo", i), field("effect_hi", i))
    if (!is.numeric(bounds) || any(!is.finite(bounds)) || (is_ratio && any(bounds <= 0))) {
      fail("CI bounds must be finite and valid for their scale")
    }
    if (is_ratio) bounds <- log(bounds)
    if (bounds[[1]] >= bounds[[2]] || dat$te[[i]] < bounds[[1]] || dat$te[[i]] > bounds[[2]]) {
      fail("CI bounds must be ordered and contain the effect")
    }
    tolerance <- field("ci_rounding_tolerance", i)
    if (!is.numeric(tolerance) || !is.finite(tolerance) || tolerance < 0) {
      fail("declare ci_rounding_tolerance on the analysis scale from source rounding")
    }
    roundoff <- 8 * .Machine$double.eps * max(abs(bounds), abs(dat$te[[i]]), if (is_ratio) 1 else 0)
    if (abs(mean(bounds) - dat$te[[i]]) > tolerance + roundoff) {
      fail("asymmetric CI exceeds source-rounding tolerance; do not symmetrize it")
    }
    dat$se_te[[i]] <- diff(bounds) / (2 * critical)
    if (!is.finite(dat$se_te[[i]]) || dat$se_te[[i]] <= 0) fail("invalid reconstructed standard error")
    dat$uncertainty_method[[i]] <- method
  }
  dat
}
