import { jsPDF } from 'jspdf';
import type { StoredReport } from '@/services/reports';

/**
 * A4 report as a real PDF.
 *
 * Text is drawn as text, not rasterised: the verdict, the item table and the
 * coordinates stay selectable and searchable, which matters if the report is
 * filed with a municipality. That rules out the html2canvas approach, which
 * would flatten the whole page into one image.
 */

const PAGE = { w: 210, h: 297 };
const M = 14; // margin
const CONTENT = PAGE.w - M * 2;

const INDIGO = '#28256b';
const GREEN = '#008639';
const INK = '#1f2130';
const MUTED = '#4d5163';
const LINE = '#d8dbe2';

const STREAM: Record<string, string> = {
  WET: '#047857',
  DRY: '#0369a1',
  HAZARDOUS: '#b91c1c',
  UNCERTAIN: '#b45309',
};

export interface Embedded {
  dataUrl: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
}

/**
 * How an image URL becomes embeddable bytes.
 *
 * Injectable so the PDF can be built outside a browser — the default
 * implementation needs `FileReader` and `Image`, neither of which exists in
 * Node, and a report generator that can only be exercised by hand is one that
 * never gets checked.
 */
export type ImageLoader = (url: string) => Promise<Embedded | null>;

/**
 * Fetch a hosted image and turn it into something jsPDF can embed.
 *
 * Returns null rather than throwing: a report missing one photograph is still
 * a useful report, and a host hiccup should not cost the whole download.
 */
export const browserImageLoader: ImageLoader = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('read failed'));
      reader.readAsDataURL(blob);
    });

    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('decode failed'));
      img.src = dataUrl;
    });

    return {
      dataUrl,
      ...size,
      format: blob.type.includes('png') ? 'PNG' : 'JPEG',
    };
  } catch {
    return null;
  }
};

