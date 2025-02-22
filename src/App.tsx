import { useState, useCallback, useMemo, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PagePreview } from './components/PagePreview';
import type { Page } from './types';
import { cloneDeep, isEqual, debounce } from 'lodash';

const INITIAL_PAGES: Page[] = Array(1).fill(null).map((_, index) => ({
  id: `page-${index + 1}`,
  elements: [],
  files: {},
  appState: {
    viewBackgroundColor: "#ffffff"
  }
}));

function App() {
  const [pages, setPages] = useState<Page[]>(INITIAL_PAGES);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const currentPage = useMemo(() => pages[currentPageIndex], [pages, currentPageIndex]);

  const handleChange = useMemo(
    () =>
      debounce((elements: any[], appState: any, files: any[]) => {
        console.log('elements', elements, pages[currentPageIndex].elements);

        if (elements.length === 0) {
          console.log('elements array empty')
        }
        const newPages = cloneDeep(pages);

        const areElementsEqual = isEqual(pages[currentPageIndex].elements, elements);
        if (areElementsEqual) {
          console.log('elements are equal, not updating');
          return;
        }

        newPages[currentPageIndex] = {
          elements: cloneDeep(elements),
          id: pages[currentPageIndex].id,
          appState: pages[currentPageIndex].appState,
          files: cloneDeep(files)
        };

        console.log('updating...');
        setPages(newPages);
      }, 200),
    [pages, currentPageIndex]
  );

  // Cleanup the debounced function when the component unmounts
  useEffect(() => {
    return () => {
      handleChange.cancel();
    };
  }, [handleChange]);

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
  function handleDelete(deletionId: string): void {
    // Don't allow deleting the last page
    if (pages.length <= 1) return;

    const deletionPageIndex = pages.findIndex(page => page.id === deletionId);
    if (deletionPageIndex === -1) return;

    const newPages = pages.filter(page => page.id !== deletionId);

    // Handle other cases
    if (deletionPageIndex < currentPageIndex) {
      setCurrentPageIndex(currentPageIndex - 1);
    } else if (deletionPageIndex === currentPageIndex) {
      const newIndex = Math.min(currentPageIndex, newPages.length - 1);
      setCurrentPageIndex(newIndex);
    }

    setPages(newPages);
  }

  // Add this function to handle page reordering
  function handlePageMove(pageId: string, direction: 'up' | 'down'): void {
    const pageIndex = pages.findIndex(page => page.id === pageId);
    if (pageIndex === -1) return;

    const newPages = [...pages];
    const newIndex = direction === 'up' ? pageIndex - 1 : pageIndex + 1;

    // Check bounds
    if (newIndex < 0 || newIndex >= pages.length) return;

    // Swap pages
    [newPages[pageIndex], newPages[newIndex]] = [newPages[newIndex], newPages[pageIndex]];

    // Update current page index if we moved the current page
    if (pageIndex === currentPageIndex) {
      setCurrentPageIndex(newIndex);
    } else if (newIndex === currentPageIndex) {
      setCurrentPageIndex(pageIndex);
    }

    setPages(newPages);
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar with previews */}
      <div className="w-64 min-w-[16rem] flex flex-col bg-white border-r border-gray-200">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold">Excalinote</h1>
          <div className="relative group">
            <button 
              onClick={() => {
                const newPages = [...pages];
                newPages.push({
                  id: `page-${pages.length + 1}`,
                  elements: [],
                  appState: {
                    viewBackgroundColor: "#ffffff"
                  }
                });
                setPages(newPages);
              }}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-sm px-2 py-1 rounded top-0 left-full ml-2 whitespace-nowrap">
              Add new page
            </div>
          </div>
        </div>
        {/* Previews Container */}
        <div className="flex-1 overflow-y-auto p-4">
          {pages.map((page, index) => (
            <PagePreview
              key={page.id}
              page={page}
              pageId={page.id}
              isActive={currentPageIndex === index}
              onClick={() => setCurrentPageIndex(index)}
              onPageDelete={handleDelete}
              onPageMove={handlePageMove}
              pageNumber={index + 1}
              isFirst={index === 0}
              isLast={index === pages.length - 1}
            />
          ))}
        </div>
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
              onChange={handleChange}
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