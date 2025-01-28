import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';
import type { Page } from '../types';
import { RoughPreview } from './RoughPreview';

interface PagePreviewProps {
  page: Page;
  isActive: boolean;
  onClick: () => void;
}

// Scale factor for preview (A4 dimensions: 595x842)
const PREVIEW_WIDTH = 200;
const SCALE_FACTOR = PREVIEW_WIDTH / 595;

export function PagePreview({ page, isActive, onClick }: PagePreviewProps) {
  console.log('PagePreview rendered', page);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
          // Get start and end points from the element
          const [x1, y1] = element.points[0];
          const [x2, y2] = element.points[element.points.length - 1];
          
          // Scale the points
          const scaledX1 = x1 * SCALE_FACTOR;
          const scaledY1 = y1 * SCALE_FACTOR;
          const scaledX2 = x2 * SCALE_FACTOR;
          const scaledY2 = y2 * SCALE_FACTOR;
          
          // Draw the main line
          rc.line(
            scaledX1,
            scaledY1,
            scaledX2,
            scaledY2,
            options
          );
          
          if (element.type === 'arrow') {
            // Calculate arrow angle
            const angle = Math.atan2(scaledY2 - scaledY1, scaledX2 - scaledX1);
            const arrowLength = 10 * SCALE_FACTOR;
            const arrowAngle = Math.PI / 6;
            
            // Draw arrowhead
            rc.line(
              scaledX2,
              scaledY2,
              scaledX2 - arrowLength * Math.cos(angle - arrowAngle),
              scaledY2 - arrowLength * Math.sin(angle - arrowAngle),
              options
            );
            rc.line(
              scaledX2,
              scaledY2,
              scaledX2 - arrowLength * Math.cos(angle + arrowAngle),
              scaledY2 - arrowLength * Math.sin(angle + arrowAngle),
              options
            );
          }
          break;
        }
        case 'freedraw':
          if (element.points && element.points.length > 1) {
            const scaledPoints = element.points.map(([x, y]: [number, number]) => [
              x * SCALE_FACTOR,
              y * SCALE_FACTOR
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
      className={`w-full aspect-[1/1.414] mb-4 cursor-pointer transition-all ${
        isActive ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-300 border-2 border-gray-200'
      }`}
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={PREVIEW_WIDTH * 1.414} // A4 aspect ratio
        className="w-full h-full"
      />
    </div>
  );
}