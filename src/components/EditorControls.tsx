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
  Download,
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
}

interface EditorControlsProps {
  snapshot: ControlsSnapshot;
  onSetTool: (tool: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetBackground: (color: string) => void;
  onSetStrokeWidth: (width: number) => void;
  onSetStrokeStyle: (style: string) => void;
  onSetFillStyle: (style: string) => void;
  onSetOpacity: (opacity: number) => void;
  onSetFontSize: (size: number) => void;
  onDownload: () => void;
}

const TOOLS: { type: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { type: 'selection', label: 'Select (V)', Icon: MousePointer2 },
  { type: 'freedraw', label: 'Draw (P)', Icon: Pencil },
  { type: 'rectangle', label: 'Rectangle (R)', Icon: Square },
  { type: 'diamond', label: 'Diamond (D)', Icon: Diamond },
  { type: 'ellipse', label: 'Ellipse (O)', Icon: Circle },
  { type: 'arrow', label: 'Arrow (A)', Icon: MoveUpRight },
  { type: 'line', label: 'Line (L)', Icon: Minus },
  { type: 'text', label: 'Text (T)', Icon: Type },
  { type: 'eraser', label: 'Eraser (E)', Icon: Eraser },
];

// Excalidraw's default palettes so the swatches feel native.
const STROKE_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
const BACKGROUND_COLORS = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
const STROKE_WIDTHS = [
  { value: 1, label: 'Thin' },
  { value: 2, label: 'Bold' },
  { value: 4, label: 'Extra bold' },
];
const STROKE_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];
const FILL_STYLES = [
  { value: 'hachure', label: 'Hachure' },
  { value: 'cross-hatch', label: 'Cross-hatch' },
  { value: 'solid', label: 'Solid' },
];
const FONT_SIZES = [
  { value: 16, label: 'S' },
  { value: 20, label: 'M' },
  { value: 28, label: 'L' },
  { value: 36, label: 'XL' },
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
      className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition ${
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
  onSetTool,
  onSetStrokeColor,
  onSetBackground,
  onSetStrokeWidth,
  onSetStrokeStyle,
  onSetFillStyle,
  onSetOpacity,
  onSetFontSize,
  onDownload,
}: EditorControlsProps) {
  const hasBackground = snapshot.backgroundColor !== 'transparent';
  // Font size is only relevant for text elements / the text tool.
  const showFont = snapshot.hasText;

  return (
    <div className="w-56 min-w-[14rem] flex flex-col bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <Section title="Tools">
          <div className="grid grid-cols-3 gap-1.5">
            {TOOLS.map(({ type, label, Icon }) => (
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
            ))}
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

        <Section title="Stroke width">
          <div className="flex gap-1.5">
            {STROKE_WIDTHS.map(({ value, label }) => (
              <PillButton
                key={value}
                active={snapshot.strokeWidth === value}
                onClick={() => onSetStrokeWidth(value)}
                title={label}
              >
                {label}
              </PillButton>
            ))}
          </div>
        </Section>

        <Section title="Stroke style">
          <div className="flex gap-1.5">
            {STROKE_STYLES.map(({ value, label }) => (
              <PillButton
                key={value}
                active={snapshot.strokeStyle === value}
                onClick={() => onSetStrokeStyle(value)}
                title={label}
              >
                {label}
              </PillButton>
            ))}
          </div>
        </Section>

        {hasBackground && (
          <Section title="Fill style">
            <div className="flex gap-1.5">
              {FILL_STYLES.map(({ value, label }) => (
                <PillButton
                  key={value}
                  active={snapshot.fillStyle === value}
                  onClick={() => onSetFillStyle(value)}
                  title={label}
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

        {showFont && (
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

        <div className="mt-2 pt-3 border-t border-gray-200">
          <button
            onClick={onDownload}
            title="Download this page as PNG"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            <Download className="w-4 h-4" />
            Download page
          </button>
        </div>
      </div>
    </div>
  );
}
