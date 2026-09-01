// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { StoredReport } from '@/services/reports';
import { buildReportPdf, type Embedded } from './reportPdf';

const report: StoredReport = {
  id: 'abc-123',
  created_at: '2026-09-01T09:00:00.000Z',
  device_id: 'dev-1',
  original_url: 'https://i.ibb.co/x/original.jpg',
  analyzed_url: 'https://i.ibb.co/y/analyzed.jpg',
  delete_url: 'https://ibb.co/y/hash',
  summary_headline: 'Mixed waste',
  summary_action: 'Separate the items before disposal.',
  tally: { WET: 1, DRY: 2, HAZARDOUS: 0, UNCERTAIN: 0 },
  items: [
    { name: 'banana peel', material: 'biological', category: 'WET', confidence: 0.94 },
    { name: 'PET bottle', material: 'plastic', category: 'DRY', confidence: 0.88 },
  ],
  scene: 'few-items',
  model: 'gemini-3.5-flash',
  latitude: 16.353146,
  longitude: 81.046527,
  accuracy_m: 11,
  place_region: 'Gudlavalleru, Andhra Pradesh, India',
  place_detail: 'Gudlavalleru, Krishna district, 521356',
  taken_at: '2026-09-01T08:55:00.000Z',
};

/** A 1x1 JPEG, enough for jsPDF to embed. */
const PIXEL: Embedded = {
  dataUrl:
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  width: 1,
  height: 1,
  format: 'JPEG',
};

const loader = vi.fn(() => Promise.resolve(PIXEL));

async function text(blob: Blob): Promise<string> {
  // jsPDF is not compressing text streams here, so the page content is
  // readable in the raw bytes — enough to assert what was drawn.
  return Buffer.from(await blob.arrayBuffer()).toString('latin1');
}

describe('buildReportPdf — removed content', () => {
  it('carries no disclaimer or attribution footer', async () => {
    // Removed at the owner's request. Asserted so it cannot creep back in.
    const raw = await text(await buildReportPdf(report, loader));
    expect(raw).not.toMatch(/decision aid/i);
    expect(raw).not.toMatch(/not one trained on waste/i);
    expect(raw).not.toMatch(/OpenStreetMap/i);
  });
});

describe('buildReportPdf', () => {
  it('produces a real PDF', async () => {
    const blob = await buildReportPdf(report, loader);
    expect(blob.type).toBe('application/pdf');
    const head = (await text(blob)).slice(0, 5);
    expect(head).toBe('%PDF-');
  });

  it('embeds both photographs', async () => {
    const calls: string[] = [];
    await buildReportPdf(report, (url) => {
      calls.push(url);
      return Promise.resolve(PIXEL);
    });
    expect(calls).toEqual([report.original_url, report.analyzed_url]);
  });

  it('still builds when an image cannot be fetched', async () => {
    // A host hiccup must not cost the whole download.
    const blob = await buildReportPdf(report, () => Promise.resolve(null));
    expect(blob.size).toBeGreaterThan(0);
  });

  it('still builds when there is no analysed image at all', async () => {
    const blob = await buildReportPdf({ ...report, analyzed_url: null }, loader);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('does not request an image for a null url', async () => {
    const seen: string[] = [];
    await buildReportPdf({ ...report, analyzed_url: null }, (url) => {
      seen.push(url);
      return Promise.resolve(PIXEL);
    });
    expect(seen).toEqual([report.original_url]);
  });

  it('handles a report with no items', async () => {
    const blob = await buildReportPdf({ ...report, items: [] }, loader);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles a report with no location', async () => {
    const blob = await buildReportPdf(
      {
        ...report,
        latitude: null,
        longitude: null,
        accuracy_m: null,
        place_region: null,
        place_detail: null,
        taken_at: null,
      },
      loader,
    );
    expect(blob.size).toBeGreaterThan(0);
  });

  it('paginates rather than clipping a long item list', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      name: `item number ${i} with a deliberately long name`,
      material: 'plastic',
      category: 'DRY',
      confidence: 0.8,
    }));
    const blob = await buildReportPdf({ ...report, items: many }, loader);
    const raw = await text(blob);
    // More than one page object means the table broke across pages.
    const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
  });
});
