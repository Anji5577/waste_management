/**
 * Accuracy harness.
 *
 * Runs the real pipeline — a live Gemini call per image, then the local rules
 * layer — over a folder of labelled photographs, and prints a confusion matrix
 * with per-class precision, recall and F1.
 *
 * This exists because the repository ships NO accuracy claim of its own. A
 * general-purpose model's self-reported confidence tells you nothing about how
 * often it is right; the only way to know is to measure it on your own images.
 *
 * NOTE: this spends money. One API call per image, billed to the key in .env.
 *
 * Usage:
 *   npm run eval -- <folder>
 *
 * Layout — one subfolder per expected stream:
 *   my-images/WET/*.jpg
 *   my-images/DRY/*.jpg
 *   my-images/HAZARDOUS/*.jpg
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { analyzeImage } from '@/ai/gemini/client';
import { classifyObject } from '@/ai/wasteRules';
import { DETECTION } from '@/config';
import type { WasteCategory } from '@/types';

const STREAMS = ['WET', 'DRY', 'HAZARDOUS'] as const;
type Stream = (typeof STREAMS)[number];

const root = process.argv[2];
if (!root) {
  console.error('usage: npm run eval -- <folder-with-WET-DRY-HAZARDOUS-subfolders>');
  process.exit(1);
}

const apiKey = process.env.VITE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Set VITE_GEMINI_API_KEY (or GEMINI_API_KEY) before running the eval.');
  process.exit(1);
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

interface Row {
  file: string;
  truth: Stream;
  predicted: WasteCategory;
  detail: string;
}

const rows: Row[] = [];

for (const truth of STREAMS) {
  const dir = join(root, truth);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => MIME[extname(f).toLowerCase()] !== undefined);
  } catch {
    console.warn(`(no ${truth}/ folder — skipping)`);
    continue;
  }

  for (const file of files) {
    const path = join(dir, file);
    if (!statSync(path).isFile()) continue;

    const mime = MIME[extname(file).toLowerCase()];
    const base64 = readFileSync(path).toString('base64');

    let predicted: WasteCategory = 'UNCERTAIN';
    let detail = '';
    try {
      const result = await analyzeImage(base64, mime, apiKey);
      const items = result.items
        .filter((i) => i.confidence >= DETECTION.MIN_ITEM_CONFIDENCE)
        .map((i, idx) =>
          classifyObject({
            id: `i${idx}`,
            itemName: i.name,
            material: i.material,
            confidence: i.confidence,
            soiled: i.soiled,
            box: null,
            wideScene: result.scene === 'pile-or-scene',
          }),
        );

      // Score the strongest committed verdict in the frame. A photo whose items
      // disagree is genuinely mixed, and is counted as UNCERTAIN rather than
      // being quietly resolved in whichever direction flatters the numbers.
      const decided = [...new Set(items.map((o) => o.category))].filter((c) => c !== 'UNCERTAIN');
      predicted = decided.length === 1 ? decided[0] : 'UNCERTAIN';
      detail = items.map((o) => `${o.itemName}:${o.material}@${o.confidence.toFixed(2)}`).join(', ');
    } catch (error) {
      detail = `ERROR ${error instanceof Error ? error.message : String(error)}`;
    }

    rows.push({ file, truth, predicted, detail });
    const mark = predicted === truth ? '✓' : predicted === 'UNCERTAIN' ? '?' : '✗';
    console.log(`${mark} ${truth}/${file} → ${predicted}  [${detail}]`);
  }
}

if (rows.length === 0) {
  console.error('No images found.');
  process.exit(1);
}

const labels: WasteCategory[] = [...STREAMS, 'UNCERTAIN'];
console.log('\nConfusion matrix (rows = truth, columns = predicted)\n');
console.log(['truth'.padEnd(11), ...labels.map((l) => l.padStart(11))].join(''));
for (const truth of STREAMS) {
  const cells = labels.map((p) =>
    String(rows.filter((r) => r.truth === truth && r.predicted === p).length).padStart(11),
  );
  console.log([truth.padEnd(11), ...cells].join(''));
}

console.log('\nPer-class metrics\n');
console.log(
  ['class'.padEnd(12), 'precision'.padStart(10), 'recall'.padStart(10), 'F1'.padStart(10), 'n'.padStart(6)].join(''),
);
for (const s of STREAMS) {
  const tp = rows.filter((r) => r.truth === s && r.predicted === s).length;
  const fp = rows.filter((r) => r.truth !== s && r.predicted === s).length;
  const fn = rows.filter((r) => r.truth === s && r.predicted !== s).length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  console.log(
    [
      s.padEnd(12),
      precision.toFixed(3).padStart(10),
      recall.toFixed(3).padStart(10),
      f1.toFixed(3).padStart(10),
      String(rows.filter((r) => r.truth === s).length).padStart(6),
    ].join(''),
  );
}

const decided = rows.filter((r) => r.predicted !== 'UNCERTAIN');
const correct = decided.filter((r) => r.predicted === r.truth).length;
console.log(
  `\nimages           ${rows.length}` +
    `\nabstained        ${rows.length - decided.length}  (reported UNCERTAIN)` +
    `\ndecided          ${decided.length}` +
    `\n  correct        ${correct}` +
    `\n  WRONG          ${decided.length - correct}   <- the number that matters: a confident misfile` +
    `\naccuracy|decided ${decided.length ? (correct / decided.length).toFixed(3) : 'n/a'}` +
    `\ncoverage         ${(decided.length / rows.length).toFixed(3)}`,
);
console.log(
  '\nNote: "accuracy|decided" ignores abstentions, so it is not comparable to a\n' +
    'headline accuracy figure. Read it together with coverage — a system that\n' +
    'abstains on everything would score 1.000 here and be useless.',
);
