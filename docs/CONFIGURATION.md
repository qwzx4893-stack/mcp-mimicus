# Configuration
Configuration is environment based. No database path exists.

| Variable | Default / purpose |
|---|---|
| MIMICUS_ALLOWED_ORIGINS | Additional reviewed public origins; source metadata origins are built in |
| MIMICUS_TIMEOUT_MS |30000;1–120 seconds per bounded operation |
| MIMICUS_MAX_ELEMENTS |60, maximum200 selected probe elements |
| MIMICUS_SAMPLE_MS |600, maximum3000 controlled sampling duration |
| MIMICUS_MAX_REQUESTS |160 cumulative requests per browser session |
| MIMICUS_MAX_BYTES |20000000 byte budget |
| MIMICUS_SETTLE_MS |250 between normal interactions |
| MIMICUS_ASSETS |permitted; blocked is a diagnostic mode that reduces visual fidelity |
| MIMICUS_BROWSER_EXECUTABLE |Optional installed Chromium executable |
| MIMICUS_MAX_SESSIONS |3, maximum4 |
| MIMICUS_SESSION_TTL_MS |600000 idle window, maximum1800000; selected activity or explicit renew refreshes this within the absolute deadline |
| MIMICUS_SESSION_ABSOLUTE_TTL_MS |1800000 from creation, maximum3600000; renewal cannot extend it |
| MIMICUS_MAX_SESSION_IMAGES |80 successful images per session, maximum200; cumulative across renewal |
| MIMICUS_MAX_SESSION_OPERATIONS |200 browser operations per session, maximum1000; cumulative across renewal |
| MIMICUS_OPERATION_TTL_MS |300000, hard maximum900000 from operation creation |
| MIMICUS_DISCOVERY_REQUESTS |48 metadata HTTP requests per call, official MCP calls separate |
| MIMICUS_CANDIDATE_LIMIT |160 semantic admission window, maximum200; search candidateWindow can select10–200 |
| MIMICUS_SEMANTIC |1 enabled;0 lexical only |
| MIMICUS_MODEL_DOWNLOAD |0;1 explicitly permits software model download |
| MIMICUS_MODEL_CACHE_DIR |User home/.cache/mimicus/models, model software only |
| MIMICUS_SEMANTIC_THREADS |2 intra-op CPU threads; inter-op1 |
| MIMICUS_SOURCE_AUTHORIZATIONS |Reserved JSON provider→authorization-reference metadata; arbitrary strings never enable the shipped Awwwards catalog or gallery browser |
| MIMICUS_DEV_MODE / MIMICUS_DEV_ORIGINS |Explicit test-only opt-in and exact loopback origins |

Browser open accepts up to eight additional public resourceOrigins. Rejected resources report their origin/type. This is a per-session approval scope, not automatic approval of every linked third party. The shipped Awwwards catalog remains blocked pending a genuine reviewed grant and an explicitly reviewed implementation; setting an authorization string cannot enable it. Operator-supplied original-site URLs remain available, with their unverified source relationship labeled.

Each search retains at most320 references by default (retentionLimit10–600). Continuation drains scored delivery and deferred semantic queues before fetching new source pages. Eviction IDs are explicit. A separate bounded ledger remembers at most2400 delivered IDs; reaching it stops continuation and requires a new search. References, scores, vectors, cursors and this ledger stay in RAM and are released on expiry/end. Search expiration is independent of browser-session renewal.

Use mimicus_interact with {sessionId, interaction:{action:"renew"}} before idle expiry. A closed or expired session must be reopened. Image, operation, request and byte budgets never reset during renewal. mimicus_list_sources reports selected sessions and temporary discovery resources without renewing all sessions.

Model: Xenova/all-MiniLM-L6-v2 revision751bff37182d3f1213fa05d7196b954e230abad9, q8 ONNX,384 dimensions, mean/L2. Four official artifact digests are checked. Model cache files are software, never website embeddings.
