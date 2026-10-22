// Published logical data models (DATA-7 v1 contract) for the fixture projects, written in a
// compact notation and expanded into docs/product/data-model.json.
//
// Entity:  [id, Name, description, "attr type[?] [PK] [FK] [UQ]; ..."]   (? = optional)
// Link:    "from.attr min..max -> to.attr min..max : name"

const FUNKO_ENTITIES = [
  ["franchise", "Franchise", "A licensed universe the catalog groups figures by.", "id uuid PK; slug text UQ; name text; logoAssetId uuid? FK; createdAt timestamp"],
  ["series", "Series", "A numbered run of figures inside a franchise.", "id uuid PK; franchiseId uuid FK; name text; startedOn date?; isActive boolean"],
  ["character", "Character", "A character that can appear in many figures.", "id uuid PK; franchiseId uuid FK; name text; alias text?"],
  ["figure", "Figure", "One catalog piece identified by series and box number.", "id uuid PK; seriesId uuid FK; characterId uuid? FK; boxNumber text; name text; releasedOn date?"],
  ["variant", "Variant", "A distinguishable version of a figure (chase, glow, metallic).", "id uuid PK; figureId uuid FK; kind text; label text"],
  ["edition", "Edition", "A production run or re-release of a variant.", "id uuid PK; variantId uuid FK; year integer; isReissue boolean"],
  ["retailer", "Retailer", "A store that sells exclusives.", "id uuid PK; name text UQ; country text?"],
  ["retailerExclusive", "Retailer exclusive", "A variant sold only by one retailer.", "variantId uuid PK FK; retailerId uuid PK FK; stickerText text?"],
  ["region", "Region", "A market where an edition is released.", "id uuid PK; code text UQ; name text"],
  ["regionalRelease", "Regional release", "When an edition reached a region.", "editionId uuid PK FK; regionId uuid PK FK; releasedOn date?"],
  ["mediaAsset", "Media asset", "An image with its source and licence.", "id uuid PK; url text; width integer?; height integer?; licenceId uuid FK"],
  ["mediaLicence", "Media licence", "The terms under which an image may be shown.", "id uuid PK; name text; allowsHotlink boolean"],
  ["figureImage", "Figure image", "Ordered images of a variant.", "variantId uuid PK FK; assetId uuid PK FK; position integer"],
  ["source", "Source", "Where catalog data comes from.", "id uuid PK; name text UQ; baseUrl text; reviewedOn date?"],
  ["sourceRecord", "Source record", "One raw row fetched from a source.", "id uuid PK; sourceId uuid FK; externalId text; payloadHash text; fetchedAt timestamp"],
  ["ingestionRun", "Ingestion run", "One batch load of the catalog.", "id uuid PK; sourceId uuid FK; startedAt timestamp; finishedAt timestamp?; status text"],
  ["ingestionItem", "Ingestion item", "A staged change waiting for review.", "id uuid PK; runId uuid FK; sourceRecordId uuid FK; figureId uuid? FK; action text"],
  ["reviewDecision", "Review decision", "A curator's verdict on a staged item.", "id uuid PK; itemId uuid FK UQ; curatorId uuid FK; verdict text; decidedAt timestamp"],
  ["user", "User", "A collector or curator account.", "id uuid PK; email text UQ; displayName text?; role text; createdAt timestamp"],
  ["session", "Session", "A signed-in browser session.", "id uuid PK; userId uuid FK; expiresAt timestamp"],
  ["magicLink", "Magic link", "A one-time sign-in token.", "id uuid PK; email text; tokenHash text UQ; expiresAt timestamp; usedAt timestamp?"],
  ["collection", "Collection", "A user's private collection.", "id uuid PK; userId uuid FK UQ; isPublic boolean"],
  ["collectionItem", "Collection item", "A variant the user owns.", "id uuid PK; collectionId uuid FK; variantId uuid FK; boxCondition text?; note text?; addedAt timestamp"],
  ["wishlistItem", "Wishlist item", "A variant the user wants.", "collectionId uuid PK FK; variantId uuid PK FK; addedAt timestamp"],
  ["goal", "Goal", "A target to complete a series.", "id uuid PK; collectionId uuid FK; seriesId uuid FK; includesExclusives boolean"],
  ["goalSnapshot", "Goal snapshot", "Daily progress of a goal.", "goalId uuid PK FK; day date PK; owned integer; total integer"],
  ["exportTemplate", "Export template", "A layout for checklist images.", "id uuid PK; name text UQ; maxRows integer"],
  ["exportJob", "Export job", "A queued checklist image render.", "id uuid PK; collectionId uuid FK; templateId uuid FK; mode text; status text; requestedAt timestamp"],
  ["exportFile", "Export file", "A rendered page of a checklist.", "id uuid PK; jobId uuid FK; page integer; assetUrl text; expiresAt timestamp"],
  ["shareLink", "Share link", "A public link to an export.", "id uuid PK; jobId uuid FK UQ; token text UQ; expiresAt timestamp"],
  ["tag", "Tag", "A free label for figures.", "id uuid PK; name text UQ"],
  ["figureTag", "Figure tag", "Tags applied to figures.", "figureId uuid PK FK; tagId uuid PK FK"],
  ["deltaCheck", "Delta check", "One run of the new-releases watch.", "id uuid PK; sourceId uuid FK; ranAt timestamp; found integer"],
  ["deltaFinding", "Delta finding", "A new figure found by the watch.", "id uuid PK; checkId uuid FK; sourceRecordId uuid FK; itemId uuid? FK"],
  ["emailMessage", "Email message", "An outbound transactional email.", "id uuid PK; userId uuid? FK; kind text; sentAt timestamp?"],
  ["deletionRequest", "Deletion request", "An account erasure request.", "id uuid PK; userId uuid FK UQ; requestedAt timestamp; completedAt timestamp?"],
  ["auditEvent", "Audit event", "An append-only record of privileged actions.", "id uuid PK; actorId uuid? FK; action text; at timestamp"],
  ["featureFlag", "Feature flag", "A server-side switch.", "key text PK; enabled boolean; note text?"],
  ["helpArticle", "Help article", "A help or FAQ page.", "id uuid PK; slug text UQ; title text; body text"],
  ["contactMessage", "Contact message", "A message sent from the contact form.", "id uuid PK; email text; body text; receivedAt timestamp"],
];

