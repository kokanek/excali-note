import React, { memo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { Page } from '../types';

interface PagePreviewProps {
  page: Page;
  isActive: boolean;
  onClick: () => void;
}

export const PagePreview = memo(function PagePreview({ page, isActive, onClick }: PagePreviewProps) {
  return (
    <div 
      onClick={onClick}
      className={`w-full aspect-[1/1.414] mb-4 cursor-pointer transition-all ${
        isActive ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-300'
      }`}
    >
      <Excalidraw
        initialData={{
          elements: page.elements,
          appState: {
            ...page.appState,
            viewBackgroundColor: "#ffffff",
          },
        }}
        viewModeEnabled={true}
        zenModeEnabled={true}
        gridModeEnabled={false}
        disablePanZoom={true}
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
            saveAsImage: false,
            saveScene: false,
            theme: false,
          }
        }}
      />
    </div>
  );
});