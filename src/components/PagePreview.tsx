import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';
import type { Page } from '../types';

interface PagePreviewProps {
  page: Page;
  isActive: boolean;
  onClick: () => void;
  onPageDelete: (pageId: string) => void;
  onPageMove: (pageId: string, direction: 'up' | 'down') => void;
  pageId: string;
  pageNumber: number;
  isFirst: boolean;
  isLast: boolean;
}

// Scale factor for preview (A4 dimensions: 595x842)
const PREVIEW_WIDTH = 200;
const SCALE_FACTOR = PREVIEW_WIDTH / 595;

export function PagePreview({ 
  page, 
  isActive, 
  onClick, 
  onPageDelete, 
  onPageMove,
  pageId, 
  pageNumber,
  isFirst,
  isLast 
}: PagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDelete = (pageId: string) => {
    if (window.confirm("Are you sure you want to delete this page?")) {
      onPageDelete(pageId);
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle =  '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rc = rough.canvas(canvas);
    const { files } = page;

    // Render each element
    page.elements.filter((element) => !element.isDeleted).forEach(element => {
      const scaledElement = scaleElement(element);
      const options = {
        stroke: element.strokeColor || '#000000',
        strokeWidth: (element.strokeWidth || 1) * SCALE_FACTOR,
        fill: element.backgroundColor,
        fillStyle: element.fillStyle
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
          if (!ctx) return;
          
          // Scale the font size
          const scaledFontSize = (element.fontSize || 20) * SCALE_FACTOR;
          ctx.font = `${scaledFontSize}px ${element.fontFamily === 1 ? 'sans-serif' : 'serif'}`;
          ctx.fillStyle = element.strokeColor || '#000000';
          ctx.textAlign =  'left';
          
          // Text wrapping function
          const words = element.text.split(' ');
          let line = '';
          let y = scaledElement.y + scaledFontSize;
          
          for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > scaledElement.width && line) {
              ctx.fillText(line, scaledElement.x, y);
              line = word;
              y += scaledFontSize * 1.2; // Add line spacing
            } else {
              line = testLine;
            }
          }
          // Draw the last line
          if (line) {
            ctx.fillText(line, scaledElement.x, y);
          }
          break;
        }
        case 'diamond': {
          // For a diamond, we need to create a path from the midpoints of each side
          const midX = scaledElement.x + scaledElement.width / 2;
          const midY = scaledElement.y + scaledElement.height / 2;
          const points: [number, number][] = [
            [midX, scaledElement.y], // top
            [scaledElement.x + scaledElement.width, midY], // right
            [midX, scaledElement.y + scaledElement.height], // bottom
            [scaledElement.x, midY], // left
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
          // Get start and end points from the element and add the element's x,y offset
          const [relX1, relY1] = element.points[0];
          const [relX2, relY2] = element.points[element.points.length - 1];
          
          // Add the element's x,y offset to get absolute coordinates
          const x1 = (element.x + relX1) * SCALE_FACTOR;
          const y1 = (element.y + relY1) * SCALE_FACTOR;
          const x2 = (element.x + relX2) * SCALE_FACTOR;
          const y2 = (element.y + relY2) * SCALE_FACTOR;
          
          // Draw the main line
          rc.line(
            x1,
            y1,
            x2,
            y2,
            options
          );
          
          if (element.type === 'arrow' && element.endArrowhead === 'arrow') {
            // Calculate arrow angle
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const arrowLength = 10 * SCALE_FACTOR;
            const arrowAngle = Math.PI / 6;
            
            // Draw arrowhead
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
              (element.y + y) * SCALE_FACTOR
            ]);
            
            rc.curve(scaledPoints, options);
          }
          break;
        case 'image': {
            const fileData = files[element.fileId];
            if (fileData?.dataURL) {
              // Create a new image element
              const img = new Image();
              img.src = fileData.dataURL;
              
              // Draw the image once it's loaded
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
  });

  function scaleElement(element: Record<string, unknown>) {
    const scaled = { ...element };
    
    // Scale position and dimensions
    if (typeof element.x === 'number') scaled.x = element.x * SCALE_FACTOR;
    if (typeof element.y === 'number') scaled.y = element.y * SCALE_FACTOR;
    if (typeof element.width === 'number') scaled.width = element.width * SCALE_FACTOR;
    if (typeof element.height === 'number') scaled.height = element.height * SCALE_FACTOR;
    
    return scaled;
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center mb-2 w-full">
        <div 
          onClick={onClick}
          className={`relative w-full aspect-[1/1.414] cursor-pointer transition-all ${
            isActive ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-300 border-2 border-gray-200'
          }`}
        >
          <canvas
            ref={canvasRef}
            width={PREVIEW_WIDTH}
            height={PREVIEW_WIDTH * 1.414}
            className="w-full h-full"
          />
        </div>
        <div className={`w-full flex justify-between items-center px-1 py-1 bg-gray-100 rounded-b-lg ${
          isActive ? 'ring-2 ring-blue-500' : 'border-x-2 border-b-2 border-gray-200'
        }`}>
          {/* Page number - left aligned */}
          <span className="text-gray-600 text-sm pl-2">
            Page {pageNumber}
          </span>
          
          {/* Control buttons - right aligned */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPageMove(pageId, 'up');
              }}
              disabled={isFirst}
              className={`p-1 transition-opacity ${
                isFirst ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'
              }`}
              title="Move page up"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="black">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPageMove(pageId, 'down');
              }}
              disabled={isLast}
              className={`p-1 transition-opacity ${
                isLast ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'
              }`}
              title="Move page down"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="black">
                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(pageId);
              }}
              className="p-1 transition-opacity hover:opacity-70"
              title="Delete page"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="black"
                strokeWidth="2"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}