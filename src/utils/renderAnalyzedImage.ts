import { STORAGE } from '@/config';
import { CATEGORY_LABEL, CATEGORY_STYLE } from '@/utils/format';
import { chooseStampPlacement, occlusionFraction } from '@/ai/postprocessing/stampPlacement';
import { formatAccuracy, formatStampCoords, formatStampTime } from '@/utils/geolocation';
import { decodeImage } from '@/ai/preprocessing/image';
import type { AnalyzedObject, BoundingBox, GeoStatus } from '@/types';

/**
 * Burn the analysis onto the photograph.
 *
 * The on-screen boxes and stamp are DOM overlays — they exist only in the page.
 * A report has to survive leaving the app, so this composites the same
 * information into actual pixels: numbered boxes in the bin colours, and the
 * location panel on whichever edge covers less of what was detected.
 *
 * This is the ONLY image the coordinates are drawn into. The copy sent to
 * Gemini for classification stays clean.
 */
export async function renderAnalyzedImage(
  source: Blob,
  objects: readonly AnalyzedObject[],
  location: GeoStatus,
): Promise<Blob> {
  const bitmap = await decodeImage(source);

  // Read the dimensions BEFORE closing the bitmap. A closed ImageBitmap reports
  // width/height 0, and dividing by that turned every box coordinate into
  // Infinity — the boxes silently vanished from the composited image while the
  // location stamp still rendered, so the output looked plausible.
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  const scale = Math.min(1, STORAGE.ANALYZED_MAX_EDGE / Math.max(srcW, srcH));
  const W = Math.round(srcW * scale);
  const H = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  ctx.drawImage(bitmap, 0, 0, W, H);
  bitmap.close?.();

  // Boxes are in source-image pixels; the canvas may be smaller.
  const k = srcW > 0 ? W / srcW : scale;
  const boxes = objects
    .map((o) => o.box)
    .filter((b): b is BoundingBox => b !== null)
    .map((b) => ({ x: b.x * k, y: b.y * k, width: b.width * k, height: b.height * k }));

  const unit = Math.max(2, Math.round(W * 0.004));
  const labelSize = Math.max(13, Math.round(W * 0.022));

  // Labels already placed, so overlapping boxes do not stack their tags on top
  // of each other. Nested boxes are common — a bag and its contents — and two
  // tags in the same spot renders both unreadable.
  const placed: BoundingBox[] = [];

  objects.forEach((o, i) => {
    if (!o.box) return;
    const b = { x: o.box.x * k, y: o.box.y * k, width: o.box.width * k, height: o.box.height * k };
    const colour = CATEGORY_STYLE[o.category].box;

    ctx.lineWidth = unit;
    ctx.strokeStyle = colour;
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    ctx.fillStyle = `${colour}22`;
    ctx.fillRect(b.x, b.y, b.width, b.height);

    // Number plus stream, so the image is readable without the app beside it.
    const text = `${i + 1}  ${CATEGORY_LABEL[o.category]}`;
    ctx.font = `700 ${labelSize}px 'Source Sans Pro', sans-serif`;
    const padX = labelSize * 0.45;
    const w = ctx.measureText(text).width + padX * 2;
    const h = labelSize * 1.6;
    // Flip the tag inside the box when it would sit off the top edge, then step
    // it down until it clears any tag already drawn.
    let ty = b.y - h < 0 ? b.y : b.y - h;
    const collides = (y: number) =>
      placed.some(
        (p) => !(b.x + w <= p.x || b.x >= p.x + p.width || y + h <= p.y || y >= p.y + p.height),
      );
    let guard = 0;
    while (collides(ty) && guard < 12) {
      ty += h;
      guard += 1;
    }
    // Never push a tag off the bottom of the image.
    if (ty + h > H) ty = Math.max(0, b.y);
    placed.push({ x: b.x, y: ty, width: w, height: h });

    ctx.fillStyle = colour;
    ctx.fillRect(b.x, ty, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, b.x + padX, ty + h / 2);
  });

  if (location.point) {
    drawStamp(ctx, W, H, boxes, location, labelSize);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      STORAGE.ANALYZED_QUALITY,
    );
  });
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  boxes: readonly BoundingBox[],
  location: GeoStatus,
  labelSize: number,
): void {
  const point = location.point;
  if (!point) return;

  const placement = chooseStampPlacement(boxes, W, H);
  const occluded = occlusionFraction(boxes, W, H, placement) > 0.15;

  const lines: { text: string; size: number; weight: number; mono: boolean }[] = [];
  if (location.place?.region) {
    lines.push({ text: location.place.region, size: labelSize, weight: 700, mono: false });
  }
  if (location.place?.detail && location.place.detail !== location.place.region) {
    lines.push({ text: location.place.detail, size: labelSize * 0.85, weight: 400, mono: false });
  }
  lines.push({ text: formatStampCoords(point), size: labelSize * 0.9, weight: 700, mono: true });
  lines.push({
    text: `${formatStampTime(point.timestamp)} · ${formatAccuracy(point)}`,
    size: labelSize * 0.8,
    weight: 400,
    mono: true,
  });

  const padding = labelSize * 0.7;
  const gap = labelSize * 0.28;
  const textHeight = lines.reduce((a, l) => a + l.size + gap, -gap);
  const panelH = textHeight + padding * 2;
  const panelY = placement === 'top' ? 0 : H - panelH;

  ctx.fillStyle = 'rgba(0,0,0,0.66)';
  ctx.fillRect(0, panelY, W, panelH);

  ctx.textBaseline = 'top';
  let y = panelY + padding;
  for (const line of lines) {
    ctx.font = `${line.weight} ${line.size}px ${
      line.mono ? "'SFMono-Regular', Menlo, monospace" : "'Source Sans Pro', sans-serif"
    }`;
    ctx.fillStyle = line.weight >= 700 ? '#ffffff' : 'rgba(255,255,255,0.88)';
    ctx.fillText(line.text, padding, y);
    y += line.size + gap;
  }

  if (occluded) {
    const warnH = labelSize * 1.5;
    const warnY = placement === 'top' ? panelH : panelY - warnH;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, warnY, W, warnH);
    ctx.fillStyle = '#000000';
    ctx.font = `700 ${labelSize * 0.72}px 'Source Sans Pro', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Stamp covers part of a detected item', padding, warnY + warnH / 2);
  }
}
