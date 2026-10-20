# Mesh public taxonomy regression, 2026-10-20

The final SDK acceptance failure was a real upstream schema change exposing a parser compatibility bug. The earlier successful report selected `/websites?tech=three-js`. Current permitted public detail pages explicitly link `Three.js` to `/websites?technology=three-js` and `WebGL2` to `/websites?technology=webgl2`, under the visible “How it's built” heading. The parser recognized only `tech` and `tags`; it consequently returned empty technology metadata and could not select the current native technology route. The acceptance expectation was valid: current public pages still explicitly publish Three.js technology labels.

The repair accepts both source technology parameter names, retains the exact observed native URL and slug, and reuses the same origin/path validation for record labels. It does not derive technology from descriptions, global page titles, metadata keywords, or unrelated taxonomy.

Evidence:

- `mesh-final-before-repair.json`: robots-aware inspection of the public listing and six detail pages; all HTTP 200, zero technology labels parsed before repair. It stores hashes/counts and parsed taxonomy only.
- The new regression initially failed against the old compiled parser: actual taxonomy `[]` instead of the explicit Three.js/WebGL2 anchors. Both targeted Mesh regressions passed after the coordinated rebuild; the fixture also rejects other origins and `/api/websites` links.
- `mesh-final-validation.json`: production adapter validation after repair, two source pages, three records and three explicit Three.js matches on each page. Both continuations selected the observed `technology=three-js` route. This is adapter evidence; the root agent separately refreshes the full MCP SDK acceptance report.

Scope remains bounded. The source now also exposes `type`, `theme`, `subject`, `role`, `interaction`, `technique`, and `weight` facets. This minimal compatibility repair does not map these new dimensions into categories, tags, or technologies. Legacy `tags` links remain supported where actually exposed; no replacement tags are invented. Current `/api/` robots restrictions continue to prevent the client infinite-scroll API from being used, so retrieval covers only exposed public listing/detail links and does not claim complete gallery coverage. No source media, source HTML, website catalog, or API response is persisted.
