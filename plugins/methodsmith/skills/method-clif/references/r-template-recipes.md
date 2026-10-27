# CLIF Project-Template Recipes (R)

Canonical R patterns for working with CLIF data, drawn directly from `Common-Longitudinal-ICU-data-Format/CLIF-Project-Template` (`code/templates/R/`, `config/`, `guides/`, `utils/`, `output/`; checked 2026-10-26) and current mixed R/Python CLIF project repos. New CLIF analyses in R should start by cloning this template — never roll your own folder structure. The template enforces the federated-portability rules from `WORKFLOW.md`: site-specific paths only in `config/config.json`, package versions pinned with `renv`, scripts numbered for execution order.

## Table of contents

1. Repository layout (canonical R structure).
2. `renv` bootstrap (`00_renv_restore.R`).
3. `config/config.json` shape (site_name, data_directory, filetype, timezone, output_directory).
4. `utils/config.R` and the project-owned outlier handler pattern.
5. Cohort identification (`01_cohort_identification_template.R`).
6. Quality checks (`02_project_quality_checks_template.R`).
7. Outlier handling (`03_outlier_handling_template.R`).
8. Analysis (`04_project_analysis_template.R`).
9. Reading Parquet via `arrow::open_dataset()`.
10. Federated meta-analysis patterns.
11. Where to read more.

---

## 1. Repository layout

Clone `CLIF-Project-Template` and keep its structure:

```
project-root/
  code/
    templates/R/         # numbered scripts, executed in order
    cohort_id_app/       # optional Shiny app
  config/
    config_template.json # commit this (no PHI)
    config.json          # do NOT commit (gitignored)
  output/
    intermediate_phi/    # gitignored patient-level working data; never shared
    final_no_phi/        # aggregate, shareable outputs only
  utils/
    config.R
    config.py            # Python sibling (kept for federated parity)
    outlier_handler.R    # project-owned; the template does not ship one
  guides/                # creator guide, primer, buddy-testing guide, report template
  renv.lock              # pinned package versions
  renv/
  README.md
```

Three rules from `WORKFLOW.md`:
- Site path lives **only** in `config/config.json`. Never hard-code paths in scripts.
- Patient-level derived files write only to `output/intermediate_phi/` (gitignored); aggregate, shareable results write to `output/final_no_phi/`.
- `renv.lock` is committed; `renv/` library is gitignored.

## 2. `renv` bootstrap

Source: `code/templates/R/00_renv_restore.R`. Always the first script in any session:

```r
# 00_renv_restore.R
if (!requireNamespace("renv", quietly = TRUE)) {
  install.packages("renv", repos = "https://cloud.r-project.org")
}
renv::activate()
renv::restore()
```

For first-time project initialization, the template ships `initialize_renv_template.R`, which seeds `renv.lock` from a base set: `knitr`, `here`, `tidyverse`, `arrow`, and `gtsummary`. Because `utils/config.R` reads JSON config, add `jsonlite` if it is absent from the lockfile. Current mixed CLIF pipelines also commonly use `data.table`, `cmprsk`, `writexl`, and `ggplot2` through either tidyverse or explicit package calls. Run the initializer once when starting a new project, then commit the resulting `renv.lock`.

## 3. `config/config.json` shape

Source: `config/config_template.json`. Commit `config_template.json`, copy it to `config.json`, and add `config/config.json` to `.gitignore`.

```json
{
    "site_name": "Your_Site_Name",
    "data_directory": "./clif_demo",
    "filetype": "parquet",
    "timezone": "US/Eastern",
    "output_directory": "./output"
}
```

Rules:
- `site_name` is used in output filenames (federated runs ship results back as `<site>_<artifact>.parquet`).
- `data_directory` is the path to CLIF Parquet files at this site; the template defaults it to the bundled `clif_demo` so a first run needs no site data.
- `filetype` is `parquet` for production CLIF (CLIF-safe rules forbid `csv`/`fst` for the official tables).
- `timezone` is the site zone. These keys match `clifpy`'s config schema, so the same file works for Python steps (`ClifOrchestrator(config_path="config/config.json")`). Older projects used `tables_path`/`file_type`; migrate them when touching the config.

## 4. `utils/config.R`

Source: `utils/config.R`. Single helper that every script `source()`s before reading data:

