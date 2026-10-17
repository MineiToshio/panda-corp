---
domain: Operation
severity: MUST
enforcement: lifecycle CLI and identity tests
summary:
  - Allocate immutable idea and project identities through one factory writer.
  - Keep the private catalog and in-factory Mission Control reference in the vault.
  - Preserve public slugs and aliases across rename and relocation.
---

# Persistent navigation identity producer contract

The factory owns identity registration; Mission Control reads it and never allocates identity on a request. This metadata is independent of build state and lifecycle phase.

## Canonical schema and ownership

One owner-private file, `<factory-root>/factory/navigation-identities.json`, contains `schemaVersion: 1` and `resources: []`. Each resource has:

| Field | Meaning |
|---|---|
| `kind` | `idea` or `project`; distinct URL namespaces |
| `id` | Immutable `<kind>_<UUID>`; allocated only once |
| `slug` | Readable lowercase public token, assigned once |
| `aliases` | Permanently reserved former public slugs/known legacy slug spellings |
| `legacyNames` | Observed display names/card filenames for legacy name-query compatibility; ambiguous matches fail closed |
| `locator` | Current path relative to the factory root; trusted registration metadata, never a URL filesystem argument |
| `projectId` | Optional explicit idea → project bridge; each project retains its own separate ID |

Cards reference their idea entry with frontmatter `navigation_id`. Projects reference their project entry in `.pandacorp/navigation-identity.json`: `{ "schemaVersion": 1, "projectId": "project_<UUID>" }`. Preserve both references when moving/renaming a card/project, when copying an origin card, and during overlay upgrades. A newly cloned *different* project must not copy another project's identity metadata. **Mission Control is the framework exception:** because it lives inside the shared factory repository, its exact `mission-control/.pandacorp/navigation-identity.json` path is owner-private and ignored in both factory and Mission Control git rules. Its reference travels with the private catalog through the vault overlay/backups, never in framework history. A fresh factory clone without either private artifact allocates its own identity at registration. Sibling product metadata may be committed to that product's own repository; this factory change does not commit or rewrite any sibling repository.

## Single writer and producer invocations

`plugin/scripts/navigation-identities.sh` invokes `mission-control/scripts/navigation/identities.mjs` and `registry.ts`. It uses the real `readIdeas` and `readPortfolio` readers, relative to the explicit factory root. Node with native TypeScript stripping and installed Mission Control dependencies is required; a Mission Control build is not required.

```bash
bash "<factory>/plugin/scripts/navigation-identities.sh" --factory-root "<factory>" --dry-run
bash "<factory>/plugin/scripts/navigation-identities.sh" --factory-root "<factory>" --apply
```

`new-idea` runs this after creating/updating a card. `scaffold`/`spec` and `adopt` run it after writing both the card's project pointer and portfolio row, before the initial product commit. `sync-portfolio` reconciles registrations after its pointer updates, including moves and new rows. These producers must preserve IDs rather than edit the catalog themselves. An unavailable project, duplicate reference, invalid catalog or unresolved bridge causes an explicit nonzero failure; report it, recover its source, and rerun.

The writer never merges by display name. Same-name projects get separate IDs and deterministic suffixed public slugs; raw legacy names may remain ambiguous. Immutable IDs and reserved public slugs/aliases take precedence over raw legacy-name lookup. A legacy name is accepted only when unique. The idea's existing `project:` pointer supplies the bridge to a verified portfolio locator. Multiple ideas can explicitly reference one project; they remain distinct ideas.

Apply holds an exclusive `.lock` file, validates the full planned catalog, and atomically replaces each file via same-directory temporary files and `fsync`. The catalog publishes first; reference writes follow. An interrupted multi-file apply is recoverable by rerunning: catalog locators identify references not yet written. This is per-file atomicity, not a multi-file transaction. Never start a second writer while the first lock exists; after a crash inspect the process before removing that individual stale lock file. Dry-run performs no writes. No source data or old identity is deleted; old entries and aliases remain reserved.

## Renames, moves and recovery

Ordinary title/display-name changes retain `id` and `slug`. Filename/folder moves preserve their ID references, then update the card/portfolio pointer and rerun reconciliation. Unknown new filesystem locations cannot be discovered from an ID alone. An intentional public URL rename is explicit:

```bash
bash "<factory>/plugin/scripts/navigation-identities.sh" --factory-root "<factory>" --dry-run --rename-kind project --rename-id project_UUID --slug new-url
bash "<factory>/plugin/scripts/navigation-identities.sh" --factory-root "<factory>" --apply --rename-kind project --rename-id project_UUID --slug new-url
```

The previous canonical slug becomes a permanent alias. Aliases are never recycled across resources. The same command supports `--rename-kind idea`. Missing historical evidence cannot reconstruct an old undocumented name; do not invent a redirect to a similarly named entity.

The catalog locator is factory-root-relative, so restoring/moving the factory does not hardcode the original installation. Restore catalog and references from the vault/backups, correct trusted portfolio/card paths, and reconcile. Orphaned references block allocation: never delete them to make a bootstrap appear successful. Catalog IDs, slugs and aliases are English machine identifiers; source owner text stays unchanged.

## Read boundary and durability

Server exports in `src/lib/navigation/identities.ts` return `{id, slug}`, resolve only actual card/portfolio reader results, and read the current factory root at call time. They accept public ID/slug/alias tokens and bounded legacy names; URL path strings are never filesystem locators. An existing malformed/unreadable catalog raises `NavigationIdentityError`, never reallocation or a silent empty result. A missing catalog permits a read-only legacy fallback for fixture/bootstrap compatibility; its `legacy-*` IDs are explicitly temporary and never written. Register owner data before enabling persistent routes. An existing catalog with an unregistered resource fails loudly until the lifecycle writer runs.

The catalog is ignored by framework git and included in both `vault-overlay-sync.sh` and `backup-pandacorp-state.sh`. Backups also include project identity metadata. Sibling product git may preserve its own reference independently; the in-factory Mission Control reference instead joins the private overlay and stays excluded from framework git. After every producer apply, invoke those scripts with the factory root. Their existing best-effort/offline reporting contract still applies. No private catalog or personal card is copied into framework source, and no GET triggers writer, backup or vault operations.
