#!/usr/bin/env Rscript
# Random-effects meta-analysis (REML) over the methods CSV from /method-extract.
# Wraps `meta::metagen` with conventions appropriate for clinical effect-size pooling:
#   - Log-transform ratio metrics (HR / OR / RR), pool on log scale, exponentiate
#   - REML for tau^2 (less biased than DerSimonian-Laird for small k)
#   - Hartung-Knapp-Sidik-Jonkman CI (t, k-1 df) when tau^2 > 0, Wald z when
#     tau^2 = 0 (Cochrane Handbook v6.5, section 10.10.4.4)
#   - 95% prediction interval on t with k-1 df (method.predict = "V"; Cochrane
#     Handbook v6.5, section 10.10.4.3). Every method is pinned explicitly
#     because meta's defaults changed across versions.
#   - Forest plot saved as PNG
#
# Usage:
#   Rscript pool_effects.R \
#     --in analysis/effect-size/sepsis-bundle-parsed.csv \
#     --metric HR \
#     --out analysis/effect-size/sepsis-bundle-pooled.md \
#     [--min-n 0]
#
# Input CSV must have at minimum: pmid, year, first_author, sample_size,
# metric, effect (point), reviewed uncertainty (reported SE or declared Wald CI), and compatibility
# declarations (population, comparator, estimand, outcome, time_horizon, adjustment_specification,
# adjusted, analysis_scale, unit, study_design, independent_unit_id).
# The method-extract table
# carries only free-text effect_size_reported, so parse it first (see
# references/effect-parser.md) and pass the parsed CSV here.
#
# Filters applied here, each count printed: metric equals --metric exactly
# (normalise aHR -> HR before calling); finite point, positive for ratio
# metrics; sample_size >=
# --min-n (default 0 = no size filter; inverse-variance weights already
# down-weight small studies, so a size cutoff is a sensitivity analysis only).

for (pkg in c("meta", "ggplot2")) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("pool_effects.R: R package '%s' is not installed; run install.packages('%s') and re-run\n", pkg, pkg),
        file = stderr())
    quit(status = 1)
  }
}
suppressPackageStartupMessages(library(meta))
script_path <- sub("^--file=", "", commandArgs()[grepl("^--file=", commandArgs())][1])
source(file.path(dirname(normalizePath(script_path)), "effect_uncertainty.R"))

parse_args <- function(args) {
  out <- list()
  i <- 1
  while (i <= length(args)) {
    key <- sub("^--", "", args[i])
    if (!key %in% c("in", "metric", "out", "min-n") || i == length(args) || startsWith(args[i + 1], "--")) {
      stop("pool_effects.R: unknown option or missing value: ", args[i], call. = FALSE)
    }
    out[[key]] <- args[i + 1]
    i <- i + 2
  }
  out
}

a <- parse_args(commandArgs(trailingOnly = TRUE))
stopifnot(!is.null(a$`in`), !is.null(a$metric), !is.null(a$out))

dat <- read.csv(a$`in`, stringsAsFactors = FALSE)
compatibility_fields <- c("population", "comparator", "estimand", "outcome", "time_horizon", "adjustment_specification",
                          "adjusted", "analysis_scale", "unit", "study_design")
needed  <- c("pmid", "year", "first_author", "sample_size", "metric", "effect",
             compatibility_fields, "independent_unit_id")
missing <- setdiff(needed, names(dat))
if (length(missing) > 0) {
  cat(sprintf("pool_effects.R: %s is missing column(s): %s\n", a$`in`, paste(missing, collapse = ", ")),
      "Parse the free-text effect_size_reported field into metric, effect, effect_lo, effect_hi ",
      "and supply reviewed compatibility fields (see references/effect-parser.md), then re-run.\n", sep = "", file = stderr())
  quit(status = 1)
}
dir.create(dirname(a$out), recursive = TRUE, showWarnings = FALSE)

# Step 2 filters, each count reported so the summary can state what was dropped.
min_n    <- as.numeric(if (is.null(a$`min-n`)) 0 else a$`min-n`)
n_input  <- nrow(dat)
is_ratio <- a$metric %in% c("HR", "OR", "RR", "aOR", "aHR", "aRR", "IRR", "SMR", "HRR")

dat <- dat[!is.na(dat$metric) & dat$metric == a$metric, , drop = FALSE]
n_metric_drop <- n_input - nrow(dat)

ok_ci <- is.finite(dat$effect)
if (is_ratio) ok_ci <- ok_ci & dat$effect > 0
n_ci_drop <- sum(!ok_ci)
dat <- dat[ok_ci, , drop = FALSE]

# Missing sample_size only matters when the size filter is on.
ok_n <- if (min_n > 0) !is.na(dat$sample_size) & dat$sample_size >= min_n else rep(TRUE, nrow(dat))
n_small_drop <- sum(!ok_n)
dat <- dat[ok_n, , drop = FALSE]