```r
# utils/config.R
library(jsonlite)

load_config <- function() {
  json_path <- "config/config.json"
  if (file.exists(json_path)) {
    config <- fromJSON(json_path)
    message("Loaded configuration from config.json")
  } else {
    stop("Configuration file not found. Please create config.json based on the config_template.")
  }
  return(config)
}

config <- load_config()
```

Then in any analysis script:

```r
source("utils/config.R")
site_name <- config$site_name
data_directory <- config$data_directory
```

The template's `03_outlier_handling_template.R` is a skeleton. Projects supply their own `utils/outlier_handler.R` exposing `apply_outlier_thresholds(df, table_name)`, with ranges taken from `clifpy`'s consortium `outlier_config.yaml` (cite the `clifpy` version), and set out-of-range values to `NA` (never silently clipped). Do not fork thresholds without recording why.

## 5. Cohort identification

Source: `code/templates/R/01_cohort_identification_template.R`. Pattern: declare which CLIF tables this project needs as boolean flags, load them, derive a `hospitalization_id` cohort, and write filtered patient-level tables only to `output/intermediate_phi/`.

```r
library(knitr)
library(here)
library(tidyverse)
library(arrow)
library(gtsummary)

source("utils/config.R")

# Cohort parameters (move to config if site-specific)
start_date <- "2020-01-01"
end_date   <- "2021-12-31"
include_pediatric <- FALSE
include_er_deaths <- TRUE

# Declare required tables (TRUE = needed for this project)
tables <- c("patient", "hospitalization", "vitals", "labs",
            "medication_admin_continuous", "adt", "patient_assessments",
            "respiratory_support", "position", "dialysis", "intake_output",
            "procedures", "admission_diagnosis",
            "microbiology_culture",
            "medication_admin_intermittent")
true_tables <- c("patient", "hospitalization", "adt", "vitals", "labs",
                 "medication_admin_continuous", "respiratory_support",
                 "microbiology_culture")
table_flags <- setNames(tables %in% true_tables, tables)

# Load each TRUE-flagged table from data_directory
load_clif_table <- function(name) {
  arrow::open_dataset(file.path(config$data_directory, paste0("clif_", name, ".parquet")))
}

clif <- lapply(tables[table_flags], load_clif_table)
names(clif) <- tables[table_flags]
```

## 5b. Arrow schema normalization (CRITICAL for multi-site)

Arrow's `large_utf8` type varies across site ETL implementations. Joins between `large_utf8` and `utf8` columns fail silently or produce empty results. Always cast immediately after `open_dataset()`:

```r
cast_large_utf8_to_utf8 <- function(dataset) {
  schema <- dataset$schema
  new_fields <- lapply(schema$fields, function(f) {
    if (inherits(f$type, "LargeUtf8") || f$type$ToString() == "large_string") {
      arrow::field(f$name, arrow::utf8())
    } else {
      f
    }
  })
  dataset$cast(do.call(arrow::schema, new_fields))
}

# Apply to EVERY open_dataset() call before filtering or joining:
table_data <- open_dataset(file.path(config$data_directory, "clif_table_name")) |>
  cast_large_utf8_to_utf8() |>
  left_join(cohort_ids, by = "hospitalization_id") |>
  filter(in_cohort == 1) |>
  collect()
```

## 5c. Encounter block grouping (cross-hospital transfers)

When patients transfer between hospitals within a system, separate `hospitalization_id` values represent what is clinically one ICU stay. Group linked admissions by time gap:

```r
create_encounter_blocks <- function(hospitalizations, gap_hours = 6) {
  hospitalizations |>
    arrange(patient_id, admission_dttm) |>
    group_by(patient_id) |>
    mutate(
      prev_discharge = lag(discharge_dttm),
      gap = as.numeric(difftime(admission_dttm, prev_discharge, units = "hours")),
      new_block = is.na(gap) | gap > !!gap_hours,
      encounter_block = cumsum(new_block)
    ) |>
    ungroup()
}
```

## 5d. Namespace collision guard

Arrow and dplyr both export `filter` and `select`. Declare explicitly at the top of every script:

```r
select <- dplyr::select
filter <- dplyr::filter
```

## 5e. Conditional assignment

Base R `ifelse()` drops attributes and mishandles NA. Use `data.table::fifelse()` or `dplyr::if_else()`:

