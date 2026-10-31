---
id: WO-03-002
type: work-order
slug: remove-decision-artifact-links
title: Remove the per-decision "See: …" artifact link from every case study
status: DRAFT
parent: FRD-03
implementation_status: VERIFIED
reopen_count: 0
blocked_reason:
artifacts:
  - src/content/case-studies/schema.ts
  - src/content/case-studies/pandacorp.ts
  - src/content/case-studies/work-connect.ts
  - src/content/case-studies/job-research.ts
  - src/content/case-studies/alohub.ts
  - src/content/case-studies/webveloper.ts
  - src/content/case-studies/wozzii.ts
  - src/content/_tests/contentParity.test.ts
  - src/app/[locale]/projects/[slug]/_components/CaseStudyBody/**
  - src/app/[locale]/projects/_components/projects.css
  - docs/api/wo-03-001.md
  - docs/frds/frd-03-projects-case-studies/blueprint.md
  - docs/frds/frd-03-projects-case-studies/fdd.md
  - docs/decision-log.md
source_requirements:
  - REQ-03-006
dependsOn:
  - WO-03-001
last_updated: 2026-09-08
---

# WO-03-002 Remove the per-decision "See: …" artifact link from every case study
