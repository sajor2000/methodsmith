# Stack-Profile-Aware Scaffolding

## Contents

- Stack Profile Resolution
- Tiered Notebook Support
- Golden Path: R + tidyverse + Quarto
- Golden Path: Python + pandas
- Other Combinations
- R Project Bootstrap
- Golden Path: Python + marimo
- SAP Section Headers

This reference defines how `method-work` generates analysis code scaffolding adapted to the user's stack profile. Load it when creating new analysis files during execution.

---

## Stack Profile Resolution

The stack profile is read from `.methodsmith/config.local.yaml` after resolving the repository root. The relevant fields are:

```yaml
language: R | python          # Primary analysis language
ide: rstudio | vscode | other # Development environment
libraries:                     # Key libraries in the stack
  - tidyverse                  # or: pandas, numpy, scipy, etc.
  - broom
notebook_format: qmd | rmd | ipynb | marimo | script  # Preferred output format
```

If the config cannot be read or is missing fields, fall through to defaults:
- **No `language`:** infer from existing files in the project (`.R`/`.qmd` files -> R, `.py` files -> Python). If no signal, default to Python.
- **No `notebook_format`:** infer from `language` (R -> `qmd`, Python -> `script`).
- **No `libraries`:** use the golden path defaults for the detected language.

---

## Tiered Notebook Support

| Tier | Formats | Support Level |
|------|---------|---------------|
| **First-class** | `.qmd`, `.Rmd`, `.R`, `.py`, marimo (`.py` with `import marimo as mo`) | Full scaffolding with correct headers, imports, and output patterns. Text-native formats the agent can read and write without structural risk. Marimo `.py` notebooks are text-native and fully first-class. |
| **Tool-gated** | `.ipynb` | Scaffold a real `.ipynb`: write the cells as a temporary `.py` with `# %%` markers, then convert with `nbformat` or `jupytext`. If no converter is available, report a blocker and create nothing; never deliver a `.py` or `.qmd` substitute for a Jupyter request. |

First-class formats are preferred because the agent can reliably read, write, and diff them. Structured formats (`.ipynb` JSON) carry risk of malformed output when written by hand: generate them through a converter rather than raw JSON, and honor the user's selected format instead of substituting an easier one.

---

## Golden Path: R + tidyverse + Quarto

When `language: R` and `libraries` includes `tidyverse`, scaffold `.qmd` files with this structure:

```qmd
---
title: "[Analysis Title]"
author: "[from git config or config.local.yaml]"
date: today
format:
  html:
    toc: true
    code-fold: true
    embed-resources: true
execute:
  echo: true
  warning: false
---

## Setup

```{r}
#| label: setup
# SAP-N.M: [section reference, if applicable]

library(tidyverse)
library(broom)

# Source shared utilities if they exist
# source("R/utils.R")
```

## Data

```{r}
#| label: load-data

# Load and prepare analysis dataset
# df <- read_csv("data/analysis-dataset.csv")
```

## Analysis

```{r}
#| label: primary-analysis

# Primary analysis
# model <- glm(outcome ~ exposure + covariate1 + covariate2,
#              data = df,
#              family = binomial())
#
# tidy(model, conf.int = TRUE, exponentiate = TRUE)
```

## Results

```{r}
#| label: results-table

# Format results for reporting
# model |>
#   tidy(conf.int = TRUE, exponentiate = TRUE) |>
#   select(term, estimate, conf.low, conf.high, p.value) |>
#   knitr::kable(digits = 3)
```
```

Key patterns for this golden path:
- Use `glm()` for logistic regression, not sklearn
- Use `broom::tidy()` for model output formatting, with `conf.int = TRUE` and `exponentiate = TRUE` for odds ratios
- Use `knitr::kable()` or `gt::gt()` for table output
- Use Quarto chunk options (`#| label:`, `#| echo:`) not knitr-style chunk headers
- Pipe operator: `|>` (base R pipe) unless the project uses `%>%` (magrittr)

---

## Golden Path: Python + pandas

When `language: python` and `libraries` includes `pandas`, scaffold `.py` files with this structure:

