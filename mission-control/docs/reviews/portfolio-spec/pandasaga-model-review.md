# PandaSaga logical data-model publication — independent review

Date: 2026-10-16. Scope: source-to-artifact consistency for the approved architecture design. Read-only review; no project, build state, queue, database or runtime changes performed.

## Verdict

PASS for publication of the approved **designed** model. No blocking omissions, invented entities, contradictory mappings, PK/UQ errors or cardinality errors found. This is not implementation/schema verification or visual verification of Mission Control.

Reviewed artifact: `/Users/Shared/Proyectos/pandasaga/docs/product/data-model.json`.
SHA-256: `5c83ec760cf69a22890b849829a83b8dbd3545521789c1f628889801cc6eb7c0`.

## Independent source grounding

- Read project `AGENTS.md` and factory constitution.
- Read the actual approved platform Data model section, `/Users/Shared/Proyectos/pandasaga/docs/product/architecture.md:191` through the model tables and enum/reconciliation sections. The publication note at :104 is new explanatory prose, not the independent source of the model.
- Opened all 39 entity definitions, all 395 attributes and all 95 mapped relationships. Compared field names, logical types, optional flags, global fields, PK exceptions and explicit keys against the platform tables. Better Auth delegated fields were checked in actual local package code, not assumed from publisher notes.
- Consulted relevant owning FRDs, blueprints, WO-01-006, WO-02-001, WO-02-003, WO-02-004 and ADR-0006 for context references and derived/file-only entities. The publisher's `/tmp/pandasaga-model-publication.md` and generation script were not used as an oracle.

Coverage includes identity/reader state (User, Session, Account, Verification, RateLimit, UserProgress, ReaderPreference, GuestTransfer, GuestTransferItem, ContentReport, ReferenceWarningDismissal, NoticeDelivery), operations (JobRun, ErrorEvent), and the complete catalog root plus its 24 dependent entity types.

## Structural and semantic verification

Executed the actual Mission Control filesystem reader using its existing TS loader:

`node --loader ./scripts/read-model/ts-loader.mjs --input-type=module`

with `readDataModel('/Users/Shared/Proyectos/pandasaga')`, importing `src/lib/architecture/data-model/read-data-model.ts` from Mission Control.

Observed result: `ready`, 39 entities, 395 attributes, 95 relationships, 31 key groups. The file is valid under the actual strict V1 validator. An independently malformed in-memory copy with a dangling target attribute returned `error: Invalid data model at relationships[0].to.attributes.` No malformed file was written to the project.

Additional independent Python assertions, transcribed from canonical source tables and owning feature contracts, passed:

- Exact 39 entity-name set and mandatory createdAt/updatedAt fields on every entity.
- Default synthetic id PK only where permitted. ReaderPreference.userId, Relationship.contentItemId and Connection.contentItemId replace id. ContentSource has the ordered composite PK (contentItemId, sourceRefId), with neither member independently unique.
- Exact 95 FK source-field/target-field mappings; every FK marker has a mapped edge and every mapped dependent field is marked FK. The 24 catalog-dependent types each have the explicitly required direct CatalogVersion.id link (`architecture.md:238`); CatalogVersion itself has no invented self FK.
- All 95 relationships declare both endpoint cardinalities. Required dependent references point to 1..1, nullable ones to 0..1. Reverse endpoints are 0..many except the three PK/FK specializations, which are 0..1. Composite-PK association members remain many individually.
- Exact ordered members of all 31 composite PK/UQ groups. Only User.email, Session.token and RateLimit.key have single-field UQ markers. Composite participants are not marked individually UQ. No unconditional UQ substitutes for a partial unique index.
- Self references and all parallel references are preserved, including Collection.parentId, MapAsset.parentMapId, both GuestTransfer→User links, both Adaptation→Work links, first/last ReadingUnit links, Relationship entity endpoints, Connection content/warning references, and MapPlacement map/zoom links.

## Sensitive mappings investigated

These are grounded in domain definitions and consuming contracts, not solely in `*Id` names:

