import { Trash2 } from 'lucide-react';
import type { Notebook } from '../types';

interface NotebookCardProps {
  notebook: Notebook;
  viewMode: 'grid' | 'list';
  onSelect: () => void;
  onDelete: () => void;
}

export function NotebookCard({ notebook, viewMode, onSelect, onDelete }: NotebookCardProps) {
  // Use the first page's real Excalidraw-rendered thumbnail (same image shown in
  // the in-note sidebar via PagePreview / NotebookEditor.renderPageThumbnail).
  // Blank white until the note has been opened/committed at least once.
  const firstPage = notebook.pages[0];

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

  const thumbnail = firstPage?.thumbnail ? (
    <img
      src={firstPage.thumbnail}
      alt={`${notebook.name} preview`}
      className="w-full h-full object-fill bg-white"
    />
  ) : (
    <div className="w-full h-full bg-white" />
  );

  if (viewMode === 'list') {
    return (
      <div
        onClick={onSelect}
        className="flex items-center gap-4 p-4 nb-card cursor-pointer"
      >
        <div className="flex-shrink-0 w-32 h-[181px] border-[3px] border-[#111827] rounded overflow-hidden">
          {thumbnail}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-extrabold text-[#111827] truncate">{notebook.name}</h3>
          <p className="text-base text-[#6b7280] mt-1 font-medium">
            {notebook.pages.length} {notebook.pages.length === 1 ? 'page' : 'pages'}
          </p>
          <p className="text-sm text-[#9ca3af] mt-1 font-medium">Updated {formatDate(notebook.updatedAt)}</p>
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
      className="group nb-card cursor-pointer overflow-hidden"
    >
      <div className="aspect-[1/1.414] border-b-[3px] border-[#111827] relative bg-white">
        {thumbnail}
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-2 bg-white text-gray-400 hover:text-red-600 rounded-lg border-2 border-[#111827] shadow-[2px_2px_0_0_#111827] opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete notebook"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-extrabold text-[#111827] truncate mb-1">{notebook.name}</h3>
        <p className="text-base text-[#6b7280] font-medium">
          {notebook.pages.length} {notebook.pages.length === 1 ? 'page' : 'pages'}
        </p>
        <p className="text-sm text-[#9ca3af] mt-1 font-medium">Updated {formatDate(notebook.updatedAt)}</p>
      </div>
    </div>
  );
}