```python
# ---
# title: "[Analysis Title]"
# date: "[today's date]"
# SAP-N.M: [section reference, if applicable]
# ---

# %% [markdown]
# ## Setup

# %%
import pandas as pd
import numpy as np
from pathlib import Path

# Optional: statsmodels for regression
# import statsmodels.api as sm
# import statsmodels.formula.api as smf

# %% [markdown]
# ## Data

# %%
# Load and prepare analysis dataset
# df = pd.read_csv("data/analysis-dataset.csv")

# %% [markdown]
# ## Analysis

# %%
# Primary analysis
# model = smf.logit("outcome ~ exposure + covariate1 + covariate2", data=df).fit()
# print(model.summary2())

# %% [markdown]
# ## Results

# %%
# Format results for reporting
# results = pd.DataFrame({
#     "term": model.params.index,
#     "OR": np.exp(model.params),
#     "CI_lower": np.exp(model.conf_int()[0]),
#     "CI_upper": np.exp(model.conf_int()[1]),
#     "p_value": model.pvalues
# })
# print(results.round(3).to_markdown(index=False))
```

Key patterns for this golden path:
- Use `statsmodels` for regression, not sklearn (unless the task is prediction/ML, not inference)
- Use `smf.logit()` or `smf.glm()` for logistic regression with formula interface
- Use `pd.DataFrame` for results formatting
- Use `# %%` cell markers for notebook-like structure in plain `.py` files
- Include `Path` from pathlib for file handling

---

## Other Combinations

For stacks not matching either golden path, adapt the scaffolding pragmatically:

| Stack | Adaptation |
|-------|------------|
| R + base (no tidyverse) | Use `read.csv()`, `summary(glm(...))`, base pipe `|>`. Omit `library(tidyverse)` and `broom` |
| R + data.table | Use `fread()`, `data.table` syntax. Keep `broom::tidy()` for model output |
| Python + polars | Use `polars.read_csv()`, polars expression syntax. Keep `statsmodels` for inference |
| Python + marimo | Scaffold as `.py` with `import marimo as mo` and `mo.md()` for markdown cells |
| Julia | Best-effort: `.jl` files with `using DataFrames, GLM` patterns |
| SAS/Stata | Assessment-only: Load the `method-sas-stata` skill; do not scaffold new SAS/Stata projects until stable local patterns and human equivalence checks exist |

When uncertain about the stack, match the patterns visible in the existing codebase rather than imposing a golden path.

---

## R Project Bootstrap

When `r_project_type` is `script`, `package`, `shiny`, `plumber`, or `targets`, scaffold project infrastructure alongside analysis files. This section is triggered by the stack profile's `r_project_type` field.

### R Analysis Script Project

When `r_project_type: script` (the default), scaffold this directory structure:

```
project-root/
├── .Rprofile             # Project-level R configuration
├── renv.lock             # (if environment_manager.r == renv)
├── renv/
│   └── activate.R        # renv bootstrap
├── R/                    # Reusable functions
│   └── utils.R           # Shared utility functions
├── scripts/              # Analysis scripts
│   └── 01-load-data.R
├── data/
│   ├── raw/.gitkeep
│   └── derived/.gitkeep
├── output/
│   ├── tables/.gitkeep
│   └── figures/.gitkeep
├── .gitignore            # R-specific entries
└── .methodsmith/
    └── config.local.yaml
```

**`.Rprofile` scaffold:**
```r
# Project-level .Rprofile
# Set CRAN snapshot date for reproducible installs
options(
  repos = structure(c(CRAN = "https://packagemanager.posit.co/cran/YYYY-MM-DD")),
  renv.settings.repos.override = "https://packagemanager.posit.co/cran/YYYY-MM-DD"
)

# Use native pipe by default (R >= 4.1)
# Ensure data frame stringsAsFactors = FALSE (R < 4.0 compat)
options(stringsAsFactors = FALSE)
```

Replace `YYYY-MM-DD` with today's date (or the date of the CRAN snapshot the project pins to).

**`.gitignore` R-specific entries:**
```gitignore
# R
.RData
.Rhistory
.Ruserdata
.Renviron
*.Rproj
.Rproj.user/

# renv
renv/library/
renv/staging/
renv/sandbox/
renv/python/
```

### R Package Project

