import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve('.');
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
test('Shipped runtime has no SQLite, persistent catalog, vector store or retired command implementation', () => {
  for (const name of ['storage', 'engine', 'catalog', 'corpus', 'doctor', 'access', 'search'])
    assert.equal(
      existsSync(join(root, 'dist', name + '.js')),
      false,
      name + ' stale compiled implementation',
    );
  for (const path of files(join(root, 'src'))) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      source,
      /node:sqlite|DatabaseSync|CREATE TABLE|writeFile(?:Sync)?\s*\(|\.sqlite['"`]/,
      path,
    );
  }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
  assert.ok(!pkg.files.includes('data'));
  assert.equal(existsSync(join(root, 'data', 'seeds.json')), false);
  assert.equal(existsSync(join(root, 'data', 'corpus', 'manifest.json')), false);
});
