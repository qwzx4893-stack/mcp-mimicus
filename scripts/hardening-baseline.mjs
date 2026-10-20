import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const client = new Client({ name: 'hardening-baseline', version: '1.0.0' });
const report = {
  at: new Date().toISOString(),
  kind: 'Actual production stdio baseline, no adapter injection',
  cases: [],
};
try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(process.argv[2] ?? 'dist/cli.js'), 'serve'],
      stderr: 'pipe',
    }),
  );
  report.tools = (await client.listTools()).tools.map((t) => t.name);
  for (const provider of ['nuxt', 'awwwards']) {
    const started = performance.now();
    const r = await client.callTool(
      {
        name: 'mimicus_search',
        arguments: {
          providers: [provider],
          query: 'retail coffee',
          retrieval: 'lexical',
          limit: 3,
        },
      },
      { timeout: 90000 },
    );
    if (r.isError) throw Error(JSON.stringify(r.content));
    const d = r.structuredContent.data;
    report.cases.push({
      provider,
      elapsedMs: performance.now() - started,
      results: d.results.length,
      requests: d.metadataHttpRequests,
      coverage: d.sources.map((s) => ({
        provider: s.provider,
        stream: s.stream,
        status: s.status,
        returned: s.returnedRecords,
        coverage: s.coverage,
      })),
    });
    await client.callTool({
      name: 'mimicus_end_discovery',
      arguments: { operationId: d.operationId },
    });
  }
  const status = (await client.callTool({ name: 'mimicus_list_sources', arguments: {} }))
    .structuredContent.data;
  report.finalResources = { browser: status.browser, federation: status.federation };
} finally {
  await client.close();
}
mkdirSync('artifacts/product-hardening', { recursive: true });
writeFileSync('artifacts/product-hardening/baseline-sdk.json', JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    tools: report.tools.length,
    cases: report.cases,
    report: 'artifacts/product-hardening/baseline-sdk.json',
  }),
);
