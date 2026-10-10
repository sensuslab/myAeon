import test from 'node:test';
import assert from 'node:assert/strict';
import { rejectUnusedFrameworkEndpoint } from '../server/http-guard.mjs';

test('unused image optimization and Server Actions are not exposed', () => {
  for (const url of ['/_next/image?url=%2Ficon.png&w=640&q=75', '/_next/image/', '/%5Fnext/image']) {
    let status, body;
    const response = { writeHead: value => { status = value; }, end: value => { body = value; } };
    assert.equal(rejectUnusedFrameworkEndpoint({ url, headers: {} }, response), true);
    assert.equal(status, 404); assert.equal(body, 'Not found');
  }
  const response = { writeHead() {}, end() {} };
  assert.equal(rejectUnusedFrameworkEndpoint({ url: '/', headers: { 'next-action': 'untrusted' } }, response), true);
  for (const url of ['/', '/privacy', '/api/reading', '/_next/static/asset.js', '/icons/icon.png']) {
    assert.equal(rejectUnusedFrameworkEndpoint({ url, headers: {} }, response), false);
  }
});
