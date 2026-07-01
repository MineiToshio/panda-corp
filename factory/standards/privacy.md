# Data and privacy

> Domain: Data/Privacy · Severity: **MUST** when personal data is handled. Enforcement: release checklist + human gate. See DR-025.

## Rule
- **Privacy by design & by default (GDPR Art. 25):**
  - **Minimization**: only the columns necessary for the purpose (decided in the blueprint's data model).
  - **Restricted visibility by default**: access control in the app layer / Postgres row filters on Neon; Better Auth sessions (see `external-services.md`) materialize minimal accessibility.
  - Pseudonymization where viable.
- **Data subject rights** (Chap. III, not Art. 25): the model must allow **export** (access/portability, Arts. 15/20) and **delete** (erasure, Art. 17) of a person's data.
- **Never log PII or secrets.** Retention with a defined period by default.
- **Encryption at-rest and in-transit (Art. 32):** provided by the golden path's managed DB (Neon/Supabase); the real work is in export/delete and minimization.

## How it is verified
- PII gate-checklist in construction's hardening step (`/pandacorp:implement`, DR-085): what PII is collected? Is it the minimum? Is there export/delete? Logs without PII? `/pandacorp:release` only ships a hardened build.
- **Collecting new PII or sharing data with third parties = escalate to the owner** (DR-025, aligns with DR-008).

## Why
Collecting personal data without minimization or data subject rights is a real legal risk. Privacy-by-default makes compliance structural (in the schema), not a later patch.

Sources: gdpr-info.eu/art-25-gdpr · gdprchecklist.io
