# Migration from the persistent phases
Version 0.2 replaced the warehouse architecture with live federation. Version 0.3 adds installed default-browser isolation, broader source interfaces and evidence-backed design briefs. Historical user exports are not included in the public release and the server never loads them.

There is no automatic database migration or import into a replacement catalog. Remove integrations that call worker, bootstrap, sync, refresh, backup, compaction, stored-pattern search or old index-status commands. The current `doctor` diagnoses installed browser/model software; it does not inspect a catalog. Rebuild dist to remove retired emitted modules.

Use a new live discovery operation, select a reference, open a temporary browser session and analyze only selected elements. IDs are scoped to active operations/sessions, not durable identifiers. Close them explicitly. Previous stored pattern IDs and corpus manifests are intentionally unsupported.

Existing custom model software can be relocated to MIMICUS_MODEL_CACHE_DIR if it matches the pinned revision/integrity checks. Site embeddings and old catalogs are not imported. Default model software cache is outside the repository. Legacy MIMICUS_DATA_DIR has no effect.

The cleanup removed individually verified generated SQLite files after the recovery point. User-owned reports/assets should be archived by their owner if desired; no startup routine recursively deletes legacy folders. Historical files remaining on disk cannot silently re-enable old behavior.