When `r_project_type: package`, scaffold a minimal R package structure:

```
project-root/
├── DESCRIPTION
├── NAMESPACE
├── R/
│   └── utils.R
├── man/
│   └── utils.Rd
├── tests/
│   └── testthat/
│       ├── testthat.R
│       └── test-utils.R
├── vignettes/
│   └── introduction.Rmd
├── .Rprofile
├── renv.lock             # (if environment_manager.r == renv)
├── data/
│   ├── raw/.gitkeep
│   └── derived/.gitkeep
└── .gitignore
```

**`DESCRIPTION` scaffold:**
```
Package: [project-name]
Title: [One-line description]
Version: 0.0.0.9000
Authors@R: person("[First]", "[Last]", email = "[email]", role = c("aut", "cre"))
Description: [Multi-line description of what the package does]
License: MIT + file LICENSE
Encoding: UTF-8
Roxygen: list(markdown = TRUE)
RoxygenNote: 7.3.2
Depends: R (>= 4.1.0)
Imports:
    tidyverse,
    broom
Suggests:
    testthat (>= 3.0.0),
    knitr,
    rmarkdown
Config/testthat/edition: 3
```

### targets Pipeline Project

When `r_project_type: targets`, scaffold a `{targets}` pipeline:

```
project-root/
├── _targets.R            # Pipeline definition
├── _targets.Ruser        # (optional) user-specific settings
├── R/
│   ├── functions.R       # Analysis functions called by targets
│   └── utils.R
├── data/
│   ├── raw/.gitkeep
│   └── derived/.gitkeep
├── output/
│   ├── tables/.gitkeep
│   └── figures/.gitkeep
├── _report/
│   └── report.qmd        # Auto-rendered from pipeline results
├── .Rprofile
├── renv.lock
└── .gitignore
```

**`_targets.R` golden path scaffold:**
```r
# _targets.R -- targets pipeline definition
# SAP Reference: [SAP-N.M or "Exploratory"]

library(targets)
library(tarchetypes)  # tar_quarto()

# Source custom functions
tar_source("R")

# Set pipeline options
tar_option_set(
  packages = c("tidyverse", "broom", "survival"),
  controller = crew::crew_controller_local(workers = 2),
  seed = 42  # Reproducible parallel RNG
)

list(
  # --- Data ---
  tar_target(
    raw_data,
    read_csv("data/raw/study-dataset.csv",
              show_col_types = FALSE)
  ),
  tar_target(
    clean_data,
    clean_raw_data(raw_data)
  ),

  # --- Analysis ---
  tar_target(
    primary_model,
    fit_primary_model(clean_data)
  ),
  tar_target(
    sensitivity_model,
    fit_sensitivity_model(clean_data)
  ),

  # --- Results ---
  tar_target(
    results_table,
    format_results(primary_model, sensitivity_model)
  ),
  tar_target(
    forest_plot,
    plot_forest(primary_model)
  ),

  # --- Report ---
  tar_quarto(report, "_report/report.qmd")
)
```

Key patterns for the targets golden path:
- Always set `seed` in `tar_option_set()` for reproducible parallel execution
- Use `tar_source("R")` to load custom functions from `R/` directory
- Use `tarchetypes::tar_quarto()` for auto-rendered reports
- Use `crew` for parallel workers when computationally expensive
- Keep the `_targets.R` file declarative -- logic goes in `R/functions.R`
- Each target maps to a SAP section where applicable

