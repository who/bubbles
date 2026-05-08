import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  PIXEL_TOLERANCE,
  computeExpectedBubbles,
} from './helpers/expectedBubbles';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(
  here,
  '../../src/pnl/__fixtures__/canonical-april-2026.csv',
);

test('upload canonical CSV → bubbles render at PRD §7.2 positions', async ({ page }) => {
  await page.goto('/');

  // FileDropzone renders a hidden <input type=file> for browse-to-upload.
  await page.locator('input[type=file]').setInputFiles(FIXTURE_PATH);

  // Wait for the results state — the chart SVG mounts only after parse+compute.
  const circles = page.locator('.bubble-chart__svg circle');
  await expect(circles).toHaveCount(2);

  const expected = computeExpectedBubbles();
  expect(expected).toHaveLength(2);
  const [pltr, amd] = expected;
  if (!pltr || !amd) {
    throw new Error('expected fixture to yield 2 bubbles');
  }

  // AC5: PLTR (larger |pl|) precedes AMD per PRD §7.2 "largest-first render".
  expect(pltr.instrument).toBe('PLTR');
  expect(amd.instrument).toBe('AMD');
  const ids = await circles.evaluateAll((els) => els.map((e) => e.getAttribute('data-bubble-id') ?? ''));
  expect(ids[0]).toContain('PLTR');
  expect(ids[1]).toContain('AMD');

  // AC3 + AC4: assert geometry within ±1px and exact stroke/fill colors.
  for (let i = 0; i < expected.length; i += 1) {
    const e = expected[i];
    if (!e) continue;
    const attrs = await circles.nth(i).evaluate((el) => ({
      cx: parseFloat(el.getAttribute('cx') ?? ''),
      cy: parseFloat(el.getAttribute('cy') ?? ''),
      r: parseFloat(el.getAttribute('r') ?? ''),
      stroke: el.getAttribute('stroke'),
      fill: el.getAttribute('fill'),
    }));
    expect(Math.abs(attrs.cx - e.cx)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
    expect(Math.abs(attrs.cy - e.cy)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
    expect(Math.abs(attrs.r - e.r)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
    expect(attrs.stroke).toBe(e.stroke);
    expect(attrs.fill).toBe(e.fill);
  }
});
