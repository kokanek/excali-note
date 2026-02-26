import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { NotebookEditor } from './components/NotebookEditor';
import type { Notebook, Page } from './types';

const STORAGE_KEY = 'excali_note_notebooks';

const INITIAL_PAGE: Page = {
  id: 'page-1',
  elements: [],
  files: {},
  appState: {
    viewBackgroundColor: '#ffffff',
  },
};

function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>(() => {
    // Try to migrate old data from session storage
    const oldData = sessionStorage.getItem('excali_note');
    if (oldData) {
      try {
        const pages = JSON.parse(oldData);
        const migratedNotebook: Notebook = {
          id: `notebook-${Date.now()}`,
          name: 'My Notebook',
          pages: pages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify([migratedNotebook]));
        // Clear old session storage
        sessionStorage.removeItem('excali_note');
        return [migratedNotebook];
      } catch (error) {
        console.error('Failed to migrate old data:', error);
      }
    }

    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse stored notebooks:', error);
      }
    }
    return [];
  });

  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);

  // Save notebooks to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks));
    } catch (error) {
      console.error('Failed to save notebooks to storage:', error);
    }
  }, [notebooks]);

  const handleNotebookCreate = (name: string) => {
    const newNotebook: Notebook = {
      id: `notebook-${Date.now()}`,
      name,
      pages: [{ ...INITIAL_PAGE }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotebooks([...notebooks, newNotebook]);
  };

  const handleNotebookDelete = (notebookId: string) => {
    setNotebooks(notebooks.filter((nb) => nb.id !== notebookId));
    if (selectedNotebookId === notebookId) {
      setSelectedNotebookId(null);
    }
  };

  const handlePagesChange = (pages: Page[]) => {
    if (!selectedNotebookId) return;

    setNotebooks(
      notebooks.map((nb) =>
        nb.id === selectedNotebookId
          ? { ...nb, pages, updatedAt: Date.now() }
          : nb
      )
    );
  };

  const selectedNotebook = notebooks.find((nb) => nb.id === selectedNotebookId);

  if (selectedNotebook) {
    return (
      <NotebookEditor
        pages={selectedNotebook.pages}
        onPagesChange={handlePagesChange}
        onBack={() => setSelectedNotebookId(null)}
        notebookName={selectedNotebook.name}
      />
    );
  }

  return (
    <Dashboard
      notebooks={notebooks}
      onNotebookSelect={setSelectedNotebookId}
      onNotebookCreate={handleNotebookCreate}
      onNotebookDelete={handleNotebookDelete}
    />
  );
}

export default App;