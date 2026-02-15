import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import rough from 'roughjs';
import type { Notebook } from '../types';

interface NotebookCardProps {
  notebook: Notebook;
  viewMode: 'grid' | 'list';
  onSelect: () => void;
  onDelete: () => void;
}

// Scale factor for thumbnail preview
const THUMBNAIL_WIDTH = 240;
const SCALE_FACTOR = THUMBNAIL_WIDTH / 595;

export function NotebookCard({ notebook, viewMode, onSelect, onDelete }: NotebookCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !notebook.pages.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rc = rough.canvas(canvas);
    const firstPage = notebook.pages[0];
    const { files = {} } = firstPage;

    // Render elements from the first page
    firstPage.elements
      ?.filter((element) => element.isDeleted === false)
      .forEach((element) => {
        const scaledElement = scaleElement(element);
        const options = {
          stroke: element.strokeColor || '#000000',
          strokeWidth: (element.strokeWidth || 1) * SCALE_FACTOR,
          fill: element.backgroundColor,
          fillStyle: element.fillStyle,
        };

        switch (element.type) {
          case 'rectangle':
            rc.rectangle(
              scaledElement.x,
              scaledElement.y,
              scaledElement.width,
              scaledElement.height,
              options
            );
            break;
          case 'text': {
            const scaledFontSize = (element.fontSize || 20) * SCALE_FACTOR;
            ctx.font = `${scaledFontSize}px ${element.fontFamily === 1 ? 'sans-serif' : 'serif'}`;
            ctx.fillStyle = element.strokeColor || '#000000';
            ctx.textAlign = 'left';

            // Text wrapping
            const words = element.text.split(' ');
            let line = '';
            let y = scaledElement.y + scaledFontSize;

            for (const word of words) {
              const testLine = line + (line ? ' ' : '') + word;
              const metrics = ctx.measureText(testLine);

              if (metrics.width > scaledElement.width && line) {
                ctx.fillText(line, scaledElement.x, y);
                line = word;
                y += scaledFontSize * 1.2;
              } else {
                line = testLine;
              }
            }
            if (line) {
              ctx.fillText(line, scaledElement.x, y);
            }
            break;
          }
          case 'diamond': {
            const midX = scaledElement.x + scaledElement.width / 2;
            const midY = scaledElement.y + scaledElement.height / 2;
            const points: [number, number][] = [
              [midX, scaledElement.y],
              [scaledElement.x + scaledElement.width, midY],
              [midX, scaledElement.y + scaledElement.height],
              [scaledElement.x, midY],
            ];
            rc.polygon(points, options);
            break;
          }
          case 'ellipse':
            rc.ellipse(
              scaledElement.x + scaledElement.width / 2,
              scaledElement.y + scaledElement.height / 2,
              scaledElement.width,
              scaledElement.height,
              options
            );
            break;
          case 'line':
          case 'arrow': {
            const [relX1, relY1] = element.points[0];
            const [relX2, relY2] = element.points[element.points.length - 1];

            const x1 = (element.x + relX1) * SCALE_FACTOR;
            const y1 = (element.y + relY1) * SCALE_FACTOR;
            const x2 = (element.x + relX2) * SCALE_FACTOR;
            const y2 = (element.y + relY2) * SCALE_FACTOR;

            rc.line(x1, y1, x2, y2, options);

            if (element.type === 'arrow' && element.endArrowhead === 'arrow') {
              const angle = Math.atan2(y2 - y1, x2 - x1);
              const arrowLength = 10 * SCALE_FACTOR;
              const arrowAngle = Math.PI / 6;

              rc.line(
                x2,
                y2,
                x2 - arrowLength * Math.cos(angle - arrowAngle),
                y2 - arrowLength * Math.sin(angle - arrowAngle),
                options
              );
              rc.line(
                x2,
                y2,
                x2 - arrowLength * Math.cos(angle + arrowAngle),
                y2 - arrowLength * Math.sin(angle + arrowAngle),
                options
              );
            }
            break;
          }
          case 'freedraw':
            if (element.points && element.points.length > 1) {
              const scaledPoints = element.points.map(([x, y]: [number, number]) => [
                (element.x + x) * SCALE_FACTOR,
                (element.y + y) * SCALE_FACTOR,
              ]);
              rc.curve(scaledPoints, options);
            }
            break;
          case 'image': {
            const fileData = files[element.fileId];
            if (fileData?.dataURL) {
              const img = new Image();
              img.src = fileData.dataURL;

              img.onload = () => {
                if (!ctx) return;
                ctx.drawImage(
                  img,
                  scaledElement.x,
                  scaledElement.y,
                  scaledElement.width,
                  scaledElement.height
                );
              };
            }
            break;
          }
        }
      });
  }, [notebook]);

  function scaleElement(element: Record<string, unknown>) {
    const scaled = { ...element };
    if ('x' in element) scaled.x = element.x * SCALE_FACTOR;
    if ('y' in element) scaled.y = element.y * SCALE_FACTOR;
    if ('width' in element) scaled.width = element.width * SCALE_FACTOR;
    if ('height' in element) scaled.height = element.height * SCALE_FACTOR;
    return scaled;
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${notebook.name}"?`)) {
      onDelete();
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={onSelect}
        className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
      >
        <div className="flex-shrink-0 w-32 h-[181px] border border-gray-200 rounded overflow-hidden">
          <canvas
            ref={canvasRef}
            width={THUMBNAIL_WIDTH}
            height={THUMBNAIL_WIDTH * 1.414}
            className="w-full h-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{notebook.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {notebook.pages.length} {notebook.pages.length === 1 ? 'page' : 'pages'}
          </p>
          <p className="text-sm text-gray-400 mt-1">Updated {formatDate(notebook.updatedAt)}</p>
        </div>
        <button
          onClick={handleDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete notebook"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden border border-gray-200"
    >
      <div className="aspect-[1/1.414] border-b border-gray-200 relative bg-gray-50">
        <canvas
          ref={canvasRef}
          width={THUMBNAIL_WIDTH}
          height={THUMBNAIL_WIDTH * 1.414}
          className="w-full h-full"
        />
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-2 bg-white text-gray-400 hover:text-red-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete notebook"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate mb-1">{notebook.name}</h3>
        <p className="text-sm text-gray-500">
          {notebook.pages.length} {notebook.pages.length === 1 ? 'page' : 'pages'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Updated {formatDate(notebook.updatedAt)}</p>
      </div>
    </div>
  );
}