```r
data <- data |>
  mutate(flag = fifelse(value < threshold, TRUE, FALSE, na = NA))
```

## 6. Quality checks

Source: `code/templates/R/02_project_quality_checks_template.R`. Mirrors clifpy's DQA: schema, missingness, mCIDE category violations, range violations, datetime timezone, ID typing.

```r
source("utils/config.R")
library(arrow); library(dplyr); library(janitor)

vitals <- arrow::open_dataset(file.path(config$data_directory, "clif_vitals.parquet")) |>
  collect()

# 1. mCIDE check: vital_category must be in the allow list
allowed <- c("temp_c", "heart_rate", "sbp", "dbp", "spo2",
             "respiratory_rate", "map", "height_cm", "weight_kg")
mcide_violations <- vitals |>
  filter(!vital_category %in% allowed) |>
  count(vital_category, sort = TRUE)

# 2. Datetime timezone: every datetime must be UTC tz-aware
stopifnot(attr(vitals$recorded_dttm, "tzone") == "UTC")

# 3. Range check with the project's outlier handler (clifpy outlier_config.yaml ranges)
source("utils/outlier_handler.R")
vitals_clean <- apply_outlier_thresholds(vitals, "vitals")
```

Write a disclosure-reviewed QC summary to `output/final_no_phi/qc/`; retain any patient-level QC artifacts only under `output/intermediate_phi/`.

## 7. Outlier handling

Outlier thresholds come from `clifpy`'s `outlier_config.yaml`: Python calls `apply_outlier_handling`, and R projects apply the same ranges through a project-owned `utils/outlier_handler.R`. Do not hardcode thresholds in analysis scripts — call the shared handler:

```r
source("utils/outlier_handler.R")
vitals_clean <- apply_outlier_thresholds(vitals, "vitals")
labs_clean   <- apply_outlier_thresholds(labs,   "labs")
```

## 7b. Wide dataset construction

The wide dataset merges all narrow CLIF tables into one row per (hospitalization_id, timestamp). The time grid is every unique timestamp across all joined tables — not a fixed interval.

```r
# Pattern: build the time grid, then left-join each table
time_grid <- bind_rows(
  vitals |> select(hospitalization_id, event_dttm = recorded_dttm),
  labs |> select(hospitalization_id, event_dttm = lab_result_dttm),
  respiratory |> select(hospitalization_id, event_dttm = recorded_dttm)
) |> distinct()

wide <- time_grid |>
  left_join(vitals_wide, by = c("hospitalization_id", "event_dttm")) |>
  left_join(labs_wide, by = c("hospitalization_id", "event_dttm")) |>
  left_join(respiratory_wide, by = c("hospitalization_id", "event_dttm")) |>
  group_by(hospitalization_id) |>
  arrange(event_dttm) |>
  fill(everything(), .direction = "down") |>
  ungroup()
```

Forward-fill within hospitalization handles gaps in categorical variables. Always `group_by(hospitalization_id)` before `fill()`.

## 7c. Time-varying exposure windows

For MSM or decision-point analyses, define explicit time windows rather than using continuous time:

```r
# Define decision points (e.g., every 12 hours from ICU admission)
decision_points <- cohort |>
  mutate(
    t0 = icu_admission_dttm,
    t1 = t0 + hours(12),
    t2 = t0 + hours(24)
  )

# Measure covariates at each decision point using the wide dataset
covariates_at_t <- wide |>
  inner_join(decision_points, by = "hospitalization_id") |>
  filter(event_dttm <= t1, event_dttm > t0) |>
  group_by(hospitalization_id) |>
  summarise(across(where(is.numeric), ~ last(na.omit(.x))))
```

## 7d. CONSORT flow tracking

Track exclusion counts as a running list — update at every filtering step:

```r
flow <- list()
flow$eligible <- nrow(hospitalizations)

cohort <- hospitalizations |> filter(age >= 18)
flow$adult <- nrow(cohort)

cohort <- cohort |> filter(icu_los_hours >= 24)
flow$icu_24h <- nrow(cohort)

# Save as CSV alongside the analysis; suppress any step count of 10 or fewer (CLIF floor: n >= 11) before sharing
flow_df <- tibble(step = names(flow), n = unlist(flow))
write_csv(flow_df, file.path("output", "final_no_phi", "cohort_flow.csv"))
```

