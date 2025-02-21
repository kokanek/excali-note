import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';
import type { Page } from '../types';
import { RoughPreview } from './RoughPreview';

interface PagePreviewProps {
  page: Page;
  isActive: boolean;
  onClick: () => void;
  onPageDelete: (pageId: string) => void;
  pageId: string;
}

// Scale factor for preview (A4 dimensions: 595x842)
const PREVIEW_WIDTH = 200;
const SCALE_FACTOR = PREVIEW_WIDTH / 595;

export function PagePreview({ page, isActive, onClick, onPageDelete, pageId }: PagePreviewProps) {
  console.log('PagePreview rendered', page);
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

    // Render each element
    page.elements.forEach(element => {
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
          // Use the canvas context directly for text
          if (!ctx) return;
          
          // Scale the font size
          const scaledFontSize = (element.fontSize || 20) * SCALE_FACTOR;
          ctx.font = `${scaledFontSize}px ${element.fontFamily === 1 ? 'sans-serif' : 'serif'}`;
          ctx.fillStyle = element.strokeColor || '#000000';
          ctx.textAlign = element.textAlign as CanvasTextAlign || 'left';
          
          // Draw the text at the scaled position
          ctx.fillText(
            element.text,
            scaledElement.x,
            scaledElement.y + scaledFontSize, // Add scaled font size to y to account for baseline
          );
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
      }
    });
  });

  function scaleElement(element: any) {
    const scaled = { ...element };
    
    // Scale position and dimensions
    if ('x' in element) scaled.x = element.x * SCALE_FACTOR;
    if ('y' in element) scaled.y = element.y * SCALE_FACTOR;
    if ('width' in element) scaled.width = element.width * SCALE_FACTOR;
    if ('height' in element) scaled.height = element.height * SCALE_FACTOR;
    
    return scaled;
  }

  return (
    <div 
      onClick={onClick}
      className={`group relative w-full aspect-[1/1.414] mb-4 cursor-pointer transition-all ${
        isActive ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-300 border-2 border-gray-200'
      }`}
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={PREVIEW_WIDTH * 1.414} // A4 aspect ratio
        className="w-full h-full"
      />
      <button
        onClick={() => handleDelete(pageId)}
        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
        title="Delete page"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-4 w-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
          />
        </svg>
      </button>
    </div>
  );
}