const FUNKO_LINKS = [
  "franchise.id 1..1 -> series.franchiseId 0..many : has series",
  "franchise.id 1..1 -> character.franchiseId 0..many : has characters",
  "mediaAsset.id 0..1 -> franchise.logoAssetId 0..many : logo",
  "series.id 1..1 -> figure.seriesId 0..many : contains",
  "character.id 0..1 -> figure.characterId 0..many : portrays",
  "figure.id 1..1 -> variant.figureId 1..many : has variants",
  "variant.id 1..1 -> edition.variantId 0..many : produced as",
  "variant.id 1..1 -> retailerExclusive.variantId 0..many : exclusive at",
  "retailer.id 1..1 -> retailerExclusive.retailerId 0..many : sells",
  "edition.id 1..1 -> regionalRelease.editionId 0..many : released in",
  "region.id 1..1 -> regionalRelease.regionId 0..many : receives",
  "mediaLicence.id 1..1 -> mediaAsset.licenceId 0..many : licenses",
  "variant.id 1..1 -> figureImage.variantId 0..many : shown by",
  "mediaAsset.id 1..1 -> figureImage.assetId 0..many : used as",
  "source.id 1..1 -> sourceRecord.sourceId 0..many : yields",
  "source.id 1..1 -> ingestionRun.sourceId 0..many : loaded by",
  "ingestionRun.id 1..1 -> ingestionItem.runId 0..many : stages",
  "sourceRecord.id 1..1 -> ingestionItem.sourceRecordId 0..many : proposes",
  "figure.id 0..1 -> ingestionItem.figureId 0..many : targets",
  "ingestionItem.id 1..1 -> reviewDecision.itemId 0..1 : reviewed by",
  "user.id 1..1 -> reviewDecision.curatorId 0..many : decides",
  "user.id 1..1 -> session.userId 0..many : signs in",
  "user.id 1..1 -> collection.userId 0..1 : owns",
  "collection.id 1..1 -> collectionItem.collectionId 0..many : holds",
  "variant.id 1..1 -> collectionItem.variantId 0..many : collected as",
  "collection.id 1..1 -> wishlistItem.collectionId 0..many : wants",
  "variant.id 1..1 -> wishlistItem.variantId 0..many : wished as",
  "collection.id 1..1 -> goal.collectionId 0..many : sets",
  "series.id 1..1 -> goal.seriesId 0..many : targeted by",
  "goal.id 1..1 -> goalSnapshot.goalId 0..many : tracked by",
  "collection.id 1..1 -> exportJob.collectionId 0..many : exports",
  "exportTemplate.id 1..1 -> exportJob.templateId 0..many : lays out",
  "exportJob.id 1..1 -> exportFile.jobId 0..many : renders",
  "exportJob.id 1..1 -> shareLink.jobId 0..1 : shared by",
  "figure.id 1..1 -> figureTag.figureId 0..many : tagged",
  "tag.id 1..1 -> figureTag.tagId 0..many : applied",
  "source.id 1..1 -> deltaCheck.sourceId 0..many : watched by",
  "deltaCheck.id 1..1 -> deltaFinding.checkId 0..many : finds",
  "sourceRecord.id 1..1 -> deltaFinding.sourceRecordId 0..many : reported as",
  "ingestionItem.id 0..1 -> deltaFinding.itemId 0..many : staged as",
  "user.id 0..1 -> emailMessage.userId 0..many : receives",
  "user.id 1..1 -> deletionRequest.userId 0..1 : requests erasure",
  "user.id 0..1 -> auditEvent.actorId 0..many : performs",
];

