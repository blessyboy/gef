import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('homepage welcome dialog has accessible event copy and the expected actions', () => {
  assert.match(html, /<dialog class="welcome-dialog" id="welcome-dialog" aria-labelledby="welcome-title" aria-describedby="welcome-copy">/);
  assert.match(html, /Welcome to the Ghana Economic Forum 2026/);
  assert.match(html, /href="https:\/\/facebook\.com\/BFTGhana" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /href="programme\.html"/);
  assert.match(html, /data-welcome-close/);
  assert.match(html, /assets\/css\/welcome-modal\.css\?v=20261109/);
  assert.match(html, /assets\/js\/welcome-modal\.js\?v=20261109/);
});

test('welcome dialog copy retains the supplied welcome message', () => {
  for (const phrase of [
    'Distinguished Delegates,',
    'meaningful dialogue, strategic partnerships, and actionable solutions',
    'Participants joining remotely',
    'shaping Ghana&#39;s future.'
  ]) assert.ok(html.includes(phrase), `Missing welcome copy: ${phrase}`);
});
