# TIDieR Checklist for Describing Interventions

## Contents

- Item 1 -- Brief name
- Item 2 -- Why
- Item 3 -- What (materials)
- Item 4 -- What (procedures)
- Item 5 -- Who provided
- Item 6 -- How
- Item 7 -- Where
- Item 8 -- When and how much
- Item 9 -- Tailoring
- Item 10 -- Modifications
- Item 11 -- How well (planned)
- Item 12 -- How well (actual)

Template for Intervention Description and Replication (TIDieR).
12-item checklist for describing an evaluated intervention in enough detail that others can replicate and implement it. TIDieR extends the intervention-description items of the trial guidelines (item 5 of CONSORT 2010, which CONSORT 2025 supersedes, and item 11 of SPIRIT 2013, which SPIRIT 2025 supersedes); it applies across evaluative study designs, not only trials. Apply TIDieR alongside the current core guideline, never instead of it.

**Primary reference:** Hoffmann TC, Glasziou PP, Boutron I, et al. Better reporting of interventions: template for intervention description and replication (TIDieR) checklist and guide. BMJ. 2014;348:g1687. doi:10.1136/bmj.g1687. PMID: 24609605.

**Source and licence:** Item numbers, official item names, and order were verified on 2026-10-19 against the TIDieR paper (BMJ 2014;348:g1687), including the 12-item enumeration in the paper's abstract and its Table 1 item list as reproduced in Leite et al., TIDieR.2 (Braz J Phys Ther. 2023;27:100483, doi:10.1016/j.bjpt.2023.100483). The BMJ article carries no open licence (checked 2026-10-19 via the BMJ site and Crossref; no Creative Commons licence is recorded), so the item descriptions below are faithful paraphrases that keep every element of the official item. Use the BMJ paper or the EQUATOR-hosted TIDieR checklist (https://www.equator-network.org/reporting-guidelines/tidier/) for verbatim wording. The "What to look for" bullets are methodsmith review guidance, not TIDieR content.

Each item includes the item number, official name, description, and what to look for in analysis code and outputs when evaluating compliance.

---

## Item 1 -- Brief name

**Description:** Give the name or a short phrase that identifies the intervention.

**What to look for in code/outputs:**
- Intervention name or label stated in the protocol, SAP, or analysis config
- Analysis outputs or report header naming the intervention consistently

## Item 2 -- Why

**Description:** State the rationale, theory, or goals behind the elements that are essential to the intervention.

**What to look for in code/outputs:**
- Background or protocol text explaining why each essential element is included
- Design document linking intervention elements to theory or stated goals

## Item 3 -- What (materials)

**Description:** Describe every physical or informational material used in the intervention -- those given to participants, those used in delivery, and those used to train providers -- and say where each can be obtained (for example, an online appendix or URL).

**What to look for in code/outputs:**
- Appendix, repository link, or data dictionary for intervention materials
- Materials referenced with an access point (supplement, URL, archive) rather than only named

## Item 4 -- What (procedures)

**Description:** Describe every procedure, activity, or process carried out as part of the intervention, together with any enabling or support activities.

**What to look for in code/outputs:**
- Step-by-step procedure description in the protocol or methods section
- Pipeline scripts or workflow files matching the described procedures

## Item 5 -- Who provided

**Description:** For each category of intervention provider (for example, psychologist or nursing assistant), give their expertise, background, and any specific training they received.

**What to look for in code/outputs:**
- Provider roles and credentials documented in the protocol or methods
- Training materials or curricula referenced for providers

## Item 6 -- How

**Description:** Describe how the intervention was delivered (face-to-face, or by another channel such as the internet or telephone) and whether it was given individually or in a group.

**What to look for in code/outputs:**
- Delivery mode and individual/group setting stated in methods or config
- Group size reported where delivery was in groups

## Item 7 -- Where

**Description:** Describe the kind(s) of site(s) where the intervention took place, including any infrastructure needed or other relevant features.

**What to look for in code/outputs:**
- Setting (clinic, hospital, community, remote) documented in methods
- Infrastructure relevant to delivery or feasibility noted

## Item 8 -- When and how much

**Description:** Describe how often the intervention was delivered and over what period, covering the number of sessions, their schedule, and their duration, intensity, or dose.

**What to look for in code/outputs:**
- Session count, schedule, duration, and dose stated in the protocol or methods
- Timing variables in the analysis dataset consistent with the described schedule

## Item 9 -- Tailoring

**Description:** When the intervention was designed to be personalised, titrated, or adapted, describe what changed, why, when, and how.

**What to look for in code/outputs:**
- Tailoring rules, decision points, or titration criteria documented
- Participant-level adaptation logic visible in scripts or config

## Item 10 -- Modifications

**Description:** When the intervention was changed during the study, describe the modification: what, why, when, and how.

**What to look for in code/outputs:**
- Protocol amendments or change log recording intervention modifications
- Analysis handling of pre/post-modification periods documented

## Item 11 -- How well (planned)

**Description:** When adherence or fidelity was assessed, describe the method and who assessed it, and describe any strategies used to keep or improve fidelity.

**What to look for in code/outputs:**
- Fidelity or adherence monitoring plan with assessor role named
- Fidelity-check scripts or logs and any enhancement strategies documented

## Item 12 -- How well (actual)

**Description:** When adherence or fidelity was measured, report how far the delivered intervention matched the plan.

**What to look for in code/outputs:**
- Measured fidelity or adherence results reported (percent of sessions delivered, dose received)
- Deviation summary quantifying delivered versus planned intervention
