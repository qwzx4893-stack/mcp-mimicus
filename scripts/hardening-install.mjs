// Actual packed-install acceptance. No source adapters, browser mocks or developer
// application helpers are imported by the installed process.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suppliedArchive = process.argv.find((x) => x.startsWith('--archive='))?.slice(10);
const source = resolve(process.argv.find((x) => x.startsWith('--source='))?.slice(9) ?? root);
const reportDestination = resolve(
  root,
  process.argv.find((x) => x.startsWith('--report='))?.slice(9) ??
    'artifacts/product-hardening/install-acceptance.json',
);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runRoot = join(root, '.release', `install-${runId}`);
const prefix = join(runRoot, 'consumer');
const home = join(runRoot, 'home');
for (const directory of [runRoot, prefix, home]) mkdirSync(directory, { recursive: true });
const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
assert.ok(existsSync(npmCli), 'Use a standard installed Node/npm distribution');
const env = {};
for (const key of [
  'PATH',
  'Path',
  'SystemRoot',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'ComSpec',
  'PATHEXT',
  'TEMP',
  'TMP',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'ProgramW6432',
  'ALLUSERSPROFILE',
  'PROCESSOR_ARCHITECTURE',
  'NUMBER_OF_PROCESSORS',
]) {
  if (process.env[key] !== undefined) env[key] = process.env[key];
}
Object.assign(env, {
  HOME: home,
  USERPROFILE: home,
  APPDATA: join(home, 'AppData', 'Roaming'),
  LOCALAPPDATA: join(home, 'AppData', 'Local'),
  npm_config_userconfig: join(home, 'empty.npmrc'),
  npm_config_globalconfig: join(home, 'empty-global.npmrc'),
  npm_config_cache: join(runRoot, 'npm-cache'),
  npm_config_registry: 'https://registry.npmjs.org/',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
  MIMICUS_MODEL_CACHE_DIR: join(home, 'models'),
  MIMICUS_MODEL_DOWNLOAD: '0',
});
writeFileSync(env.npm_config_userconfig, '');
writeFileSync(env.npm_config_globalconfig, '');
const report = {
  at: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  status: 'RUNNING',
  isolation: {
    freshConsumerDirectory: true,
    freshHomeAndModelDirectory: true,
    inheritedCredentialVariables: false,
    inheritedMimicusConfiguration: false,
    npmUserAndGlobalConfiguration: 'Empty files; explicit public npm registry',
    browserDownload: false,
    npmPublication: false,
    harness:
      'Test orchestrator only; all application and SDK imports resolve from installed package',
  },
  checks: [],
};
const safeError = (error) =>
  String(error instanceof Error ? error.message : error)
    .replaceAll(root, '<workspace>')
    .replaceAll(home, '<fresh-home>')
    .replace(/[A-Z]:(?:\\+|\/)Users(?:\\+|\/)[^"'\r\n]*/gi, '<local-user-path>')
    .slice(0, 3000);
function command(args, cwd = prefix, customEnv = env) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env: customEnv,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}
function checked(args, cwd = prefix, customEnv = env) {
  const result = command(args, cwd, customEnv);
  assert.equal(result.code, 0, safeError(result.error ?? result.stderr));
  return result.stdout;
}
function summarizeBrowser(browser = {}) {
  return Object.fromEntries(
    Object.entries(browser).filter(([key]) =>
      [
        'name',
        'browser',
        'productName',
        'selection',
        'version',
        'isolated',
        'headless',
        'compatible',
        'engine',
      ].includes(key),
    ),
  );
}

let client;
try {
  if (process.argv.includes('--verify-source')) {
    assert.notEqual(
      source,
      root,
      'Source verification requires the explicitly selected fresh checkout',
    );
    const git = (args) => {
      const result = spawnSync('git', args, {
        cwd: source,
        env,
        encoding: 'utf8',
        windowsHide: true,
      });
      assert.equal(result.status, 0, safeError(result.stderr));
      return result.stdout.trim();
    };
    const commit = git(['rev-parse', 'HEAD']);
    const expectedCommit = process.argv
      .find((x) => x.startsWith('--expected-source-commit='))
      ?.slice(25);
    if (expectedCommit) assert.equal(commit, expectedCommit);
    const origin = git(['remote', 'get-url', 'origin']);
    assert.match(origin, /^https:\/\/github\.com\/qwzx4893-stack\/mcp-mimicus(?:\.git)?$/);
    assert.equal(git(['status', '--porcelain']), '', 'Fresh source checkout must start clean');
    report.sourceVerification = { commit, origin, cleanBefore: true, commands: [] };
    for (const args of [
      ['ci', '--ignore-scripts', '--no-fund', '--no-audit'],
      ['run', 'build'],
      ['run', 'lint'],
      ['run', 'check'],
    ]) {
      const started = performance.now();
      const stdout = checked([npmCli, ...args], source);
      report.sourceVerification.commands.push({
        command: `npm ${args.join(' ')}`,
        passed: true,
        durationMs: Math.round(performance.now() - started),
        stdoutSha256: createHash('sha256').update(stdout).digest('hex'),
      });
    }
    const sourceCli = join(source, 'dist', 'cli.js');
    const version = checked([sourceCli, '--version'], source).trim();
    const doctor = JSON.parse(checked([sourceCli, 'doctor'], source));
    const selfTest = JSON.parse(checked([sourceCli, 'self-test'], source));
    assert.equal(doctor.browser.resolved, true);
    assert.equal(selfTest.passed, true);
    report.sourceVerification.cli = {
      version,
      doctorBrowserResolved: true,
      doctorModelState: doctor.model.state,
      selfTestPassed: true,
      browser: summarizeBrowser(selfTest.browser),
      checks: selfTest.checks,
    };
    assert.equal(
      git(['status', '--porcelain']),
      '',
      'Public source build must not change tracked files',
    );
    report.sourceVerification.cleanAfter = true;
  }
  const expected = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  let archive = suppliedArchive && resolve(suppliedArchive);
  if (!archive) {
    const packed = JSON.parse(
      checked(
        [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', runRoot],
        source,
      ),
    )[0];
    archive = join(runRoot, packed.filename);
    report.package = {
      name: packed.name,
      version: packed.version,
      fileCount: packed.files.length,
      compressedBytes: packed.size,
      unpackedBytes: packed.unpackedSize,
      integrity: packed.integrity,
      files: packed.files.map((f) => f.path),
    };
    assert.ok(
      !report.package.files.some((file) =>
        /(^|\/)(scripts|test|node_modules|\.release|\.mimicus)\/|\.local\.md$|Pasted text|\.sqlite$/i.test(
          file,
        ),
      ),
      'Packed files must exclude developer harnesses, prompts, catalogs and caches',
    );
  }
  report.archive = {
    path: relative(root, archive).replaceAll('\\', '/'),
    sha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
  };
  checked([
    npmCli,
    'install',
    '--prefix',
    prefix,
    '--ignore-scripts',
    '--no-fund',
    '--no-audit',
    archive,
  ]);
  const installed = join(prefix, 'node_modules', ...expected.name.split('/'));
  const packageJson = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  const cli = join(installed, 'dist', 'cli.js');
  const runtimeHash = createHash('sha256');
  const runtimeFiles = [];
  const collectRuntime = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) collectRuntime(path);
      else if (entry.name.endsWith('.js')) runtimeFiles.push(path);
    }
  };
  collectRuntime(join(installed, 'dist'));
  for (const file of runtimeFiles.sort()) {
    runtimeHash.update(relative(installed, file).replaceAll('\\', '/'));
    runtimeHash.update('\0');
    runtimeHash.update(readFileSync(file));
    runtimeHash.update('\0');
  }
  report.installedRuntime = {
    javascriptFiles: runtimeFiles.length,
    javascriptSha256: runtimeHash.digest('hex'),
    entrySha256: createHash('sha256').update(readFileSync(cli)).digest('hex'),
    sourceKind: source === root ? 'Local working candidate' : 'Explicit source checkout',
  };
  assert.equal(packageJson.version, expected.version);
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.license, 'MIT');
  assert.match(packageJson.engines.node, />=24/);
  assert.ok(existsSync(join(prefix, 'node_modules', '.bin', 'mimicus.cmd')));
  assert.ok(!existsSync(join(installed, 'scripts')), 'Developer helpers must not enter package');
  assert.ok(!existsSync(join(installed, 'test')), 'Test harnesses must not enter package');
  const packagedMarkdown = [
    join(installed, 'README.md'),
    ...readdirSync(join(installed, 'docs'))
      .filter((file) => file.endsWith('.md'))
      .map((file) => join(installed, 'docs', file)),
  ];
  let relativeDocumentationLinks = 0;
  for (const file of packagedMarkdown) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split(/[?#]/)[0];
      if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      relativeDocumentationLinks += 1;
      assert.ok(
        existsSync(resolve(dirname(file), target)),
        `Missing packaged relative documentation target: ${relative(installed, file)} -> ${target}`,
      );
    }
  }
  report.checks.push({
    name: 'Actual archive installed into fresh consumer directory',
    passed: true,
    installedVersion: packageJson.version,
    bin: packageJson.bin,
    license: packageJson.license,
    engines: packageJson.engines,
    private: packageJson.private,
    developerScriptsPresent: false,
    packagedMarkdownFiles: packagedMarkdown.length,
    verifiedRelativeDocumentationLinks: relativeDocumentationLinks,
  });
  const version = checked([cli, '--version']).trim();
  assert.equal(version, expected.version);
  const shimVersion = checked([npmCli, 'exec', '--offline', '--', 'mimicus', '--version']).trim();
  assert.equal(shimVersion, expected.version);
  const help = checked([cli, '--help']);
  assert.match(help, /serve.*search/s);
  const doctor = JSON.parse(checked([cli, 'doctor']));
  assert.equal(doctor.browser.resolved, true);
  assert.equal(doctor.model.integrity.verified, false);
  assert.match(doctor.model.integrity.fallback, /Lexical/);
  report.checks.push({
    name: 'Installed CLI version, help and doctor',
    passed: true,
    version,
    npmGeneratedBinShimVersion: shimVersion,
    helpMentionsNoDownload: /No browser download/.test(help),
    browser: summarizeBrowser(doctor.browser),
    model: {
      state: doctor.model.state,
      integrityVerified: doctor.model.integrity.verified,
      fallback: doctor.model.integrity.fallback,
    },
  });
  const selfTest = JSON.parse(checked([cli, 'self-test']));
  assert.equal(selfTest.passed, true);
  report.checks.push({
    name: 'Installed actual default-browser self-test',
    passed: true,
    browser: summarizeBrowser(selfTest.browser),
    checks: selfTest.checks,
  });
  const invalid = command([cli, 'self-test'], prefix, {
    ...env,
    MIMICUS_BROWSER_EXECUTABLE: join(runRoot, 'does-not-exist-browser.exe'),
  });
  assert.notEqual(invalid.code, 0);
  assert.match(invalid.stderr, /exist|binary|executable|browser/i);
  report.checks.push({
    name: 'Explicit unavailable browser refuses without fallback',
    passed: true,
    exitCode: invalid.code,
    diagnosis: safeError(invalid.stderr),
  });
  const requireInstalled = createRequire(join(installed, 'package.json'));
  const { Client } = await import(
    pathToFileURL(requireInstalled.resolve('@modelcontextprotocol/client'))
  );
  const { StdioClientTransport } = await import(
    pathToFileURL(requireInstalled.resolve('@modelcontextprotocol/client/stdio'))
  );
  client = new Client({ name: 'packed-consumer-acceptance', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [cli, 'serve'],
      cwd: prefix,
      env,
      stderr: 'pipe',
    }),
  );
  const call = async (name, arguments_ = {}) => {
    const result = await client.callTool({ name, arguments: arguments_ }, { timeout: 90000 });
    if (result.isError) throw new Error(JSON.stringify(result.content));
    return result;
  };
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  assert.equal(tools.length, 17);
  assert.ok(tools.includes('mimicus_preview_references'));
  report.checks.push({
    name: 'Installed official SDK stdio handshake and tool discovery',
    passed: true,
    tools,
  });
  const search = (
    await call('mimicus_search', {
      providers: ['nuxt'],
      query: 'retail coffee',
      retrieval: 'hybrid',
      limit: 5,
    })
  ).structuredContent.data;
  assert.ok(search.results.length > 0);
  assert.ok(search.metadataHttpRequests > 0);
  report.checks.push({
    name: 'Fresh permitted actual Nuxt source query without model software',
    passed: true,
    results: search.results.length,
    metadataHttpRequests: search.metadataHttpRequests,
    retrieval: search.ranking ?? search.retrieval,
    sources: search.sources.map((s) => ({
      provider: s.provider,
      status: s.status,
      returnedRecords: s.returnedRecords,
    })),
  });
  const attempts = [];
  for (const reference of search.results.slice(0, 3)) {
    let sessionId;
    try {
      const opened = await call('mimicus_open_reference', {
        operationId: search.operationId,
        referenceId: reference.id,
        authorized: true,
      });
      sessionId = opened.structuredContent.data.sessionId;
      const frames = opened.content.filter((block) => block.type === 'image');
      assert.ok(frames.length > 0);
      attempts.push({
        url: opened.structuredContent.data.url,
        passed: true,
        imageBlocks: frames.length,
        jpegBytes: Buffer.from(frames[0].data, 'base64').length,
        jpegSha256: createHash('sha256')
          .update(Buffer.from(frames[0].data, 'base64'))
          .digest('hex'),
        browser: summarizeBrowser(opened.structuredContent.data.diagnostics?.browser),
        interpretation:
          'Actual selected original viewport captured; first-frame availability does not establish complete rendering or design quality',
      });
      break;
    } catch (error) {
      attempts.push({ referenceId: reference.id, passed: false, error: safeError(error) });
    } finally {
      if (sessionId) await call('mimicus_close_session', { sessionId });
    }
  }
  assert.ok(
    attempts.some((attempt) => attempt.passed),
    'No selected source original could be rendered',
  );
  report.checks.push({
    name: 'Installed selected original browsing and actual MCP JPEG',
    passed: true,
    attempts,
  });
  await call('mimicus_end_discovery', { operationId: search.operationId });
  const status = (await call('mimicus_list_sources')).structuredContent.data;
  report.finalResources = { browser: status.browser, federation: status.federation };
  assert.equal(status.browser.activeSessions, 0);
  assert.equal(status.browser.opening, 0);
  assert.equal(status.browser.closingSessions, 0);
  assert.equal(status.federation.activeOperations, 0);
  assert.equal(status.federation.retainedReferences, 0);
  assert.ok(
    !existsSync(env.MIMICUS_MODEL_CACHE_DIR) ||
      !existsSync(join(env.MIMICUS_MODEL_CACHE_DIR, 'onnx')),
  );
  report.status = 'VERIFIED';
} catch (error) {
  report.status = 'FAILED';
  report.error = safeError(error);
  process.exitCode = 1;
} finally {
  await client?.close();
  report.finishedAt = new Date().toISOString();
  const destination = reportDestination;
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      report: relative(root, destination).replaceAll('\\', '/'),
      error: report.error,
    }),
  );
}
