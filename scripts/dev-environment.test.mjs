import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolveConfig } from 'vite';

test('default development selects the isolated emulator project', async () => {
  const config = await resolveConfig({}, 'serve', 'development');
  const alias = config.resolve.alias.find(item => item.find === '@firebase-config');
  assert.ok(alias);
  const firebase = JSON.parse(await readFile(alias.replacement, 'utf8'));
  assert.equal(firebase.projectId, 'demo-avalon-manager');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.dev, pkg.scripts['design-lab']);
  assert.match(pkg.scripts['dev:prod'], /--mode production/);
});

test('local-only modes cannot create deployable bundles', async () => {
  for (const mode of ['development', 'demo', 'scenario']) {
    await assert.rejects(resolveConfig({ mode }, 'build'), /local-only/);
  }
});

test('production and staging keep distinct deployment projects', async () => {
  const projects = [];
  for (const mode of ['production', 'staging']) {
    const config = await resolveConfig({ mode }, 'build');
    const alias = config.resolve.alias.find(item => item.find === '@firebase-config');
    projects.push(JSON.parse(await readFile(alias.replacement, 'utf8')).projectId);
  }
  assert.deepEqual(projects, ['gen-lang-client-0205444206', 'avalon-manager-staging']);
});