cat(sprintf("Input rows: %d; dropped %d (metric != %s), %d (invalid point), %s; %d studies enter pooling.\n",
            n_input, n_metric_drop, a$metric, n_ci_drop,
            if (min_n > 0) sprintf("%d (sample_size missing or < %g)", n_small_drop, min_n) else "no size filter",
            nrow(dat)))

# Compatibility declarations select one scientific target, not a mixed primary
# pool followed by corrective subgroup fits. Matching labels are assertions;
# the protocol and source review must establish their scientific validity.
if (nrow(dat) > 0) {
  for (field in c(compatibility_fields, "independent_unit_id")) {
    dat[[field]] <- trimws(as.character(dat[[field]]))
    if (anyNA(dat[[field]]) || any(!nzchar(dat[[field]]))) {
      stop("pool_effects.R: compatibility: missing declaration for ", field, call. = FALSE)
    }
  }
  if (anyDuplicated(dat$independent_unit_id)) {
    stop("pool_effects.R: compatibility: duplicate independent_unit_id; resolve overlapping contributions", call. = FALSE)
  }
  dat$adjusted <- tolower(dat$adjusted)
  if (any(!dat$adjusted %in% c("true", "false", "not_applicable"))) {
    stop("pool_effects.R: compatibility: adjusted must be true, false or not_applicable", call. = FALSE)
  }
  for (field in compatibility_fields) {
    # Different designs may be described separately in the non-pooling branch.
    if (field == "study_design" && nrow(dat) < 3) next
    if (length(unique(dat[[field]])) != 1) {
      stop("pool_effects.R: compatibility: mixed ", field, "; select a compatible primary set before pooling", call. = FALSE)
    }
  }
  expected_scale <- if (is_ratio) "ratio" else "identity"
  if (any(dat$analysis_scale != expected_scale)) {
    stop("pool_effects.R: compatibility: analysis_scale must be ", expected_scale,
         " for the reported input metric (ratios are log-transformed internally)", call. = FALSE)
  }
  if (is_ratio && any(dat$unit != "dimensionless")) {
    stop("pool_effects.R: compatibility: ratio metrics require unit=dimensionless", call. = FALSE)
  }
}
if (!grepl("\\.md$", a$out)) stop("pool_effects.R: --out must end in .md", call. = FALSE)
dat <- effect_uncertainty(dat, is_ratio)
contract_path <- sub("\\.md$", "-contract.csv", a$out)
write_contract <- function() {
  uncertainty_fields <- intersect(c("uncertainty_source", "uncertainty_method", "standard_error", "standard_error_scale",
                                    "ci_method", "ci_level", "ci_df", "ci_rounding_tolerance", "se_te"), names(dat))
  write.csv(dat[, c("pmid", "independent_unit_id", compatibility_fields, uncertainty_fields), drop = FALSE],
            contract_path, row.names = FALSE, na = "")
}

if (nrow(dat) < 3) {
  cat(sprintf("Only %d studies with metric=%s and validated uncertainty; pooling not meaningful.\n",
              nrow(dat), a$metric))
  cat("Reporting narrative range instead.\n")
  if (nrow(dat) == 0) {
    out_md <- c(
      sprintf("# Effect-size narrative (k = 0, %s)", a$metric),
      "No study in the input has this metric with a valid point.",
      "Check the metric label (case-sensitive) or widen the search."
    )
  } else {
    pt_min <- min(dat$effect); pt_med <- median(dat$effect); pt_max <- max(dat$effect)
    # Anchor: RCTs first when study_type is present, then largest N, then most recent.
    is_rct <- if ("study_type" %in% names(dat)) grepl("rct|random", tolower(dat$study_type)) & !grepl("non[- ]?random|quasi[- ]?random|not random", tolower(dat$study_type)) else rep(FALSE, nrow(dat))
    best   <- dat[order(-is_rct, -dat$sample_size, -dat$year)[1], ]
    out_md <- c(
      sprintf("# Effect-size narrative (k = %d, %s)", nrow(dat), a$metric),
      sprintf("Range: %.2f to %.2f (median %.2f)", pt_min, pt_max, pt_med),
      sprintf("Anchor study: PMID %s, %s, N=%s, point=%.2f",
              best$pmid, best$year, best$sample_size, best$effect),
      "",
      "Pooling deferred -- fewer than 3 studies. Use the anchor or the range",
      "as the method-power input. Consider widening the search."
    )
  }
  writeLines(out_md, a$out)
  write_contract()
  cat(sprintf("__CE_EFFECT_SIZE__ metric=%s n_studies=%d point=null ci=null pi=NA i2=null mode=narrative contract=%s\n",
              a$metric, nrow(dat), contract_path))
  quit(status = 0)
}

