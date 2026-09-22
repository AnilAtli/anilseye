import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globeResolutionScale, syncGlobeResolutionScale } from './viewer.js';

test('normal HD view keeps native render resolution', () => {
  assert.equal(globeResolutionScale(1920, 1080), 1);
  assert.equal(globeResolutionScale(0, 1080), 1);
});

test('4K view is limited to the globe pixel budget', () => {
  const scale = globeResolutionScale(3840, 2160);
  assert.ok(scale < 1);
  assert.ok(3840 * 2160 * scale * scale <= 3_600_001);
});

test('resolution updates only when the viewport requires it', () => {
  const viewer = { resolutionScale: 1 };
  syncGlobeResolutionScale(viewer, { innerWidth: 3840, innerHeight: 2160 });
  assert.ok(viewer.resolutionScale < 1);
  syncGlobeResolutionScale(viewer, { innerWidth: 1280, innerHeight: 720 });
  assert.equal(viewer.resolutionScale, 1);
});