const SAGA_ENTITIES = [
  ["user", "User", "A reader account; guests can read without one.", "id uuid PK; email text UQ; displayName text?; createdAt timestamp"],
  ["guestContext", "Guest context", "Anonymous progress kept on one device.", "id uuid PK; deviceKey text UQ; createdAt timestamp; mergedIntoUserId uuid? FK"],
  ["work", "Work", "A story told in one or more media.", "id uuid PK; slug text UQ; title text; summary text"],
  ["medium", "Medium", "Book, series, film or game.", "id uuid PK; code text UQ; label text"],
  ["release", "Release", "A concrete way to consume a work (a book edition, a season).", "id uuid PK; workId uuid FK; mediumId uuid FK; title text; position integer"],
  ["chapter", "Chapter", "The smallest unit a reader can mark as read.", "id uuid PK; releaseId uuid FK; number integer; title text"],
  ["readingProgress", "Reading progress", "How far a reader has gone in a release.", "id uuid PK; userId uuid? FK; guestId uuid? FK; releaseId uuid FK; chapterId uuid FK; updatedAt timestamp"],
  ["character", "Character", "A person or creature in the story.", "id uuid PK; workId uuid FK; name text; firstChapterId uuid FK"],
  ["place", "Place", "A location in the story.", "id uuid PK; workId uuid FK; name text; firstChapterId uuid FK"],
  ["faction", "Faction", "A group characters belong to.", "id uuid PK; workId uuid FK; name text; firstChapterId uuid FK"],
  ["entry", "Encyclopedia entry", "A spoiler-safe article about something in the story.", "id uuid PK; workId uuid FK; kind text; title text"],
  ["entryRevision", "Entry revision", "What an entry says up to a given chapter.", "id uuid PK; entryId uuid FK; visibleFromChapterId uuid FK; body text"],
  ["connection", "Connection", "A relation between two story elements.", "id uuid PK; workId uuid FK; fromEntryId uuid FK; toEntryId uuid FK; typeId uuid FK; revealedAtChapterId uuid FK"],
  ["connectionType", "Connection type", "Ally, rival, family, location of…", "id uuid PK; label text UQ"],
  ["recap", "Recap", "A before-you-resume summary up to a chapter.", "id uuid PK; releaseId uuid FK; upToChapterId uuid FK; generatedAt timestamp"],
  ["recapSection", "Recap section", "One paragraph of a recap.", "id uuid PK; recapId uuid FK; position integer; body text"],
  ["chapterSummary", "Chapter summary", "A short summary of one chapter.", "chapterId uuid PK FK; body text"],
  ["catalogBundle", "Catalog bundle", "A versioned set of files describing a work.", "id uuid PK; workId uuid FK; version integer; publishedAt timestamp?"],
  ["publishRun", "Publish run", "An atomic publication of a bundle.", "id uuid PK; bundleId uuid FK; startedAt timestamp; status text"],
  ["imageAsset", "Image asset", "Cover art or portraits with their credit.", "id uuid PK; workId uuid FK; url text; credit text"],
  ["ingestionSource", "Ingestion source", "A reference the ingestion skill reads from.", "id uuid PK; name text UQ; url text"],
  ["ingestionJob", "Ingestion job", "One run of the ingestion skill for a work.", "id uuid PK; workId uuid FK; sourceId uuid FK; status text; startedAt timestamp"],
  ["spoilerReport", "Spoiler report", "A reader's report of a leaked spoiler.", "id uuid PK; entryRevisionId uuid FK; userId uuid? FK; reportedAt timestamp"],
  ["bookmark", "Bookmark", "A saved entry or connection.", "userId uuid PK FK; entryId uuid PK FK; savedAt timestamp"],
  ["auditEvent", "Audit event", "Append-only record of publication actions.", "id uuid PK; actorId uuid? FK; action text; at timestamp"],
  ["featureFlag", "Feature flag", "A server-side switch.", "key text PK; enabled boolean"],
];

