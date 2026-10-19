#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { resolveBrowserBackend } from './browser/backend.js';
import { browserSelfTest } from './browser/self-test.js';
import { loadConfig } from './config.js';
import { createMcpServer, Mimicus } from './server.js';
import { VERSION } from './version.js';

async function main() {
  if (process.argv[2] === '--version') {
    console.log(VERSION);
    return;
  }
  if (['--help', '-h'].includes(process.argv[2] ?? '')) {
    console.log(
      'mimicus [serve | search <query> | sources | doctor | self-test | model-check | model-fetch]\nWindows: uses the installed default Chromium browser. Other hosts: set MIMICUS_BROWSER_EXECUTABLE. No browser download.',
    );
    return;
  }
  const command = process.argv[2] ?? 'serve',
    config = loadConfig();
  if (command === 'model-fetch') config.semanticDownload = true;
  const app = new Mimicus(config);
  let server: ReturnType<typeof createMcpServer> | undefined,
    closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await app.close();
    await server?.close();
  };
  if (command === 'serve') {
    server = createMcpServer(app);
    server.server.onclose = () => void close();
    process.once('SIGINT', () => void close());
    process.once('SIGTERM', () => void close());
    await server.connect(new StdioServerTransport());
    return;
  }
  try {
    if (command === 'search')
      console.log(
        JSON.stringify(
          await app.federation.search({
            query: process.argv.slice(3).join(' '),
          }),
          null,
          2,
        ),
      );
    else if (command === 'sources')
      console.log(JSON.stringify(app.federation.listSources(), null, 2));
    else if (command === 'doctor') {
      let browser: unknown;
      try {
        browser = {
          resolved: true,
          ...(await resolveBrowserBackend(config)),
          launchTested: false,
        };
      } catch (e) {
        browser = {
          resolved: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
      let integrity: unknown;
      try {
        integrity = { verified: true, ...(await app.federation.semantic.verifyModel()) };
      } catch (e) {
        integrity = {
          verified: false,
          error: e instanceof Error ? e.message : String(e),
          fallback:
            'Lexical discovery remains available; install the pinned model software explicitly with model-fetch.',
        };
      }
      console.log(
        JSON.stringify(
          {
            browser,
            model: {
              ...app.federation.semantic.status(),
              integrity,
            },
            sources: {
              contacted: false,
              meaning: 'Configuration only; use a live search to test upstream connectivity',
              providers: app.federation.listSources(),
            },
            persistence: {
              websiteDatabase: false,
              modelSoftwareCache: config.modelCacheDir,
            },
            next: 'Run mimicus self-test to verify the actual installed browser rendering, navigation, image blocks, mobile viewport and cleanup.',
          },
          null,
          2,
        ),
      );
    } else if (command === 'self-test')
      console.log(JSON.stringify(await browserSelfTest(config), null, 2));
    else if (command === 'model-check' || command === 'model-fetch') {
      if (!(await app.federation.semantic.init()))
        throw new Error(JSON.stringify(app.federation.semantic.status()));
      console.log(
        JSON.stringify({
          status: app.federation.semantic.status(),
          integrity: await app.federation.semantic.verifyModel(),
        }),
      );
    } else if (command === 'help')
      console.log(
        'mimicus [serve|search brief|sources|doctor|self-test|model-check|model-fetch|help]\nUses the installed Windows HTTPS default Chromium browser headlessly with an isolated temporary profile. MIMICUS_BROWSER_EXECUTABLE explicitly opts into another installed compatible binary. No browser download or silent fallback.\nTemporary live federation and visual browsing; no website database, worker, sync, migration or backup commands.',
      );
    else
      throw new Error(
        'Unknown command; use mimicus help. Persistent database/index/worker commands were removed.',
      );
  } finally {
    await close();
  }
}
main().catch((e) => {
  process.stderr.write(
    JSON.stringify({
      level: 'error',
      message: e instanceof Error ? e.message : 'Operation failed',
    }) + '\n',
  );
  process.exitCode = 1;
});