## 8. Analysis

Source: `code/templates/R/04_project_analysis_template.R`. Reads filtered, cleaned working tables from `output/intermediate_phi/`, computes the analytic frame, and writes aggregate site results to `output/final_no_phi/`.

```r
source("utils/config.R")
library(arrow); library(dplyr); library(gtsummary)

cohort <- arrow::read_parquet("output/intermediate_phi/cohort_hospitalizations.parquet")

# Example: SOFA-like derived features. For full SOFA, prefer clifpy's
# compute_sofa_scores via reticulate; the R template keeps a simplified
# subset for sites that are R-only.

results <- cohort |>
  mutate(los_days = as.numeric(difftime(discharge_dttm, admission_dttm, units = "days"))) |>
  group_by(site = config$site_name) |>
  summarise(
    n        = n(),
    los_med  = median(los_days, na.rm = TRUE),
    mort_30d = mean(died_within_30d, na.rm = TRUE),
  )

arrow::write_parquet(results, file.path("output/final_no_phi", paste0(config$site_name, "_results.parquet")))
```

## 9. Reading Parquet via `arrow::open_dataset()`

Always prefer `arrow::open_dataset()` over `arrow::read_parquet()` for CLIF tables — it lazily plans the read and pushes filters down to the file, which matters for `vitals` and `labs` (often >50M rows).

```r
library(arrow); library(dplyr)
ds <- arrow::open_dataset(file.path(config$data_directory, "clif_vitals.parquet"))

vitals_2021 <- ds |>
  filter(recorded_dttm >= as.POSIXct("2021-01-01", tz = "UTC"),
         recorded_dttm <  as.POSIXct("2022-01-01", tz = "UTC"),
         vital_category %in% c("heart_rate", "map")) |>
  collect()
```

## 9b. Propensity score and causal inference patterns

Statistical recipes are starting points: route the design to `method-model-choice`, and confirm the installed WeightIt/cobalt/survival API before use (checked against WeightIt 1.x, which renamed `method = "ps"` to `"glm"`).

CLIF studies commonly use IPTW for observational causal inference. Check balance and overlap before fitting the outcome model:

```r
library(WeightIt)
library(cobalt)
library(survival)

# IPTW — exclude SOFA if its components are already covariates
w <- weightit(
  treatment ~ age + sex + bmi + charlson + apache,
  data = cohort,
  method = "glm",
  estimand = "ATE",
  stabilize = TRUE           # stabilized weights; WeightIt's default is unstabilized
)
summary(w)                   # weight range and effective sample size
bal.tab(w, stats = c("m", "v"), thresholds = c(m = 0.1))  # SMD after weighting (0.1 is a convention)

# Weighted outcome model; M-estimation SEs account for estimating the propensity score
fit <- glm_weightit(outcome ~ treatment, data = cohort, weightit = w, family = binomial())
```

For competing risks (common in ICU — death competes with discharge). `cmprsk::crr()` has no weights argument, so it cannot fit an IPTW-weighted Fine-Gray model; use `survival::finegray()` with weighted `coxph()`:

```r
cohort$ipw <- w$weights
cohort$id  <- seq_len(nrow(cohort))
# event_type: 0 = censored, 1 = event of interest, 2 = competing event
fg_data <- finegray(Surv(time_to_event, factor(event_type, 0:2)) ~ ., data = cohort, etype = "1")
fg <- coxph(Surv(fgstart, fgstop, fgstatus) ~ treatment, data = fg_data,
            weights = fgwt * ipw, cluster = id)
# The robust SE treats the weights as fixed; bootstrap the whole weighting + model for final inference.
```

Variables with fewer than 2 unique values at a site should be excluded from propensity models dynamically:

```r
# Drop zero-variance covariates before fitting
keep <- sapply(covariate_df, function(x) length(unique(na.omit(x))) >= 2)
covariate_df <- covariate_df[, keep]
```

## 10. Federated meta-analysis patterns

CLIF studies use a local-then-summary architecture: local scripts run at each site on patient-level data and emit aggregate CSVs; summary scripts run centrally on the pooled aggregates.

### 10a. Validate site results before synthesis

