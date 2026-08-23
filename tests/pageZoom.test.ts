import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changePageZoom,
  clampPageZoom,
  PAGE_ZOOM_DEFAULT,
  PAGE_ZOOM_MAX,
  PAGE_ZOOM_MIN,
} from '../src/shared/pageZoom.js';

test('页面缩放限制在可用范围内', () => {
  assert.equal(clampPageZoom(Number.NaN), PAGE_ZOOM_DEFAULT);
  assert.equal(clampPageZoom(0.2), PAGE_ZOOM_MIN);
  assert.equal(clampPageZoom(3), PAGE_ZOOM_MAX);
});

test('页面缩放按固定步长放大和缩小', () => {
  assert.equal(changePageZoom(1, 1), 1.1);
  assert.equal(changePageZoom(1.1, -1), 1);
  assert.equal(changePageZoom(PAGE_ZOOM_MAX, 1), PAGE_ZOOM_MAX);
  assert.equal(changePageZoom(PAGE_ZOOM_MIN, -1), PAGE_ZOOM_MIN);
});
