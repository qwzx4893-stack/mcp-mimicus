// Explicit deterministic owned-fixture harness, never imported by the product CLI.
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { ConfigSchema } from '../dist/config.js';
import { Federation } from '../dist/discovery/federation.js';
import { SourceRecordSchema } from '../dist/discovery/types.js';
import { createMcpServer, Mimicus } from '../dist/server.js';

const origin = process.env.MIMICUS_TEST_ORIGIN,
  config = ConfigSchema.parse({
    developmentOrigins: [origin],
    browserExecutable: process.env.MIMICUS_BROWSER_EXECUTABLE,
    semanticEnabled: false,
    assets: 'blocked',
    settleMs: 100,
    sampleMs: 450,
  });
const adapter = {
  id: 'nuxt',
  search: async (c) => {
    const r = await c.get(origin + '/source'),
      d = JSON.parse(r.body);
    return [
      {
        provider: 'nuxt',
        stream: 'showcase',
        status: 'available',
        records: d.items.map((i, n) =>
          SourceRecordSchema.parse({
            provider: 'nuxt',
            stream: 'showcase',
            itemId: String(n),
            ...i,
            listingUrl: origin + '/source',
            makers: ['Owned fixture'],
            provenance: 'Owned SDK test source, not live Nuxt or curated provider evidence',
            retrievedAt: new Date().toISOString(),
          }),
        ),
        coverage: 'Explicit owned HTTP fixture for SDK protocol tests only',
        retrievedAt: new Date().toISOString(),
        diagnostics: [],
      },
    ];
  },
};
const app = new Mimicus(config, new Federation(config, undefined, [adapter])),
  server = createMcpServer(app);
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await app.close();
  await server.close();
};
server.server.onclose = () => void close();
process.once('SIGTERM', () => void close());
await server.connect(new StdioServerTransport());