Use `method-clif-meta-analysis` for a complete aggregate contract and executable R
and Python templates. Keep every site's received/failed/suppressed/excluded
status. Verify compatible outcome, contrast, adjustment set, analysis scale,
time horizon, code version and independent sampling units before a fit.
Do not concatenate arbitrary files and pool every row as independent.

Load `method-clif-meta-analysis` and use its validator with `--validate-only`,
`--validated-tsv validated-effects.tsv` and
`--validated-manifest validated-manifest.json` on the reviewed aggregate input.
Use new output paths and retain the manifest with its source hash, release
references and dispositions.

Stop if validation fails. Sections 10b and 10c assume the reviewed contract's
effects and SEs are already on the natural-log odds-ratio scale; the OR labels
and exponential back-transformation are inappropriate for other measures.
The TSV contains only usable units; retain the manifest's nonusable-unit
accounting rather than interpreting their absence as zero effects.

### 10b. Explicit random-effects inference

Federated analyses usually pool fewer than 15 sites, where Wald-type random-effects CIs under-cover; use REML for tau^2 with Knapp-Hartung (HKSJ) intervals (IntHout et al., BMC Med Res Methodol 2014, PMID 24548571), and report the prediction interval.

```r
library(metafor)
library(meta)

# Read only the successfully validated TSV from 10a, not arbitrary site files.
validated <- read.delim("validated-effects.tsv", stringsAsFactors = FALSE)
pooled <- data.frame(
  site = validated$analysis_unit_id,
  log_estimate = validated$effect,
  se_estimate = validated$standard_error
)

# Pool site-level estimates — REML tau^2 with Knapp-Hartung (HKSJ) CIs
fit <- rma(yi = log_estimate, sei = se_estimate, method = "REML", test = "knha", data = pooled)
predict(fit, transf = exp)   # pooled OR with CI and 95% prediction interval

# Forest plot with matching settings (same pooled estimate and CI as `fit`)
forest_obj <- metagen(
  TE = log_estimate, seTE = se_estimate,
  studlab = site, data = pooled,
  sm = "OR", backtransf = TRUE,
  common = FALSE, random = TRUE,
  method.tau = "REML", method.random.ci = "HK", prediction = TRUE
)
forest(forest_obj)
```

### 10c. Bayesian meta-analysis of the same estimand

A Bayesian robustness check must pool the same site-level log effects as 10b, not event proportions:

```r
library(brms)

fit_bayes <- brm(
  log_estimate | se(se_estimate) ~ 1 + (1 | site),
  data = pooled,
  prior = c(prior(normal(0, 1), class = Intercept),
            prior(normal(0, 0.5), class = sd)),
  chains = 4, iter = 4000, warmup = 2000
)
```

Report sensitivity of the pooled effect and tau to the `sd` prior; with few sites the heterogeneity prior dominates.

### 10d. Figure conventions

```r
library(ggplot2)

# Consortium figure style: classic theme, legend below, PDF output
theme_clif <- theme_classic(base_size = 12, base_family = "Arial") +
  theme(legend.position = "bottom", strip.background = element_blank())

ggsave(file.path("output", "final_no_phi", "graphs", "figure_name.pdf"), width = 10, height = 6)
```

### 10e. Config with timezone

Some projects use `config.yaml` instead of `config.json`. Either works — the pattern is the same:

```r
library(yaml); library(lubridate)
config <- yaml::read_yaml("config/config.yaml")

# Convert site-local timestamps to UTC at load time
data <- data |>
  mutate(recorded_dttm = with_tz(
    as.POSIXct(recorded_dttm, tz = config$timezone), tzone = "UTC"
  ))
```

## 11. Where to read more

- CLIF-Project-Template (R): https://github.com/Common-Longitudinal-ICU-data-Format/CLIF-Project-Template
- R templates directory: https://github.com/Common-Longitudinal-ICU-data-Format/CLIF-Project-Template/tree/main/code/templates/R
- CLIF data dictionary v2.1.0: https://clif-icu.com/data-dictionary/data-dictionary-2.1.0
- clifpy (Python client, also callable from R via `reticulate`): https://github.com/Common-Longitudinal-ICU-data-Format/clifpy
- CLIF consortium repos: https://github.com/orgs/Common-Longitudinal-ICU-data-Format/repositories
