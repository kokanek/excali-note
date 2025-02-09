import { useState, useCallback, useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PagePreview } from './components/PagePreview';
import type { Page } from './types';
import { cloneDeep, isEqual } from 'lodash';

const INITIAL_PAGES: Page[] = Array(4).fill(null).map((_, index) => ({
  id: `page-${index + 1}`,
  elements: [],
}));

function App() {
  const [pages, setPages] = useState<Page[]>(INITIAL_PAGES);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const currentPage = useMemo(() => pages[currentPageIndex], [pages, currentPageIndex]);

  const handlePageChange = (elements: any[]) => {
    console.log('elements', elements);
    console.log('stored', pages[currentPageIndex].elements);
    const newPages = cloneDeep(pages);

    const areElementsEqual = isEqual(pages[currentPageIndex].elements, elements);
    if (areElementsEqual) {
      console.log('elements are equal, not updating');
      return;
    }

    newPages[currentPageIndex] = {
      elements: cloneDeep(elements),
    };

    console.log('updating...');
    setPages(newPages);
  };

  const goToNextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(prev => prev + 1);
    }
  }, [currentPageIndex, pages.length]);

  const goToPreviousPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    }
  }, [currentPageIndex]);

  const handlePageClick = useCallback((index: number) => {
    setCurrentPageIndex(index);
  }, []);

  // Key prop forces Excalidraw to re-render when page changes
  const excalidrawKey = useMemo(() => `excalidraw-${currentPageIndex}`, [currentPageIndex]);

  console.log('App rendered');
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar with previews */}
      <div className="w-64 p-4 bg-white border-r border-gray-200 overflow-y-auto">
        {pages.map((page, index) => (
          <PagePreview
            key={page.id}
            page={page}
            isActive={index === currentPageIndex}
            onClick={() => handlePageClick(index)}
          />
        ))}
      </div>

      {/* Main canvas with vertical navigation */}
      <div className="flex-1 flex">
        {/* A4 Canvas */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-100">
          <div className="flex flex-col mr-1 justify-center p-4 bg-white border-r border-gray-200">
            <button
              onClick={goToPreviousPage}
              disabled={currentPageIndex === 0}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          <div 
            className="w-[600px] h-[800px] bg-white shadow-lg"
            onWheel={(e) => e.stopPropagation()}
            onWheelCapture={e => {
              e.stopPropagation();
            }}
            style={{ touchAction: 'none' }}
          >
            <Excalidraw
              key={excalidrawKey}
              initialData={{
                elements: currentPage.elements,
              }}
              onChange={handlePageChange}
              gridModeEnabled={false}
              disablePanZoom={true}
              UIOptions={{
                canvasActions: {
                  export: false,
                  loadScene: false,
                  saveAsImage: false,
                }
              }}
            />
          </div>
          <div className="flex flex-col ml-1 justify-center p-4 bg-white border-r border-gray-200">
            <button
              onClick={goToNextPage}
              disabled={currentPageIndex === pages.length - 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;