# For ratio metrics: pool on log scale.
ratio_metric <- a$metric %in% c("HR", "OR", "RR", "aOR", "aHR", "aRR", "IRR", "SMR", "HRR")
if (ratio_metric) {
  # meta only back-transforms summary measures it recognises (OR, RR, HR, IRR);
  # adjusted or study-specific labels must map to one, or the forest plot and
  # printed summary stay on the log scale.
  sm <- switch(a$metric,
               aOR = "OR", aRR = "RR", aHR = "HR", HRR = "HR", SMR = "RR",
               a$metric)
} else {
  sm        <- a$metric  # MD or SMD
}

fit_re <- function(ci_method) {
  meta::metagen(
    TE       = dat$te,
    seTE     = dat$se_te,
    studlab  = paste0(dat$first_author, " ", dat$year, " (PMID ", dat$pmid, ")"),
    sm       = sm,
    title    = a$metric,
    common   = FALSE,
    random   = TRUE,
    method.tau       = "REML",
    method.random.ci = ci_method,   # "HK" = Hartung-Knapp-Sidik-Jonkman, t with k-1 df
    prediction       = TRUE,
    method.predict   = "V"          # t with k-1 df (Veroniki 2019; Cochrane Handbook v6.5)
  )
}
# Cochrane Handbook v6.5 section 10.10.4.4: HKSJ when tau^2 > 0 and k > 2; HKSJ
# can be too narrow when tau^2 is estimated as 0, so use the Wald interval then.
m <- fit_re("HK")
ci_label <- "Hartung-Knapp-Sidik-Jonkman (t, k-1 df)"
if (m$tau2 <= 0) {
  m <- fit_re("classic")
  ci_label <- "Wald z (tau^2 estimated as 0)"
}
meta_version <- as.character(utils::packageVersion("meta"))

if (ratio_metric) {
  pooled <- exp(m$TE.random); ci_lo <- exp(m$lower.random); ci_hi <- exp(m$upper.random)
  pi_lo  <- exp(m$lower.predict); pi_hi <- exp(m$upper.predict)
} else {
  pooled <- m$TE.random; ci_lo <- m$lower.random; ci_hi <- m$upper.random
  pi_lo  <- m$lower.predict; pi_hi <- m$upper.predict
}

# meta returns the prediction interval only when k and tau^2 allow one; guard
# length before is.finite() so a NULL or NA bound yields pi=NA, not an error.
pi_ok  <- length(pi_lo) == 1 && length(pi_hi) == 1 &&
          is.finite(pi_lo) && is.finite(pi_hi)
pi_txt <- if (pi_ok) sprintf("%.2f-%.2f", pi_lo, pi_hi) else "not available"
pi_sig <- if (pi_ok) sprintf("%.3f,%.3f", pi_lo, pi_hi) else "NA"
sweep_line <- if (pi_ok) {
  sprintf("Sensitivity-sweep bounds: %.2f to %.2f (95%% prediction interval)", pi_lo, pi_hi)
} else {
  sprintf("Sensitivity-sweep bounds: %.2f to %.2f (95%% CI; prediction interval not available)",
          ci_lo, ci_hi)
}

# Forest plot
fp_path <- sub("\\.md$", "-forest.png", a$out)
png(fp_path, width = 1200, height = 100 + 60 * nrow(dat), res = 150)
meta::forest(m, sortvar = dat$year, prediction = TRUE,
             leftcols = c("studlab"), rightcols = c("effect.ci"))
invisible(dev.off())

# Markdown summary
out_md <- c(
  sprintf("# Pooled effect-size: %s", a$metric),
  "",
  sprintf("Source: %s (k = %d studies after filtering)", a$`in`, nrow(dat)),
  sprintf("Method: random-effects meta-analysis (meta %s): REML tau^2; 95%% CI %s; 95%% PI t with k-1 df",
          meta_version, ci_label),
  if (min_n > 0) sprintf("Size filter: sample_size >= %g (sensitivity analysis; report the unfiltered estimate alongside)", min_n) else "Size filter: none",
  "",
  sprintf("Pooled %s = %.2f (95%% CI %.2f-%.2f; 95%% PI %s)",
          a$metric, pooled, ci_lo, ci_hi, pi_txt),
  sprintf("Heterogeneity: I^2 = %.0f%%, tau^2 = %.3f", m$I2 * 100, m$tau2),
  "",
  sprintf("Selected compatibility contract: %s", contract_path),
  "",
  "## For `method-power`",
  "",
  sprintf("Anchor: %.2f", pooled),
  sweep_line,
  "",
  sprintf("Forest plot: %s", fp_path)
)
writeLines(out_md, a$out)
write_contract()

cat(sprintf("__CE_EFFECT_SIZE__ metric=%s n_studies=%d point=%.3f ci=%.3f,%.3f pi=%s i2=%.0f mode=reml contract=%s\n",
            a$metric, nrow(dat), pooled, ci_lo, ci_hi, pi_sig, m$I2 * 100, contract_path))
