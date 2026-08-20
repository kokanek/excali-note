// Self hosted fonts (node modules) so the home page paints the right face on
// first frame even behind a locked down network — same set the landing uses.
import '@fontsource/darker-grotesque/400.css';
import '@fontsource/darker-grotesque/500.css';
import '@fontsource/darker-grotesque/700.css';
import '@fontsource/darker-grotesque/800.css';
import '@fontsource/jetbrains-mono/700.css';

import { useState } from 'react';
import { Grid, List, Plus } from 'lucide-react';
import type { Notebook } from '../types';
import { NotebookCard } from './NotebookCard';
import './neobrutalism.css';

interface DashboardProps {
  notebooks: Notebook[];
  onNotebookSelect: (notebookId: string) => void;
  onNotebookCreate: (name: string) => void;
  onNotebookDelete: (notebookId: string) => void;
}

export function Dashboard({ notebooks, onNotebookSelect, onNotebookCreate, onNotebookDelete }: DashboardProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreating, setIsCreating] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');

  const handleCreateNotebook = () => {
    if (newNotebookName.trim()) {
      onNotebookCreate(newNotebookName.trim());
      setNewNotebookName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="nb-home">
      {/* Header */}
      <div className="nb-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="nb-brand">
              <img src="/favicon.svg" alt="" />
              Excalinote
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              {/* About — links to the /landing marketing page (primary yellow) */}
              <a className="nb-btn nb-btn--yellow" href="/landing">
                About
              </a>
              {/* View Mode Toggle — neutral interface control, not a primary CTA */}
              <div className="nb-toggle">
                <button
                  onClick={() => setViewMode('grid')}
                  className={viewMode === 'grid' ? 'active' : ''}
                  title="Grid view"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'active' : ''}
                  title="List view"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
              {/* Create Notebook Button (primary blue) */}
              <button onClick={() => setIsCreating(true)} className="nb-btn nb-btn--blue">
                <Plus className="w-5 h-5" />
                New Notebook
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Notebook Form */}
        {isCreating && (
          <div className="mb-8 nb-panel p-6">
            <h2 className="text-2xl font-extrabold mb-4">Create New Notebook</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={newNotebookName}
                onChange={(e) => setNewNotebookName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateNotebook();
                  } else if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewNotebookName('');
                  }
                }}
                placeholder="Notebook name..."
                className="nb-input flex-1 px-4 py-2 text-lg"
                autoFocus
              />
              <button onClick={handleCreateNotebook} className="nb-btn nb-btn--blue">
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewNotebookName('');
                }}
                className="nb-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Notebooks Grid/List */}
        {notebooks.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white border-[3px] border-[#111827] rounded-full mb-4 shadow-[4px_4px_0_0_#111827]">
              <Plus className="w-8 h-8 text-[#111827]" />
            </div>
            <h3 className="text-2xl font-extrabold mb-2">No notebooks yet</h3>
            <p className="text-lg text-[#6b7280] mb-6 font-medium">Create your first notebook to get started</p>
            <button onClick={() => setIsCreating(true)} className="nb-btn nb-btn--blue">
              <Plus className="w-5 h-5" />
              Create Notebook
            </button>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'flex flex-col gap-4'
            }
          >
            {notebooks.map((notebook) => (
              <NotebookCard
                key={notebook.id}
                notebook={notebook}
                viewMode={viewMode}
                onSelect={() => onNotebookSelect(notebook.id)}
                onDelete={() => onNotebookDelete(notebook.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
