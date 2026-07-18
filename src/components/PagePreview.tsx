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
  const handleDelete = (pageId: string) => {
    if (window.confirm("Are you sure you want to delete this page?")) {
      onPageDelete(pageId);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center mb-2 w-full">
        <div
          onClick={onClick}
          // aspect-[3/4] matches the real page (600x800), so the thumbnail fills
          // the box edge-to-edge with no letterboxing and lines up exactly with
          // the main canvas.
          className={`relative w-full aspect-[3/4] cursor-pointer transition-all ${
            isActive ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-300 border-2 border-gray-200'
          }`}
        >
          {/* Thumbnail rendered with Excalidraw's real engine (see
              NotebookEditor.renderPageThumbnail). Blank white until the page is
              first committed / activated. */}
          {page.thumbnail ? (
            <img
              src={page.thumbnail}
              alt={`Page ${pageNumber} preview`}
              className="w-full h-full object-fill bg-white"
            />
          ) : (
            <div className="w-full h-full bg-white" />
          )}
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