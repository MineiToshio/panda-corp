---
id: FRD-26
type: frd
title: Services and account directory
status: ACTIVE
ui: true
---
# FRD-26 — Services and account directory

Owner approved the complete services reuse HTML proposal on 2026-10-20. This read-only local feature implements its registry, architecture, new-provider and Manual contracts; it never provisions resources or changes external accounts. GitHub remains a factory-wide standard outside this catalog.

## Acceptance criteria (EARS)

- **AC-26-001** WHEN Portfolio opens, THEN it SHALL expose Projects and Accounts views independently of project selection, including an empty portfolio.
- **AC-26-002** WHEN views change or history is restored, THEN the selected project and unrelated URL state SHALL survive; Accounts SHALL use `portfolioView=accounts`, never an ambiguous project slug.
- **AC-26-003** WHEN accounts render, THEN each account SHALL show provider, type, purpose, organization, email or explicit unknown, dated identity/access status and a validated HTTPS dashboard link opening a new tab.
- **AC-26-004** WHEN an account expands, THEN it SHALL show derived consumers, environment resources, dated plan/quota observations, automation evidence level, pending step and the public provider recipe.
- **AC-26-005** WHEN the user searches or filters, THEN the directory SHALL search service/email/project and support active, pending, candidate and reference states; multiple identities of one provider SHALL remain separate.
- **AC-26-006** WHEN the project Accounts tab opens, THEN it SHALL show only that project's declared integration/account links and resources; it SHALL NOT infer account ownership from SDKs, variable names or an active browser session.
- **AC-26-007** WHEN a source is missing, malformed, duplicated or contains a dangling reference or production-as-dev resource, THEN the reader SHALL show an explicit bounded issue rather than silent empty success.
- **AC-26-008** WHEN private files contain unknown fields or credential references, THEN only the reader's whitelisted non-secret DTO SHALL reach the browser; no raw YAML, exception text, passwords, tokens or credential references SHALL be rendered or logged.
- **AC-26-009** WHEN the Manual opens Services, THEN it SHALL derive recipes and sources from the public canonical catalog, link the private directory, and SHALL NOT read or publish account identities.
- **AC-26-010** WHEN the page renders or filters, THEN it SHALL make no cloud API calls, write no registries, and remain usable by keyboard and on phones with the existing shell tokens and tab primitive.

## Sources and ownership

Public catalog: `factory/services/catalog.yaml`. Private identities and optional trusted project pointers: vault `services/accounts.yaml`. Per-project atomic links: `.pandacorp/accounts/services.yaml`. Consumer lists are derived at read time; there is no second maintained list. Observations are historical facts with dates, not fresh verification or proof of current production configuration. See [blueprint](blueprint.md), [delivery scope](work-orders.md), and [ADR](../../adr/ADR-0011-services-account-directory.md).
