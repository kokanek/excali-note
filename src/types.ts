export interface Page {
  id: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown>;
  // Data URL (PNG) of the page rendered with Excalidraw's real engine, used for
  // the sidebar preview. Generated on commit / when the page becomes active.
  thumbnail?: string;
}

export interface Notebook {
  id: string;
  name: string;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}