# BCG vaccine meta-analysis — the methodsmith reproducible demo (#144).
#
# Public data only: metafor::dat.bcg ships 13 randomized BCG trials (TB incidence,
# vaccinated vs. unassigned controls); no PHI, no patient-level data anywhere.
# Deterministic: same script, same package versions, same outputs. Run:
#   Rscript analysis.R
# Writes output/effects.csv, output/summary.md, output/forest.png.

library(metafor)

set.seed(1)

dat <- summary(escalc(
  measure = "RR",
  ai = tpos, bi = tneg, ci = cpos, di = cneg,
  data = dat.bcg,
  slab = paste(author, year)
))

# Prespecified primary model: REML with a Knapp-Hartung adjustment and a prediction interval.
res <- rma(yi, vi, data = dat, method = "REML", test = "knha")
pi  <- predict(res)

# Prespecified subgroup: allocation method (random vs. alternate/central), reported as
# descriptive, not confirmatory (the demo is small; subgroup claims need power).
sub <- rma(yi, vi, data = dat, method = "REML", mods = ~ alloc, test = "knha")

dir.create("output", showWarnings = FALSE)

# Per-trial effect sizes: the numbers behind the forest plot.
effects <- data.frame(
  author   = dat$author,
  year     = dat$year,
  tpos     = dat$tpos, tneg = dat$tneg,
  cpos     = dat$cpos, cneg = dat$cneg,
  rr       = round(as.numeric(dat$yi), 4),
  ci_lower = round(as.numeric(dat$ci.lb), 4),
  ci_upper = round(as.numeric(dat$ci.ub), 4)
)
write.csv(effects, "output/effects.csv", row.names = FALSE)

# Headline numbers, rendered once here and quoted verbatim in summary.md.
stat_line <- sprintf(
  "Pooled log risk ratio %.4f (95%% CI %.4f to %.4f; HK-adjusted %s; prediction interval %.4f to %.4f); I2 = %.1f%%, tau^2 = %.4f, k = %d trials.",
  coef(res), res$ci.lb, res$ci.ub,
  ifelse(res$pval < 0.001, "p < .001", paste0("p = ", format.pval(res$pval, digits = 3))),
  pi$pi.lb, pi$pi.ub, res$I2, res$tau2, res$k
)
sub_line <- sprintf(
  "Allocation-method subgroup (descriptive): test of moderators Q_M = %.2f on %d df, p = %.3f; random-effects slope for random allocation %.4f (95%% CI %.4f to %.4f).",
  sub$QM, sub$QMdf[1], sub$QMp, coef(sub)[2], sub$ci.lb[2], sub$ci.ub[2]
)

summary_lines <- c(
  "BCG vaccine meta-analysis — committed demo outputs",
  "==================================================",
  "",
  paste0("Data: metafor::dat.bcg (13 RCTs; public). Package: metafor ", as.character(packageVersion("metafor")),
         ", R ", paste(R.version$major, R.version$minor, sep = "."), "."),
  "",
  "Primary model: REML, Knapp-Hartung adjustment, prespecified.",
  stat_line,
  sub_line,
  "",
  "Reading notes: the risk ratios below 1 favor BCG vaccination; the 1948-1955 trials",
  "are heterogeneous, which the prediction interval carries honestly. This demo shows",
  "the reporting lane (register, analyze, quote, display), not new science."
)
writeLines(summary_lines, "output/summary.md")

png("output/forest.png", width = 1400, height = 1000, res = 150)
forest(res, xlab = "Risk ratio (log scale)", order = "obs",
       mlab = "REML (Knapp-Hartung)")
dev.off()

cat(summary_lines, sep = "\n")
