# Study Metadata Schema

## Contents

- study_design
- dataset_split
- leakage_assessment
- software_provenance
- llm_provenance
- statistical_rules
- llm_note_grading

Defines the schema for `.methodsmith/study-metadata.yaml` -- a per-project file documenting reproducibility provenance. Reviewers (reporting-checklist-reviewer, reproducibility-reviewer) check this file for completeness relative to the study type and AI involvement level declared in the SAP.

All field groups are optional. Populate only what applies to the study.

---

## study_design

Captures the study classification, AI involvement, and selected reporting guidelines. Mirrors the SAP frontmatter so reviewers can cross-check consistency.

```yaml
study_design:
  classification: <study_type from SAP frontmatter>
  ai_involvement: none | ai-assisted | ai-primary | llm-based
  reporting_checklist: <primary guideline>
  reporting_checklist_extensions: [<extension guidelines>]
  guidelines_selected: [<legacy compatibility only>]
```

**`ai_involvement` values** (canonical; shared with the SAP frontmatter and checklist matching): `none` -- no AI/ML; `ai-assisted` -- AI as a tool within traditional methods (for example data cleaning or a classifier inside the pipeline); `ai-primary` -- AI is the primary analytical approach or the model under evaluation; `llm-based` -- the study uses or evaluates a large language model. Legacy checklist-matching labels map as `data-cleaning only` / `model-as-tool` -> `ai-assisted` and `model-as-study-object` -> `ai-primary` (or `llm-based` when the model is an LLM).

**When to populate:** Every study. This is the anchor for all other metadata sections.

**Reviewer checks:**
- `classification` matches the SAP `study_type`
- `ai_involvement` matches the SAP `ai_involvement`
- `reporting_checklist` and `reporting_checklist_extensions` are consistent with the guideline registry for the declared study type
- legacy `guidelines_selected` is only used when canonical reporting checklist fields are absent

---

## dataset_split

Documents how the dataset was partitioned for model development and evaluation.

```yaml
dataset_split:
  method: random | temporal | stratified | k-fold | leave-one-out | external
  train_ratio: <float>
  validation_ratio: <float>
  test_ratio: <float>
  temporal_cutoff: <YYYY-MM-DD if temporal split>
  stratification_variables: [<list>]
  notes: <free text>
```

**When to populate:** Studies with `ai_involvement` set to `ai-assisted`, `ai-primary`, or `llm-based` that involve model training, fine-tuning, or evaluation on held-out data. Also applicable to `prediction-model` study types regardless of AI involvement.

**Reviewer checks:**
- Ratios sum to 1.0 (within rounding)
- Temporal split method has a `temporal_cutoff` date
- Stratified split lists at least one `stratification_variables` entry
- Method is appropriate for the study design (e.g., temporal for time-series, external for multi-site validation)

---

## leakage_assessment

Documents whether data leakage was assessed and how.

```yaml
leakage_assessment:
  documented: true | false
  method: <description of how leakage was checked>
  known_risks: [<list of identified leakage risks>]
```

**When to populate:** Any study with a `dataset_split` section. Strongly recommended for prediction models and AI-primary studies.

**Reviewer checks:**
- `documented` is `true` for any study that splits data
- `method` is non-empty when `documented` is `true`
- Known risks are acknowledged even if mitigated

---

## software_provenance

Records the computational environment: language version, package versions, random seeds, and environment lockfile.

```yaml
software_provenance:
  language: <e.g., Python 3.11.4 or R 4.3.1>
  package_versions:
    - name: <package>
      version: <version>
  random_seeds: [<list of seeds used>]
  environment_file: <path to renv.lock, requirements.txt, conda.yaml, etc.>
```

**When to populate:** Every study benefits from this. Required for any study with `ai_involvement` other than `none`. The `random_seeds` field is critical for ML/AI studies and any analysis involving resampling, bootstrapping, or stochastic methods.

**Reviewer checks:**
- `environment_file` points to an existing file in the repo
- `random_seeds` is non-empty for studies using stochastic methods
- `language` specifies a concrete version, not just "Python" or "R"
- Key statistical or ML packages are listed in `package_versions`

---

## llm_provenance

Records details of LLM usage for reproducibility and transparency.

```yaml
llm_provenance:
  model: <exact model identifier as reported by the provider at time of use>
  provider: <API provider, e.g., OpenAI, Azure OpenAI, Anthropic>
  temperature: <float>
  prompt_version: <version identifier>
  prompt_file: <path to prompt template>
  date_accessed: <YYYY-MM-DD>
  api_version: <API version if applicable>
```

**When to populate:** Studies with `ai_involvement` set to `llm-based`. Also recommended for `ai-assisted` or `ai-primary` studies that use LLMs in any capacity (e.g., text extraction, classification, annotation).

**Reviewer checks:**
- `model` includes a version or date suffix, not just a base model name
- `temperature` is specified (non-deterministic outputs without it)
- `prompt_file` points to an existing file in the repo
- `date_accessed` is present (LLM behavior can change over time even at the same version)

---

## statistical_rules

Documents the statistical decision rules pre-specified in the SAP.

```yaml
statistical_rules:
  alpha: <significance threshold, e.g., 0.05>
  power: <target power, e.g., 0.80>
  multiplicity_method: bonferroni | holm | hochberg | fdr | fixed-sequence | gatekeeping | graphical | dunnett | alpha-spending | co-primary | none
  one_sided_or_two: one | two
  notes: <free text>
```

**When to populate:** Studies with hypothesis testing (most observational, RCT, diagnostic-accuracy). Less relevant for purely exploratory or qualitative studies.

**Reviewer checks:**
- `alpha` and `power` are consistent with SAP-6 (Sample Size and Power) and SAP-7 (Multiplicity Adjustments)
- `multiplicity_method` matches SAP-7
- If `one_sided_or_two` is `one`, a justification exists in SAP-5 or in `notes`

---

## llm_note_grading

Documents annotation methodology for studies where LLMs grade or annotate clinical notes or other text.

```yaml
llm_note_grading:
  annotation_schema: <path to schema file or description>
  annotator_count: <int>
  inter_rater_reliability:
    metric: kappa | ICC | percent_agreement
    value: <float>
  adjudication_method: consensus | majority | expert
```

**When to populate:** Studies where clinical notes, text, or other unstructured data are annotated -- either by humans for LLM evaluation, or by LLMs as part of the analysis pipeline. Common in `llm-based` and `ai-primary` studies.

**Reviewer checks:**
- `annotator_count` is at least 2 for human annotation
- `inter_rater_reliability.metric` and `value` are present when `annotator_count` >= 2
- `annotation_schema` points to an existing file or provides a concrete description
- `adjudication_method` is specified when disagreements are possible