**`R/functions.R` scaffold:**
```r
# R/functions.R -- analysis functions for targets pipeline

clean_raw_data <- function(raw) {
  raw |>
    filter(!is.na(outcome)) |>
    mutate(
      exposure = factor(exposure, levels = c("control", "treated")),
      age_group = cut(age, breaks = c(0, 40, 60, Inf),
                       labels = c("<40", "40-60", ">60"))
    )
}

fit_primary_model <- function(data) {
  glm(outcome ~ exposure + age + sex,
      data = data,
      family = binomial()) |>
    broom::tidy(conf.int = TRUE, exponentiate = TRUE)
}

fit_sensitivity_model <- function(data) {
  glm(outcome ~ exposure + age + sex + comorbidity_score,
      data = data,
      family = binomial()) |>
    broom::tidy(conf.int = TRUE, exponentiate = TRUE)
}

format_results <- function(primary, sensitivity) {
  bind_rows(
    primary |> mutate(model = "Primary"),
    sensitivity |> mutate(model = "Sensitivity")
  ) |>
    select(model, term, estimate, conf.low, conf.high, p.value)
}

plot_forest <- function(model_results) {
  model_results |>
    filter(term == "exposuretreated") |>
    ggplot(aes(x = estimate, xmin = conf.low, xmax = conf.high, y = model)) +
    geom_point() +
    geom_errorbarh(height = 0.2) +
    geom_vline(xintercept = 1, linetype = "dashed", color = "gray50") +
    labs(
      x = "Odds Ratio (95% CI)",
      y = NULL,
      title = "Forest Plot: Exposure Effect"
    ) +
    theme_minimal()
}
```

---

## Golden Path: Python + marimo

When `language: python` and `notebook_format: marimo`, scaffold `.py` files as marimo reactive notebooks with this structure:

```python
import marimo

__generated_with = "0.13.0"
app = marimo.App(width="medium")


@app.cell
def _(mo):
    # SAP-N.M: [section reference, if applicable]

    mo.md(
        r"""
    # [Analysis Title]

    **Author:** [from git config]
    **Date:** [today's date]
    **SAP Reference:** [SAP-N.M or "Exploratory"]
    """
    )
    return


@app.cell
def _():
    # Reproducibility metadata
    import numpy as np
    import pandas as pd
    from pathlib import Path

    # Pin random seed for reproducibility
    SEED = 42
    np.random.seed(SEED)

    # Log package versions
    # marimo logs versions automatically; supplement if needed:
    # import session_info; session_info.show()
    return SEED, np, pd, Path


@app.cell
def _(mo):
    mo.md(r"""## Data""")
    return


@app.cell
def _(pd, Path):
    # Load and prepare analysis dataset
    # df = pd.read_csv("data/analysis-dataset.csv")
    # df.head()
    return


@app.cell
def _(mo):
    mo.md(r"""## Analysis""")
    return


@app.cell
def _(pd, np):
    # Primary analysis
    # import statsmodels.formula.api as smf
    # model = smf.logit("outcome ~ exposure + covariate1 + covariate2", data=df).fit()
    # print(model.summary2())
    return


@app.cell
def _(mo):
    mo.md(r"""## Results""")
    return


@app.cell
def _(pd, np):
    # Format results for reporting
    # results = pd.DataFrame({
    #     "term": model.params.index,
    #     "OR": np.exp(model.params),
    #     "CI_lower": np.exp(model.conf_int()[0]),
    #     "CI_upper": np.exp(model.conf_int()[1]),
    #     "p_value": model.pvalues
    # })
    # mo.ui.table(results.round(3))
    return


if __name__ == "__main__":
    app.run()
```

Key patterns for the marimo golden path:
- Use `marimo.App()` as the top-level container with `app.cell` decorators
- Use `mo.md()` for narrative markdown cells (study context, interpretation)
- Use `mo.ui.table()` for interactive result display instead of `print()`
- Pin `SEED` at the top for reproducibility (the `method-reproducibility-reviewer` checks for this)
- Use `statsmodels` for inference (same as Python + pandas golden path)
- Each `@app.cell` function lists its reactive dependencies as arguments
- The `if __name__ == "__main__": app.run()` footer enables CLI execution
- SAP section identifiers go in comments within the corresponding cell

---

## SAP Section Headers

When scaffolding analysis files that correspond to a SAP section, include the SAP identifier in a comment near the top of the file:

**R/Quarto:**
```r
# SAP-5.1: Primary Analysis
```

**Python:**
```python
# SAP-5.1: Primary Analysis
```

This enables the SAP tracking overlay (see `references/sap-tracking.md`) to detect coverage via comment scanning.

When scaffolding analysis files that do not correspond to any SAP section, include the exploratory header instead:

**R/Quarto:**
```r
# Exploratory -- not in SAP
# Description: [brief description]
```

**Python:**
```python
# Exploratory -- not in SAP
# Description: [brief description]
```
