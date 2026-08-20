import {
  MousePointer2,
  Pencil,
  Square,
  Diamond,
  Circle,
  MoveUpRight,
  Minus,
  Type,
  Eraser,
  Image as ImageIcon,
  PenTool,
  Code,
  Download,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Snapshot of the currently-relevant Excalidraw state, computed by
 * NotebookEditor from the editor's onChange. Drives what the rail shows.
 */
export interface ControlsSnapshot {
  activeTool: string;
  selectedCount: number;
  hasText: boolean;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  strokeStyle: string;
  fillStyle: string;
  opacity: number;
  fontSize: number;
  fontFamily: number;
}

interface EditorControlsProps {
  snapshot: ControlsSnapshot;
  currentPageNumber: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSetTool: (tool: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetBackground: (color: string) => void;
  onSetStrokeWidth: (width: number) => void;
  onSetStrokeStyle: (style: string) => void;
  onSetFillStyle: (style: string) => void;
  onSetOpacity: (opacity: number) => void;
  onSetFontSize: (size: number) => void;
  onSetFontFamily: (family: number) => void;
  onDownload: () => void;
}

type Tool = { type: string; label: string; Icon: ComponentType<{ className?: string }> };

// Tools laid out to mirror a physical numpad: each tool sits in the cell of its
// Excalidraw number shortcut, so the 3×3 grid reads
//   7 Draw   8 Text   9 Image
//   4 Ellipse 5 Arrow 6 Line
//   1 Select 2 Rect   3 Diamond
// and the eraser (shortcut 0) gets its own row below, like the numpad's 0 key.
const GRID_TOOLS: Tool[] = [
  { type: 'freedraw', label: 'Draw (P / 7)', Icon: Pencil },
  { type: 'text', label: 'Text (T / 8)', Icon: Type },
  { type: 'image', label: 'Insert image (9)', Icon: ImageIcon },
  { type: 'ellipse', label: 'Ellipse (O / 4)', Icon: Circle },
  { type: 'arrow', label: 'Arrow (A / 5)', Icon: MoveUpRight },
  { type: 'line', label: 'Line (L / 6)', Icon: Minus },
  { type: 'selection', label: 'Select (V / 1)', Icon: MousePointer2 },
  { type: 'rectangle', label: 'Rectangle (R / 2)', Icon: Square },
  { type: 'diamond', label: 'Diamond (D / 3)', Icon: Diamond },
];
const ERASER_TOOL: Tool = { type: 'eraser', label: 'Eraser (E / 0)', Icon: Eraser };

// Excalidraw's default palettes so the swatches feel native.
const STROKE_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
const BACKGROUND_COLORS = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];

// A short horizontal stroke rendered at the given weight — the icon for each
// stroke-width option (thin / bold / extra bold).
function StrokeWidthIcon({ weight }: { weight: number }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
      <line x1="3" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" />
    </svg>
  );
}
const STROKE_WIDTHS = [
  { value: 1, label: 'Thin', weight: 1.5 },
  { value: 2, label: 'Bold', weight: 3 },
  { value: 4, label: 'Extra bold', weight: 5 },
];

// A horizontal line drawn solid / dashed / dotted — the icon for each
// stroke-style option.
function StrokeStyleIcon({ dash }: { dash?: string }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
      <line
        x1="3"
        y1="8"
        x2="19"
        y2="8"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}
const STROKE_STYLES = [
  { value: 'solid', label: 'Solid', dash: undefined as string | undefined },
  { value: 'dashed', label: 'Dashed', dash: '5 3' },
  { value: 'dotted', label: 'Dotted', dash: '0.1 4' },
];

// A small square filled hachure / cross-hatch / solid — the icon for each
// fill-style option.
function FillStyleIcon({ variant }: { variant: 'hachure' | 'cross-hatch' | 'solid' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect x="2.5" y="2.5" width="13" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      {variant === 'solid' ? (
        <rect x="4.5" y="4.5" width="9" height="9" rx="1" fill="currentColor" />
      ) : (
        <g stroke="currentColor" strokeWidth="1">
          <line x1="4" y1="10" x2="10" y2="4" />
          <line x1="4" y1="14" x2="14" y2="4" />
          <line x1="8" y1="14" x2="14" y2="8" />
          {variant === 'cross-hatch' && (
            <>
              <line x1="4" y1="8" x2="10" y2="14" />
              <line x1="4" y1="4" x2="14" y2="14" />
              <line x1="8" y1="4" x2="14" y2="10" />
            </>
          )}
        </g>
      )}
    </svg>
  );
}
const FILL_STYLES = [
  { value: 'hachure', label: 'Hachure' },
  { value: 'cross-hatch', label: 'Cross-hatch' },
  { value: 'solid', label: 'Solid' },
] as const;

const FONT_SIZES = [
  { value: 16, label: 'S' },
  { value: 20, label: 'M' },
  { value: 28, label: 'L' },
  { value: 36, label: 'XL' },
];
// Excalidraw FONT_FAMILY ids: Virgil=1 (hand-drawn), Helvetica=2, Cascadia=3.
const FONT_FAMILIES: { value: number; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: 1, label: 'Hand-drawn', Icon: PenTool },
  { value: 2, label: 'Normal', Icon: Type },
  { value: 3, label: 'Code', Icon: Code },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function Swatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const isTransparent = color === 'transparent';
  return (
    <button
      onClick={onClick}
      title={isTransparent ? 'Transparent' : color}
      className={`w-6 h-6 rounded-md border transition ${
        active ? 'ring-2 ring-indigo-500 ring-offset-1' : 'border-gray-300'
      }`}
      style={
        isTransparent
          ? {
              backgroundImage:
                'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            }
          : { backgroundColor: color }
      }
    />
  );
}

function PillButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex-1 flex items-center justify-center h-9 px-2 text-xs rounded-md border transition ${
        active
          ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-medium'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

export function EditorControls({
  snapshot,
  currentPageNumber,
  totalPages,
  onPrevPage,
  onNextPage,
  onSetTool,
  onSetStrokeColor,
  onSetBackground,
  onSetStrokeWidth,
  onSetStrokeStyle,
  onSetFillStyle,
  onSetOpacity,
  onSetFontSize,
  onSetFontFamily,
  onDownload,
}: EditorControlsProps) {
  // Text elements only carry color/opacity + font props — stroke width,
  // stroke style, background and fill don't apply to them, so swap the whole
  // property set based on context.
  const isText = snapshot.hasText;
  const hasBackground = snapshot.backgroundColor !== 'transparent';

  const renderToolButton = ({ type, label, Icon }: Tool) => (
    <button
      key={type}
      onClick={() => onSetTool(type)}
      title={label}
      className={`flex items-center justify-center h-9 rounded-md border transition ${
        snapshot.activeTool === type
          ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="w-56 min-w-[14rem] flex flex-col bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        {/* Page navigation: current page number + up/down between pages, above
            the tools. */}
        <div className="flex items-center justify-center gap-4 mb-4 pb-3 border-b border-gray-200">
          <button
            onClick={onPrevPage}
            disabled={currentPageNumber <= 1}
            title="Previous page"
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-gray-700 tabular-nums select-none">
            Page {currentPageNumber} / {totalPages}
          </span>
          <button
            onClick={onNextPage}
            disabled={currentPageNumber >= totalPages}
            title="Next page"
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        <Section title="Tools">
          {/* Numpad layout: tools 1–9 in the grid, eraser (0) in its own row. */}
          <div className="grid grid-cols-3 gap-1.5">
            {GRID_TOOLS.map(renderToolButton)}
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            <div />
            {renderToolButton(ERASER_TOOL)}
            <div />
          </div>
        </Section>

        <Section title="Stroke">
          <div className="flex gap-1.5 flex-wrap">
            {STROKE_COLORS.map((c) => (
              <Swatch
                key={c}
                color={c}
                active={snapshot.strokeColor?.toLowerCase() === c.toLowerCase()}
                onClick={() => onSetStrokeColor(c)}
              />
            ))}
          </div>
        </Section>

        {!isText && (
          <Section title="Background">
            <div className="flex gap-1.5 flex-wrap">
              {BACKGROUND_COLORS.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  active={snapshot.backgroundColor?.toLowerCase() === c.toLowerCase()}
                  onClick={() => onSetBackground(c)}
                />
              ))}
            </div>
          </Section>
        )}

        {!isText && (
          <Section title="Stroke width">
            <div className="flex gap-1.5">
              {STROKE_WIDTHS.map(({ value, label, weight }) => (
                <PillButton
                  key={value}
                  active={snapshot.strokeWidth === value}
                  onClick={() => onSetStrokeWidth(value)}
                  title={label}
                >
                  <StrokeWidthIcon weight={weight} />
                </PillButton>
              ))}
            </div>
          </Section>
        )}

        {!isText && (
          <Section title="Stroke style">
            <div className="flex gap-1.5">
              {STROKE_STYLES.map(({ value, label, dash }) => (
                <PillButton
                  key={value}
                  active={snapshot.strokeStyle === value}
                  onClick={() => onSetStrokeStyle(value)}
                  title={label}
                >
                  <StrokeStyleIcon dash={dash} />
                </PillButton>
              ))}
            </div>
          </Section>
        )}

        {!isText && hasBackground && (
          <Section title="Fill style">
            <div className="flex gap-1.5">
              {FILL_STYLES.map(({ value, label }) => (
                <PillButton
                  key={value}
                  active={snapshot.fillStyle === value}
                  onClick={() => onSetFillStyle(value)}
                  title={label}
                >
                  <FillStyleIcon variant={value} />
                </PillButton>
              ))}
            </div>
          </Section>
        )}

        {isText && (
          <Section title="Font family">
            <div className="flex gap-1.5">
              {FONT_FAMILIES.map(({ value, label, Icon }) => (
                <PillButton
                  key={value}
                  active={snapshot.fontFamily === value}
                  onClick={() => onSetFontFamily(value)}
                  title={label}
                >
                  <Icon className="w-4 h-4" />
                </PillButton>
              ))}
            </div>
          </Section>
        )}

        {isText && (
          <Section title="Font size">
            <div className="flex gap-1.5">
              {FONT_SIZES.map(({ value, label }) => (
                <PillButton
                  key={value}
                  active={snapshot.fontSize === value}
                  onClick={() => onSetFontSize(value)}
                  title={`${value}px`}
                >
                  {label}
                </PillButton>
              ))}
            </div>
          </Section>
        )}

        <Section title={`Opacity (${Math.round(snapshot.opacity)}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={snapshot.opacity}
            onChange={(e) => onSetOpacity(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </Section>

        <div className="mt-2 pt-3 border-t border-gray-200">
          {/* The one primary action in the rail — given a yellow accent (issue
              #22). Every other control stays Excalidraw-native. */}
          <button
            onClick={onDownload}
            title="Download this page as PNG"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border-2 border-[#111827] text-[#111827] bg-[#facc15] shadow-[2px_2px_0_0_#111827] hover:shadow-[1px_1px_0_0_#111827] hover:translate-x-px hover:translate-y-px transition"
          >
            <Download className="w-4 h-4" />
            Download page
          </button>
        </div>
      </div>
    </div>
  );
}