export async function buildReportPdf(
  report: StoredReport,
  loadImage: ImageLoader = browserImageLoader,
): Promise<Blob> {
  const load = (url: string | null) => (url ? loadImage(url) : Promise.resolve(null));
  const [original, analyzed] = await Promise.all([
    load(report.original_url),
    load(report.analyzed_url),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = 0;

  // --- Header band ---------------------------------------------------------
  doc.setFillColor(INDIGO);
  doc.rect(0, 0, PAGE.w, 26, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold').setFontSize(17);
  doc.text('Waste segregation report', M, 12);
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  doc.text(`Reference ${report.id}`, M, 18.5);
  y = 34;

  // --- Verdict -------------------------------------------------------------
  const streams = Object.entries(report.tally).filter(([, n]) => n > 0);
  const only = streams.length === 1 ? streams[0]![0] : null;
  doc.setFillColor(only ? (STREAM[only] ?? INDIGO) : INDIGO);
  doc.setFontSize(10);
  const verdictLines = wrap(doc, report.summary_action ?? '', CONTENT - 8);
  const verdictH = 12 + verdictLines.length * 4.4;
  doc.rect(M, y, CONTENT, verdictH, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold').setFontSize(14);
  doc.text(report.summary_headline, M + 4, y + 8);
  if (verdictLines.length) {
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(verdictLines, M + 4, y + 14);
  }
  y += verdictH + 8;

  // --- Photographs, side by side ------------------------------------------
  y = section(doc, 'Photographs', y);
  const gap = 6;
  const cellW = analyzed ? (CONTENT - gap) / 2 : CONTENT * 0.62;
  const maxH = 72;

  const drawPhoto = (img: Embedded | null, x: number, caption: string) => {
    if (!img) return;
    const ratio = img.height / img.width;
    const w = Math.min(cellW, maxH / ratio);
    const h = w * ratio;
    doc.addImage(img.dataUrl, img.format, x, y, w, h, undefined, 'FAST');
    doc.setDrawColor(LINE).setLineWidth(0.2).rect(x, y, w, h);
    doc.setTextColor(MUTED).setFont('helvetica', 'normal').setFontSize(8);
    doc.text(caption, x, y + h + 4);
  };

  drawPhoto(original, M, 'Original — as captured');
  drawPhoto(analyzed, M + cellW + gap, 'Analysed — detected items and location');

  const tallest = Math.max(
    original ? Math.min(maxH, cellW * (original.height / original.width)) : 0,
    analyzed ? Math.min(maxH, cellW * (analyzed.height / analyzed.width)) : 0,
  );
  if (!original && !analyzed) {
    doc.setTextColor(MUTED).setFontSize(9).text('Images unavailable.', M, y + 4);
    y += 10;
  } else {
    y += tallest + 10;
  }

  // --- Items ---------------------------------------------------------------
  y = section(doc, 'Items identified', y);
  if (report.items.length === 0) {
    doc.setTextColor(MUTED).setFont('helvetica', 'normal').setFontSize(9.5);
    doc.text('No individual items were identified.', M, y + 1);
    y += 8;
  } else {
    const cols = [M, M + 62, M + 104, M + 150];
    doc.setTextColor(MUTED).setFont('helvetica', 'bold').setFontSize(7.5);
    doc.text('ITEM', cols[0]!, y);
    doc.text('MATERIAL', cols[1]!, y);
    doc.text('STREAM', cols[2]!, y);
    doc.text('CONFIDENCE', cols[3]!, y);
    y += 2;
    doc.setDrawColor(LINE).setLineWidth(0.2).line(M, y, M + CONTENT, y);
    y += 4.5;

    for (const item of report.items) {
      // Break before a row would run off the page, rather than clipping it.
      if (y > PAGE.h - 46) {
        doc.addPage();
        y = M + 6;
      }
      doc.setTextColor(INK).setFont('helvetica', 'normal').setFontSize(9.5);
      doc.text(clip(doc, item.name, 58), cols[0]!, y);
      doc.text(clip(doc, item.material, 38), cols[1]!, y);

      doc.setFillColor(STREAM[item.category] ?? MUTED);
      const label = item.category;
      const w = doc.getTextWidth(label) + 4;
      doc.rect(cols[2]!, y - 3.4, w, 5, 'F');
      doc.setTextColor('#ffffff').setFont('helvetica', 'bold').setFontSize(7.5);
      doc.text(label, cols[2]! + 2, y);

      doc.setTextColor(INK).setFont('helvetica', 'normal').setFontSize(9.5);
      doc.text(`${Math.round(item.confidence * 100)}%`, cols[3]!, y);

      y += 4;
      doc.setDrawColor(LINE).line(M, y, M + CONTENT, y);
      y += 4.5;
    }
    y += 2;
  }

  // --- Location and time ---------------------------------------------------
  if (y > PAGE.h - 60) {
    doc.addPage();
    y = M + 6;
  }
  y = section(doc, 'Location and time', y);

  const coords =
    report.latitude !== null && report.longitude !== null
      ? `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}` +
        (report.accuracy_m ? `  (±${Math.round(report.accuracy_m)} m)` : '')
      : 'Not recorded';

  const rows: [string, string][] = [];
  if (report.place_region) rows.push(['Place', report.place_region]);
  if (report.place_detail) rows.push(['Address', report.place_detail]);
  rows.push(['Coordinates', coords]);
  if (report.taken_at) rows.push(['Photographed', new Date(report.taken_at).toLocaleString()]);
  rows.push(['Reported', new Date(report.created_at).toLocaleString()]);

  for (const [label, value] of rows) {
    doc.setTextColor(MUTED).setFont('helvetica', 'normal').setFontSize(9);
    doc.text(label, M, y);
    doc.setTextColor(INK);
    doc.text(clip(doc, value, CONTENT - 34), M + 32, y);
    y += 5.4;
  }

  // --- Footer, on every page ----------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(LINE).setLineWidth(0.2).line(M, PAGE.h - 20, PAGE.w - M, PAGE.h - 20);
    doc.setTextColor(MUTED).setFont('helvetica', 'normal').setFontSize(7);
    doc.text(`${p} / ${pages}`, PAGE.w - M, PAGE.h - 15, { align: 'right' });
  }

  return doc.output('blob');
}

/**
 * Wrap text to a width.
 *
 * jsPDF types `splitTextToSize` as returning `any`; the single cast is
 * contained here so the rest of the file stays typed.
 */
function wrap(doc: jsPDF, text: string, width: number): string[] {
  return doc.splitTextToSize(text, width) as string[];
}

function section(doc: jsPDF, title: string, y: number): number {
  doc.setTextColor(GREEN).setFont('helvetica', 'bold').setFontSize(8);
  doc.text(title.toUpperCase(), M, y);
  return y + 5;
}

/** Trim to fit rather than letting jsPDF run text off the page. */
function clip(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

export async function downloadReport(report: StoredReport): Promise<void> {
  const blob = await buildReportPdf(report);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date(report.created_at).toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `waste-report-${stamp}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
