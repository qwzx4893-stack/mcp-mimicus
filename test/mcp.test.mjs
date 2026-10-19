import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { cleanup, fixture, temporary } from './helpers.mjs';

test('Real stdio SDK client discovers live owned references, receives MCP images, explores, analyzes and shuts down without catalog files', {
  timeout: 120000,
}, async () => {
  const f = await fixture(),
    dir = temporary(),
    client = new Client({ name: 'corrected-product-acceptance', version: '1.0.0' });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve('test/sdk-server.mjs')],
        cwd: dir,
        env: {
          ...process.env,
          TMP: dir,
          TEMP: dir,
          TMPDIR: dir,
          MIMICUS_TEST_ORIGIN: f.origin,
          MIMICUS_DATA_DIR: dir,
        },
        stderr: 'pipe',
      }),
    );
    const list = (await client.listTools()).tools.map((t) => t.name);
    assert.ok(list.includes('mimicus_capture_view'));
    for (const removed of [
      'mimicus_refresh_index',
      'mimicus_get_index_status',
      'mimicus_search_patterns',
    ])
      assert.equal(list.includes(removed), false);
    const call = async (name, args = {}) => {
      const r = await client.callTool({ name, arguments: args }, { timeout: 90000 });
      assert.notEqual(r.isError, true, JSON.stringify(r));
      return {
        data: r.structuredContent.data,
        images: r.content.filter((c) => c.type === 'image'),
      };
    };
    const first = (
      await call('mimicus_search', {
        query: 'editorial',
        providers: ['nuxt'],
        retrieval: 'lexical',
      })
    ).data;
    assert.equal(first.results.length, 1);
    f.advance();
    const second = (
      await call('mimicus_search', {
        query: 'editorial',
        providers: ['nuxt'],
        retrieval: 'lexical',
      })
    ).data;
    assert.match(second.results[0].title, /revision 2/);
    const finished = (await call('mimicus_search', { operationId: second.operationId })).data;
    assert.equal(finished.freshIndependentOperation, false);
    assert.equal(finished.results.length, 0);
    assert.equal(f.hits.filter((h) => h === '/source').length, 2);
    const ref = (
      await call('mimicus_get_reference', {
        operationId: second.operationId,
        referenceId: second.results[0].id,
      })
    ).data;
    assert.equal(ref.relationships[0].native.tags[0], 'GSAP');
    const opened = await call('mimicus_open_reference', {
      operationId: second.operationId,
      referenceId: ref.id,
      authorized: true,
    });
    assert.equal(opened.images.length, 1);
    assert.equal(opened.images[0].mimeType, 'image/jpeg');
    assert.ok(Buffer.from(opened.images[0].data, 'base64').length > 5000);
    const sessionId = opened.data.sessionId;
    const sections = (await call('mimicus_explore_page', { sessionId })).data;
    assert.ok(sections.regions.some((r) => r.selector === '#menu'));
    const clicked = await call('mimicus_interact', {
      sessionId,
      interaction: { action: 'click', selector: '#menu' },
    });
    assert.equal(clicked.images.length, 1);
    assert.equal(
      (await call('mimicus_explore_page', { sessionId })).data.regions.find(
        (r) => r.selector === '#menu',
      ).expanded,
      'true',
    );
    await call('mimicus_interact', { sessionId, interaction: { action: 'key', key: 'Escape' } });
    const motion = await call('mimicus_capture_motion', {
      sessionId,
      selector: 'svg',
      frames: 3,
      intervalMs: 120,
    });
    assert.equal(motion.images.length, 3);
    const analysis = (
      await call('mimicus_analyze_element', { sessionId, selector: '#reveal', trigger: 'hover' })
    ).data;
    assert.ok(analysis.components.length);
    const spec = (
      await call('mimicus_get_implementation_spec', { sessionId, analysisId: analysis.analysisId })
    ).data;
    assert.equal(spec.retention, 'Temporary session evidence only');
    assert.ok(spec.measured.sequences.length);
    const insights = await call('mimicus_get_design_insights', { sessionId });
    assert.equal(insights.images.length, 1);
    const categories = (
      await call('mimicus_browse_categories', { operationId: second.operationId })
    ).data;
    assert.ok(categories.sources.some((s) => s.nativeLabels.includes('GSAP')));
    assert.equal(
      (await call('mimicus_capture_view', { sessionId, selector: '#reveal' })).images.length,
      1,
    );
    const target = (
      await call('mimicus_open_reference', { url: f.origin + '/implementation', authorized: true })
    ).data;
    const comparison = await call('mimicus_compare_references', {
      sessionIds: [sessionId, target.sessionId],
      brief: {
        project: 'Owned editorial journal',
        audience: 'Readers',
        primaryAction: 'Read a story',
        sections: ['Hero', 'Stories'],
        motion: 'subtle',
      },
    });
    assert.equal(comparison.images.length, 2);
    assert.equal(comparison.data.references.length, 2);
    assert.equal(comparison.data.designBrief.observedReferences.length, 2);
    const verified = (
      await call('mimicus_verify_implementation', {
        referenceSessionId: sessionId,
        analysisId: analysis.analysisId,
        targetSessionId: target.sessionId,
        selector: '#reveal',
      })
    ).data;
    assert.equal(verified.withinMeasuredTolerances, true);
    const duplicate = await client.callTool({
      name: 'mimicus_compare_references',
      arguments: { sessionIds: [sessionId, sessionId] },
    });
    assert.equal(duplicate.isError, true);
    await call('mimicus_close_session', { sessionId: target.sessionId });
    await call('mimicus_close_session', { sessionId });
    await call('mimicus_end_discovery', { operationId: first.operationId });
    await call('mimicus_end_discovery', { operationId: second.operationId });
    const status = (await call('mimicus_list_sources')).data;
    assert.equal(status.browser.activeSessions, 0);
    assert.equal(status.federation.retainedReferences, 0);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    await client.close();
    assert.deepEqual(
      readdirSync(dir),
      [],
      'No SQLite, JSON snapshot, vector store or browser content survives normal shutdown',
    );
    await f.close();
    cleanup(dir);
  }
});
