/**
 * Faithful re-implementation of Excalidraw v0.17.3's text measurement
 * (`measureText` / `measureBaseline`), which the package does not re-export.
 *
 * We need it so that when we change a text element's font size or family via
 * the public `updateScene` API, we can recompute its width/height/baseline —
 * otherwise the stored bounding box keeps the old size and the glyphs spill
 * out of the box.
 */

// Excalidraw FONT_FAMILY ids and their default (unitless) line heights.
export const FONT_FAMILY = { Virgil: 1, Helvetica: 2, Cascadia: 3 } as const;

const FONT_NAME_BY_ID: Record<number, string> = {
  1: 'Virgil',
  2: 'Helvetica',
  3: 'Cascadia',
};

export const LINE_HEIGHTS: Record<number, number> = {
  1: 1.25, // Virgil
  2: 1.15, // Helvetica
  3: 1.2, // Cascadia
};

const WINDOWS_EMOJI_FALLBACK_FONT = 'Segoe UI Emoji';

export function getFontString(fontSize: number, fontFamily: number): string {
  const name = FONT_NAME_BY_ID[fontFamily] ?? 'Virgil';
  return `${fontSize}px ${name}, ${WINDOWS_EMOJI_FALLBACK_FONT}`;
}

let measureCanvas: HTMLCanvasElement | null = null;

function getTextWidth(text: string, font: string): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  let width = 0;
  for (const line of text.split('\n')) {
    width = Math.max(width, ctx.measureText(line).width);
  }
  return width;
}

// Mirrors Excalidraw's DOM-based baseline measurement exactly.
function measureBaseline(text: string, font: string, lineHeight: number): number {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.whiteSpace = 'pre';
  container.style.font = font;
  container.style.minHeight = '1em';
  container.style.lineHeight = String(lineHeight);
  container.innerText = text;
  document.body.appendChild(container);
  const span = document.createElement('span');
  span.style.display = 'inline-block';
  span.style.overflow = 'hidden';
  span.style.width = '1px';
  span.style.height = '1px';
  container.appendChild(span);
  const baseline = span.offsetTop + span.offsetHeight;
  document.body.removeChild(container);
  return baseline;
}

export interface TextMetrics {
  width: number;
  height: number;
  baseline: number;
}

export function measureText(
  rawText: string,
  fontSize: number,
  fontFamily: number,
  lineHeight: number
): TextMetrics {
  // Replace empty lines with a single space, matching Excalidraw, so leading /
  // trailing blank lines still contribute to the measured box.
  const text = rawText
    .split('\n')
    .map((line) => line || ' ')
    .join('\n');
  const font = getFontString(fontSize, fontFamily);
  const lineCount = text.split('\n').length;
  return {
    width: getTextWidth(text, font),
    height: fontSize * lineHeight * lineCount,
    baseline: measureBaseline(text, font, lineHeight),
  };
}
