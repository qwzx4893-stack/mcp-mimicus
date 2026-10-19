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
| MIMICUS_MAX_SESSIONS |2, maximum4 |
| MIMICUS_SESSION_TTL_MS |300000, hard maximum900000 from session creation |
| MIMICUS_OPERATION_TTL_MS |300000, hard maximum900000 from operation creation |
| MIMICUS_DISCOVERY_REQUESTS |48 metadata HTTP requests per call, official MCP calls separate |
| MIMICUS_CANDIDATE_LIMIT |80 merged candidates, maximum200 |
| MIMICUS_SEMANTIC |1 enabled;0 lexical only |
| MIMICUS_MODEL_DOWNLOAD |0;1 explicitly permits software model download |
| MIMICUS_MODEL_CACHE_DIR |User home/.cache/mimicus/models, model software only |
| MIMICUS_SEMANTIC_THREADS |2 intra-op CPU threads; inter-op1 |
| MIMICUS_SOURCE_AUTHORIZATIONS |JSON provider→reviewed authorization reference; empty by default |
| MIMICUS_DEV_MODE / MIMICUS_DEV_ORIGINS |Explicit test-only opt-in and exact loopback origins |

Browser open accepts up to eight additional public resourceOrigins. Rejected resources report their origin/type. This is a per-session approval scope, not automatic approval of every linked third party. SourceAuthorization strings must represent a real reviewed grant; setting an arbitrary string does not create permission. The shipped configuration contains no Awwwards authorization.

Model: Xenova/all-MiniLM-L6-v2 revision751bff37182d3f1213fa05d7196b954e230abad9, q8 ONNX,384 dimensions, mean/L2. Four official artifact digests are checked. Model cache files are software, never website embeddings.
