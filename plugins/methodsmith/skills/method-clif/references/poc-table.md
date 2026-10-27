# CLIF Point-of-Contact Table

Source: `https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/README.md` (re-checked 2026-10-26; unchanged). Used by the `method-clif` protected-path guardrail to identify whose authorization is required before editing a CLIF table's mCIDE or DDL files.

Contact details are deliberately not cached here. Names and GitHub handles are enough to identify the responsible person; reach them through the CLIF consortium channels listed on https://clif-icu.com/ or the CLIF GitHub organization rather than a stored address.

## How the guardrail uses this table

When an edit is proposed against `mCIDE/<table>/**` or `ddl/<table>.sql`, look up `<table>` in the table below. The proposed prompt must include `POC: @<github_handle> approved` (or `--poc-approved`) to proceed; otherwise the edit is blocked and the diff is staged under `analysis/clif-protected-edits/`.

## Table -> POC mapping

| Table                          | POC                                    | GitHub          |
|--------------------------------|----------------------------------------|-----------------|
| adt                            | Nicholas Ingraham, MD                  | ingra107        |
| code_status                    | Nathan Mesfin, MD                      | mesfi005        |
| crrt_therapy                   | William Parker, MD                     | 08wparker       |
| ecmo_mcs                       | Shan Guleria, MD                       | shanguleria     |
| hospitalization                | Nicholas Ingraham, MD                  | ingra107        |
| input                          | Shan Guleria, MD                       | shanguleria     |
| intermittent_dialysis          | Jay Koyner, MD                         | (n/a)           |
| labs                           | Catherine Gao, MD                      | cloverbunny     |
| medication_admin_continuous    | Chad Hochberg, MD                      | chochbe1        |
| medication_admin_intermittent  | Anna Barker, MD, PhD                   | baanna23        |
| medication_orders              | Anna Barker, MD, PhD                   | baanna23        |
| microbiology_culture           | Kevin Buell, MBBS                      | kevingbuell     |
| microbiology_nonculture        | Kevin Buell, MBBS                      | kevingbuell     |
| microbiology_susceptibility    | Kevin Buell, MBBS                      | kevingbuell     |
| output                         | Shan Guleria, MD                       | shanguleria     |
| patient                        | Pat Lyons, MD                          | plyons          |
| patient_assessments            | Snigdha Jain, MD                       | snigdhajainyale |
| patient_procedures             | J.C. Rojas, MD                         | sajor2000       |
| position                       | Chad Hochberg, MD                      | chochbe1        |
| provider                       | Nicholas Ingraham, MD                  | ingra107        |
| respiratory_support            | Nicholas Ingraham, MD                  | ingra107        |
| therapy_details                | William Parker, MD, PhD; Bhakti Patel  | 08wparker       |
| vitals                         | Catherine Gao, MD                      | cloverbunny     |

`intermittent_dialysis` has no published GitHub handle. Route that request through
the consortium channels on https://clif-icu.com/ and record the authorization in
the prompt as `POC: intermittent_dialysis approved` with a link to the approval.

## Tables without a published POC

The following CLIF tables have no published POC in the public README. Treat them as protected — any edit requires consortium-level approval. Request it through the consortium channels listed on https://clif-icu.com/ or by opening an issue in https://github.com/Common-Longitudinal-ICU-data-Format/CLIF.

- `clinical_notes_facts`
- `clinical_notes_text`
- `clinical_trial`
- `hospital_diagnosis`
- `invasive_hemodynamics`
- `key_icu_orders`
- `patient_diagnosis`
- `place_based_index`
- `transfusion`
- `validated_diagnosis`

## Cross-cutting paths (no single POC)

These paths affect multiple tables and require a consortium-level review:

| Path                  | Approver                                                                |
|-----------------------|-------------------------------------------------------------------------|
| `WORKFLOW.md`         | Consortium leadership (see https://clif-icu.com/)                       |
| `ddl/**` (multi-table)| Consortium leadership                                                   |

The CLIF repository removed `outlier-handling/` and `reference_ranges/`; outlier
thresholds now live in `clifpy`, so changes go through the `clifpy` repository
and the affected table POC.

## CLIF 3.0 table POCs (clif-icu.com)

The GitHub README above still lists 2.1 table names. The data-dictionary page at
https://clif-icu.com/data-dictionary#table-poc (checked 2026-10-26) lists these
POCs for the 3.0 table set. GitHub handles are not published there; resolve them
through the consortium channels before recording an approval.

| 3.0 table | POC (names only) |
|---|---|
| renal_replacement_therapy (was crrt_therapy) | Jay Koyner; Shan Guleria |
| mcs (was ecmo_mcs) | Maxwell Hockstein; Shan Guleria |
| labs | Catherine Gao; William Parker |
| microbiology_culture, microbiology_nonculture, microbiology_susceptibility | Kevin Buell; Aartik Sarma |
| airway, line, drain, patient_attributes | Pat Lyons |
| clinical_notes_facts | Peter Graffy |
| ed_encounter | David Beiser |
| invasive_hemodynamics | Maxwell Hockstein |
| consult_orders, misc_icu_orders | William Parker; Bhakti Patel |
| model_registry, scores | J.C. Rojas |
| place_based_index | Alexander Ortiz |
| radiology | Aartik Sarma |
| transfusion | André Amaral |

Still without a published POC: clinical_trial, hospital_diagnosis,
patient_diagnosis, validated_diagnosis. For a 3.0 project, the clif-icu.com
list wins where it differs from the README.

## Refresh policy

Re-pull this table from the upstream README whenever the consortium publishes a new contributors update. The README's POC table is authoritative; this file is a cache used by the guardrail. Copy names and GitHub handles only — never mirror contact addresses into this cache.
