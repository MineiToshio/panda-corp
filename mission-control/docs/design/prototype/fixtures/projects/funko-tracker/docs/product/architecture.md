# Platform architecture — Funko Tracker

A server-rendered Next.js app on managed PostgreSQL, a small worker that renders checklist images and runs the new-releases watch, object storage for exported posters, transactional email for magic links.

## Data model

The published logical model lives in [data-model.json](data-model.json): 40 entities across catalog, sources, collection, goals, exports and operations.

## Cross-cutting

- Every reader returns a typed result; malformed input fails loud.
- Catalog writes only happen through the review queue.
- Secrets live in the environment; `.env.example` documents every variable.
