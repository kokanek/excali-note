export interface Page {
  id: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface Notebook {
  id: string;
  name: string;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}