const SAGA_LINKS = [
  "user.id 0..1 -> guestContext.mergedIntoUserId 0..many : absorbs",
  "work.id 1..1 -> release.workId 1..many : published as",
  "medium.id 1..1 -> release.mediumId 0..many : format of",
  "release.id 1..1 -> chapter.releaseId 1..many : split into",
  "user.id 0..1 -> readingProgress.userId 0..many : reads",
  "guestContext.id 0..1 -> readingProgress.guestId 0..many : reads as guest",
  "release.id 1..1 -> readingProgress.releaseId 0..many : tracked in",
  "chapter.id 1..1 -> readingProgress.chapterId 0..many : reached",
  "work.id 1..1 -> character.workId 0..many : features",
  "chapter.id 1..1 -> character.firstChapterId 0..many : introduces",
  "work.id 1..1 -> place.workId 0..many : is set in",
  "chapter.id 1..1 -> place.firstChapterId 0..many : reveals place",
  "work.id 1..1 -> faction.workId 0..many : has factions",
  "chapter.id 1..1 -> faction.firstChapterId 0..many : reveals faction",
  "work.id 1..1 -> entry.workId 0..many : documented by",
  "entry.id 1..1 -> entryRevision.entryId 1..many : revised as",
  "chapter.id 1..1 -> entryRevision.visibleFromChapterId 0..many : unlocks",
  "work.id 1..1 -> connection.workId 0..many : relates",
  "entry.id 1..1 -> connection.fromEntryId 0..many : links from",
  "entry.id 1..1 -> connection.toEntryId 0..many : links to",
  "connectionType.id 1..1 -> connection.typeId 0..many : classifies",
  "chapter.id 1..1 -> connection.revealedAtChapterId 0..many : reveals link",
  "release.id 1..1 -> recap.releaseId 0..many : summarised by",
  "chapter.id 1..1 -> recap.upToChapterId 0..many : bounds",
  "recap.id 1..1 -> recapSection.recapId 1..many : made of",
  "chapter.id 1..1 -> chapterSummary.chapterId 0..1 : summarised as",
  "work.id 1..1 -> catalogBundle.workId 0..many : packaged as",
  "catalogBundle.id 1..1 -> publishRun.bundleId 0..many : published by",
  "work.id 1..1 -> imageAsset.workId 0..many : illustrated by",
  "work.id 1..1 -> ingestionJob.workId 0..many : ingested by",
  "ingestionSource.id 1..1 -> ingestionJob.sourceId 0..many : feeds",
  "entryRevision.id 1..1 -> spoilerReport.entryRevisionId 0..many : flagged by",
  "user.id 0..1 -> spoilerReport.userId 0..many : reports",
  "user.id 1..1 -> bookmark.userId 0..many : saves",
  "entry.id 1..1 -> bookmark.entryId 0..many : saved as",
  "user.id 0..1 -> auditEvent.actorId 0..many : performs",
];

function expandEntity([id, name, description, attrs]) {
  const attributes = attrs.split(";").map((raw) => {
    const [attrName, rawType, ...flags] = raw.trim().split(/\s+/);
    const optional = rawType.endsWith("?");
    const keys = flags.filter((f) => ["PK", "FK", "UQ"].includes(f));
    return { id: attrName, name: attrName, type: rawType.replace(/\?$/, ""), optional, ...(keys.length ? { keys } : {}) };
  });
  // A composite primary key is a key group, not several independent PK columns.
  const pk = attributes.filter((a) => a.keys?.includes("PK"));
  if (pk.length > 1) {
    for (const a of pk) a.keys = a.keys.filter((k) => k !== "PK");
    for (const a of pk) if (!a.keys.length) delete a.keys;
    return { id, name, description, attributes, keyGroups: [{ kind: "PK", attributes: pk.map((a) => a.id) }] };
  }
  return { id, name, description, attributes };
}

function expandLink(line) {
  const m = /^(\w+)\.(\w+) (\d)\.\.(\d|many) -> (\w+)\.(\w+) (\d)\.\.(\d|many) : (.+)$/.exec(line);
  if (!m) throw new Error(`bad link: ${line}`);
  const card = (v) => (v === "many" ? "many" : Number(v));
  return {
    id: `${m[1]}-${m[5]}-${m[6]}`,
    name: m[9],
    from: { entity: m[1], attributes: [m[2]], min: Number(m[3]), max: card(m[4]) },
    to: { entity: m[5], attributes: [m[6]], min: Number(m[7]), max: card(m[8]) },
  };
}

/** The relational model of a fixture project ("funko" | "saga"). */
export function relationalModel(which) {
  const [entities, links] = which === "funko" ? [FUNKO_ENTITIES, FUNKO_LINKS] : [SAGA_ENTITIES, SAGA_LINKS];
  return { schemaVersion: 1, persistence: "relational", entities: entities.map(expandEntity), relationships: links.map(expandLink) };
}

/** The explicit no-database model (DATA-7). */
export const NO_DATABASE = { schemaVersion: 1, persistence: "none", entities: [], relationships: [] };