- **SourceRef → Work/Edition/ReadingUnit:** platform table `architecture.md:260` and FRD-02 `frd.md:101` define mapped canonical work/edition/unit evidence. FRD-02 distinguishes research evidence that need not have a canonical mapping at :108; those records are not SourceRef or database tables. ReadingUnit is nullable only for pre-reading evidence in the owning prose; nullable artifact flag correctly represents that storage possibility. No fake broad optional edition/work association was introduced.
- **ContentPlacement → Work/ReadingUnit/Entity:** `architecture.md:262`, FRD-02 `frd.md:102` explicitly describe reviewed book/chapter/entity subject associations, with optional unit and entity.
- **GraphNodePosition → Work/Entity:** `architecture.md:266`, FRD-04 `frd.md:109`, ADR-0006 :33 and WO-02-004 :49–52 bind coordinates to entity nodes within a requested work/view. The artifact does not invent a separate View table or FK from viewKey.
- **ConnectionEndpoint → Connection/Work/ReadingUnit/Entity/label ContentItem:** `architecture.md:268` and FRD-05 `frd.md:75` define canonical ReadingUnit of that work, optional entity and label. Its connection mapping correctly targets Connection.contentItemId, rather than a nonexistent Connection.id. Optional labels target ContentItem. WO-02-004 :81 onward confirms independently gated endpoint labels and units/entities.
- **MapAsset → Work and MapPlacement → Entity:** `architecture.md:271–272` and FRD-04 `frd.md:106` define per-work map hierarchy and optional placement entity. WO-02-004 :64–79 explicitly reads MapPlacement.entityId's Entity and zoom targets to child maps. The model preserves these two distinct map associations and optionality.

## Intentional non-relations and nonentities

Stable reader identifiers remain scalar values: UserProgress work/edition/unit keys and informational catalogVersionId; ContentReport work/unit/publicId/version identifiers; NoticeDelivery.catalogVersionId; GuestTransferItem.workKey; ReferenceWarningDismissal.connectionPublicId. This follows `architecture.md:213`, :217–223 and :219. ContentLink.destinationKey remains polymorphic; factKey/supersedesKey, editorial creator/reviewer labels, groupKey and viewKey do not gain guessed FKs. FRD-02 `frd.md:98` explicitly says creator/reviewer provenance is not extra application accounts.

No GuestSession, DTO/package, research or ingest-state database entity was invented. Platform reconciliation and the file-only exclusions after the catalog tables remain authoritative.

## Better Auth evidence

Inspected real files at:

`/tmp/claude-501/-Users-Shared-Proyectos-pandasaga/d6adb233-9f77-4ef5-a222-5e7da5f82393/scratchpad/gates3/grounding/dl/better-auth/core/package/package.json`

and the sibling `dist/db/get-tables.mjs`. The manifest says `@better-auth/core` version `1.7.7`. The code declares optional String accessToken, refreshToken, idToken and scope, optional DateTime accessTokenExpiresAt/refreshTokenExpiresAt, and optional String password. It also confirms optional Session.ipAddress/userAgent and User.image. No extra library-origin FK/UQ was inferred. The project-required global RateLimit timestamps are explicitly dictated by project architecture, even though the library's RateLimit core only declares key/count/lastRequest.

Direct filesystem checks observed that `/Users/Shared/Proyectos/pandasaga/prisma/schema.prisma`, its parent prisma directory and `node_modules/better-auth/package.json` do not exist. Therefore the publication's unimplemented-design disclosure is accurate; the local grounding package does not become installed-project provenance.

## Prose diff and limits

Read the complete diffs in architecture.md, docs/decision-log.md and WO-01-006. They accurately describe this publication and place later schema-to-artifact refresh ownership on WO-01-006/future model-changing work. No implementation completion, phase advancement, verification receipt or schema flag is claimed or added. Observed project status shows only these three modified docs plus the new JSON.

V1 cannot encode SQL predicates, CHECK/default/delete actions, enum member sets or same-version/type-dependent constraints. CatalogVersion's partial PUBLISHED uniqueness, EditionUnit's conditional terminal uniqueness and MapAsset's base XOR remain explicit in entity descriptions and owning source prose (`architecture.md:148`, :248, :255, :271; WO-01-006 :109). Their predicates are not falsely represented as unconditional keys. This is an understood representational limit, not an artifact consistency blocker. Exact enforcement will require review against the implemented schema/migration and installed auth definitions when WO-01-006 executes.

No reviewer fixes requested.
