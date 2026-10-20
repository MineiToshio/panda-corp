# Provider recipe contract

`catalog.yaml` is the canonical committed, secret-free provider catalog (schema version 1). It uses JSON-compatible YAML so standalone plugin verification needs no installed parser; YAML readers may consume it normally. Maintain it via the same JSON-compatible serialization. Private account and project schemas belong to their respective registry/association readers; do not place personal examples here.

A provider requires unique stable `id` (lowercase letters/digits/underscore), `name`, `type`, `purpose`, `adoption` (`base`, `optional`, `reference`, `project_specific`), credential-free HTTPS `dashboard_url`, `reuse_policy`, `environment_policy`, `quota_notes`, and non-empty dated `sources` (`url`, `checked_at` YYYY-MM-DD). `base` describes a reusable category/default, never automatic installation.

`automation` requires non-empty distinct `methods` (`api`, `cli`, `browser`), `status: documented`, and non-empty operation `steps`. This public catalog records research, not an active-account access or successful-provisioning claim. Operation-specific authenticated/test evidence remains in private/project metadata. Optional `variable_examples` supplies illustrative names, origins, destinations (`web_runtime`, `worker_runtime`, `migration`, `local_cli`), secret classification, purpose and project-contract caveat; it contains no values and never makes every example required. Operator Modal tokens cannot target app runtime. Dated `quota_notes` preserve approved research, not a current quota guarantee. New fields or schema versions must update verifier and all consumers together; unknown fields fail closed. Dashboard URLs are generic, without native personal account/project IDs. Sources are dated research from the approved proposal, not a current entitlement; no live quotas are certified here.

Use `templates/catalog.example.yaml` for a new recipe, read `../standards/external-services.md`, then run:

```sh
node plugin/scripts/validate-service-catalog.mjs
node plugin/scripts/test-service-catalog.mjs
```

The validator checks shape, IDs, routes/dates and common credential/personal-email leakage, not all possible secrets or current provider policy. Gitleaks and review still apply. No resources are provisioned by these commands.
