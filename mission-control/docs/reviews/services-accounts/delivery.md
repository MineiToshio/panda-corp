# Services/account directory delivery

Owner-approved 2026-10-20. Implemented FRD-26 through native attended execution with no external account provisioning, billing change, credential generation or cloud API calls.

## Evidence

- Canonical `.pandacorp/verify.sh --since b35fa128 --report-all`: green, non-partial `scope: since`, recorded at code SHA `df08aadd028c00242d542a88b5275d51375487cd`; see [machine report](gate-report.json). All cheap gates, related unit tests and 42 desktop/mobile smoke/shell browser checks passed.
- Independent reviewer re-ran 44 targeted tests and TypeScript checking at that code snapshot, and verified 24 providers / 15 private identities / 49 allocations with no reader issues against the actual locally seeded metadata. This is registry consistency, not fresh provider access or proof of integration.
- Rebased onto the committed service governance catalog with no Mission Control code differences. A final semantic-only adjustment adds the directory's H2 and uses H3 detail headings rather than skipping heading levels. After integration and that adjustment: TypeScript, whole-project Biome, and 110 affected reader/UI/navigation/workspace/Manual tests pass.
- The directory uses the shared request-scoped reader, explicit integration IDs for repeated providers, safe HTTPS dashboards, dated unknown/error states, secret-reference exclusion, separate public Manual projection and no runtime writes. The database model remains `persistence: none` because this feature adds file interchange, not a database.

## Review boundary

The automated browser gate used the standard frozen fixture on port 3900; it did not inspect personal account data. A fresh visual inspection of the combined real-data directory is still pending because the browser host was unavailable and the native Mac was locked. No visual-verification claim is made. Production cloud resources, fees, delivery and external credential validity are outside this read-only feature.

## Locations

Global: `/portfolio?portfolioView=accounts`; project: `/portfolio/:project/accounts` or `/projects/:project/accounts`; Manual: `/manual/guides/services`, provider recipe `/manual/guides/service-:provider`, operating guide `/manual/guides/services-operating-model`.
