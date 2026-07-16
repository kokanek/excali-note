import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Excalidraw, exportToCanvas, getCommonBounds } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, NormalizedZoomValue } from '@excalidraw/excalidraw/types/types';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { PagePreview } from './PagePreview';
import { EditorControls, type ControlsSnapshot } from './EditorControls';
import { measureText, LINE_HEIGHTS } from '../lib/textMeasure';
import type { Page } from '../types';
import { cloneDeep, isEqual, debounce } from 'lodash';

// The page is a fixed logical size; it's displayed scaled (via Excalidraw
// zoom) to fill the available height while keeping this aspect ratio.
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const PAGE_ASPECT = PAGE_WIDTH / PAGE_HEIGHT;

// Loose element shape — Excalidraw elements carry many fields we don't model.
type SceneElement = Record<string, unknown> & { id: string; type: string };

const DEFAULT_SNAPSHOT: ControlsSnapshot = {
  activeTool: 'selection',
  selectedCount: 0,
  hasText: false,
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  strokeWidth: 1,
  strokeStyle: 'solid',
  fillStyle: 'hachure',
  opacity: 100,
  fontSize: 20,
  fontFamily: 1,
};

// New version metadata so updateScene actually re-renders the mutated element.
const bumpVersion = (el: SceneElement) => ({
  version: ((el.version as number) ?? 1) + 1,
  versionNonce: Math.floor(Math.random() * 2 ** 31),
  updated: Date.now(),
});

function computeSnapshot(
  elements: readonly SceneElement[],
  appState: Record<string, unknown>
): ControlsSnapshot {
  const selectedIds = (appState.selectedElementIds ?? {}) as Record<string, boolean>;
  const selected = elements.filter((el) => selectedIds[el.id] && !el.isDeleted);
  const has = selected.length > 0;
  const first = selected[0];
  const activeTool = ((appState.activeTool as { type?: string })?.type ?? 'selection') as string;
  const pick = <T,>(elKey: string, curKey: string): T =>
    (has ? (first[elKey] as T) : (appState[curKey] as T));
  const textEl = selected.find((el) => el.type === 'text');

  return {
    activeTool,
    selectedCount: selected.length,
    hasText: has ? Boolean(textEl) : activeTool === 'text',
    strokeColor: pick<string>('strokeColor', 'currentItemStrokeColor') ?? '#1e1e1e',
    backgroundColor: pick<string>('backgroundColor', 'currentItemBackgroundColor') ?? 'transparent',
    strokeWidth: pick<number>('strokeWidth', 'currentItemStrokeWidth') ?? 1,
    strokeStyle: pick<string>('strokeStyle', 'currentItemStrokeStyle') ?? 'solid',
    fillStyle: pick<string>('fillStyle', 'currentItemFillStyle') ?? 'hachure',
    opacity: pick<number>('opacity', 'currentItemOpacity') ?? 100,
    fontSize:
      (textEl?.fontSize as number) ?? (appState.currentItemFontSize as number) ?? 20,
    fontFamily:
      (textEl?.fontFamily as number) ?? (appState.currentItemFontFamily as number) ?? 1,
  };
}

interface NotebookEditorProps {
  pages: Page[];
  onPagesChange: (pages: Page[]) => void;
  onBack: () => void;
  notebookName: string;
}

export function NotebookEditor({ pages, onPagesChange, onBack, notebookName }: NotebookEditorProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<ControlsSnapshot>(DEFAULT_SNAPSHOT);
  const [pageHeight, setPageHeight] = useState(PAGE_HEIGHT);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const currentPage = useMemo(() => pages[currentPageIndex], [pages, currentPageIndex]);

  // Option A responsive page: fixed logical 600x800 sheet, displayed scaled to
  // fill the available height (width follows the aspect ratio) via Excalidraw
  // zoom. Keeps a page identical across screen sizes; downloads/previews stay
  // at the canonical resolution.
  const pageDisplayWidth = Math.round(pageHeight * PAGE_ASPECT);
  const zoomValue = pageHeight / PAGE_HEIGHT;

  // Track the available height of the canvas area and recompute the page size.
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const compute = () => {
      const styles = getComputedStyle(el);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const available = el.clientHeight - padY;
      if (available > 0) setPageHeight(Math.max(320, Math.floor(available)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lock Excalidraw's zoom to the page scale. Excalidraw resets zoom to 1
  // during its post-mount init and can re-assert it on resize, so we apply it
  // here (immediately + a couple of frames later) and also re-assert from
  // onChange below, which catches any reset Excalidraw performs on its own.
  const applyZoom = useCallback(() => {
    const api = excalidrawAPIRef.current;
    if (!api) return;
    api.updateScene({
      appState: { zoom: { value: zoomValue as NormalizedZoomValue }, scrollX: 0, scrollY: 0 },
    });
  }, [zoomValue]);

  useEffect(() => {
    applyZoom();
    const r = requestAnimationFrame(applyZoom);
    const t = setTimeout(applyZoom, 150);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, [applyZoom, currentPageIndex]);

  // Block panning: Space (and the hand tool's "h" key) let the user pan the
  // canvas, which breaks the fixed page / notebook feel. Intercept these on the
  // canvas in the capture phase before Excalidraw's own handler sees them.
  // Leave typing untouched (text editor) and leave the rest of the app alone.
  useEffect(() => {
    const onKeyDownCapture = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Don't interfere with typing into the text editor / inputs.
      if (
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable
      ) {
        return;
      }
      // Only act on keys aimed at the canvas area.
      if (!canvasWrapRef.current?.contains(target)) return;
      if (e.code === 'Space' || e.key === ' ' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDownCapture, true);
    return () => window.removeEventListener('keydown', onKeyDownCapture, true);
  }, []);

  // Debounced persistence of element changes to the notebook store.
  const persistChange = useMemo(
    () =>
      debounce((elements: unknown[], files: Record<string, unknown>) => {
        const areElementsEqual = isEqual(pages[currentPageIndex].elements, elements);
        if (areElementsEqual) {
          return;
        }

        const newPages = cloneDeep(pages);
        newPages[currentPageIndex] = {
          elements: cloneDeep(elements),
          id: pages[currentPageIndex].id,
          appState: pages[currentPageIndex].appState,
          files: cloneDeep(files),
        };

        onPagesChange(newPages);
      }, 200),
    [pages, currentPageIndex, onPagesChange]
  );

  // Fired on every Excalidraw change: reflect state into our custom rail
  // (immediately) and persist element changes (debounced).
  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: Record<string, unknown>) => {
      const state = appState as Record<string, unknown>;
      setSnapshot(computeSnapshot(elements as readonly SceneElement[], state));

      // Keep the view locked to the page: re-assert zoom if Excalidraw drifted
      // from it (it resets to 1 on init) and snap scroll back to the origin so
      // any stray pan can't move the page. Guarded so this doesn't loop.
      const api = excalidrawAPIRef.current;
      const currentZoom = (state.zoom as { value?: number } | undefined)?.value ?? 1;
      const scrollX = (state.scrollX as number) ?? 0;
      const scrollY = (state.scrollY as number) ?? 0;
      if (
        api &&
        (Math.abs(currentZoom - zoomValue) > 1e-3 ||
          Math.abs(scrollX) > 0.5 ||
          Math.abs(scrollY) > 0.5)
      ) {
        api.updateScene({
          appState: { zoom: { value: zoomValue as NormalizedZoomValue }, scrollX: 0, scrollY: 0 },
        });
      }

      persistChange(elements as unknown[], files);
    },
    [persistChange, zoomValue]
  );

  // Cleanup the debounced function when the component unmounts
  useEffect(() => {
    return () => {
      persistChange.cancel();
    };
  }, [persistChange]);

  // ---- Control rail bridge: drive Excalidraw through its public API ----

  const setTool = useCallback((tool: string) => {
    excalidrawAPIRef.current?.setActiveTool({ type: tool as 'selection' });
    setSnapshot((prev) => ({ ...prev, activeTool: tool }));
  }, []);

  // Apply a property patch to all selected elements and set the matching
  // currentItem default (so newly drawn elements inherit it too).
  const applyProps = useCallback(
    (
      elementPatch: (el: SceneElement) => Record<string, unknown> | null,
      appStatePatch: Record<string, unknown>
    ) => {
      const api = excalidrawAPIRef.current;
      if (!api) return;
      const appState = api.getAppState() as unknown as Record<string, unknown>;
      const selectedIds = (appState.selectedElementIds ?? {}) as Record<string, boolean>;
      const elements = api.getSceneElements() as unknown as SceneElement[];

      const updated = elements.map((el) => {
        if (!selectedIds[el.id]) return el;
        const patch = elementPatch(el);
        if (!patch) return el;
        return { ...el, ...patch, ...bumpVersion(el) };
      });

      api.updateScene({
        elements: updated as unknown as Parameters<typeof api.updateScene>[0]['elements'],
        appState: appStatePatch as Parameters<typeof api.updateScene>[0]['appState'],
        commitToHistory: true,
      });
    },
    []
  );

  const setStrokeColor = useCallback(
    (color: string) => applyProps(() => ({ strokeColor: color }), { currentItemStrokeColor: color }),
    [applyProps]
  );
  const setBackground = useCallback(
    (color: string) =>
      applyProps(() => ({ backgroundColor: color }), { currentItemBackgroundColor: color }),
    [applyProps]
  );
  const setStrokeWidth = useCallback(
    (width: number) => applyProps(() => ({ strokeWidth: width }), { currentItemStrokeWidth: width }),
    [applyProps]
  );
  const setStrokeStyle = useCallback(
    (style: string) => applyProps(() => ({ strokeStyle: style }), { currentItemStrokeStyle: style }),
    [applyProps]
  );
  const setFillStyle = useCallback(
    (style: string) => applyProps(() => ({ fillStyle: style }), { currentItemFillStyle: style }),
    [applyProps]
  );
  const setOpacity = useCallback(
    (opacity: number) => applyProps(() => ({ opacity }), { currentItemOpacity: opacity }),
    [applyProps]
  );
  const setFontSize = useCallback(
    (size: number) =>
      applyProps((el) => {
        if (el.type !== 'text') return null;
        // Re-flow the bounding box so glyphs don't spill out of it. Skip
        // container-bound text, whose sizing follows its container.
        if (el.containerId) return { fontSize: size };
        const fontFamily = (el.fontFamily as number) ?? 1;
        const lineHeight = (el.lineHeight as number) ?? LINE_HEIGHTS[fontFamily] ?? 1.25;
        const metrics = measureText(String(el.text ?? ''), size, fontFamily, lineHeight);
        return { fontSize: size, ...metrics };
      }, { currentItemFontSize: size }),
    [applyProps]
  );
  const setFontFamily = useCallback(
    (family: number) =>
      applyProps((el) => {
        if (el.type !== 'text') return null;
        const lineHeight = LINE_HEIGHTS[family] ?? 1.25;
        if (el.containerId) return { fontFamily: family, lineHeight };
        const fontSize = (el.fontSize as number) ?? 20;
        const metrics = measureText(String(el.text ?? ''), fontSize, family, lineHeight);
        return { fontFamily: family, lineHeight, ...metrics };
      }, { currentItemFontFamily: family }),
    [applyProps]
  );

  const goToNextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  }, [currentPageIndex, pages.length]);

  const goToPreviousPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  }, [currentPageIndex]);

  // Key prop forces Excalidraw to re-render when page changes
  const excalidrawKey = useMemo(() => `excalidraw-${currentPageIndex}`, [currentPageIndex]);

  function handleDelete(deletionId: string): void {
    // Don't allow deleting the last page
    if (pages.length <= 1) return;

    const deletionPageIndex = pages.findIndex((page) => page.id === deletionId);
    if (deletionPageIndex === -1) return;

    const newPages = pages.filter((page) => page.id !== deletionId);

    // Handle other cases
    if (deletionPageIndex < currentPageIndex) {
      setCurrentPageIndex(currentPageIndex - 1);
    } else if (deletionPageIndex === currentPageIndex) {
      const newIndex = Math.min(currentPageIndex, newPages.length - 1);
      setCurrentPageIndex(newIndex);
    }

    onPagesChange(newPages);
  }

  // Add this function to handle page reordering
  function handlePageMove(pageId: string, direction: 'up' | 'down'): void {
    const pageIndex = pages.findIndex((page) => page.id === pageId);
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

    onPagesChange(newPages);
  }

  const setExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawAPIRef.current = api;
  }, []);

  async function handleDownload(): Promise<void> {
    try {
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = PAGE_WIDTH;
      pageCanvas.height = PAGE_HEIGHT;
      const ctx = pageCanvas.getContext('2d')!;

      // Fill white background matching the page
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

      const elements = currentPage.elements as Parameters<typeof exportToCanvas>[0]['elements'];
      if (elements.length > 0) {
        const elemCanvas = await exportToCanvas({
          elements,
          appState: currentPage.appState as Parameters<typeof exportToCanvas>[0]['appState'],
          files: (currentPage.files ?? null) as Parameters<typeof exportToCanvas>[0]['files'],
          exportPadding: 0,
        });

        // Get Excalidraw scroll offsets so elements land at their correct position on the page
        const appState = excalidrawAPIRef.current?.getAppState();
        const scrollX = appState?.scrollX ?? 0;
        const scrollY = appState?.scrollY ?? 0;

        // getCommonBounds returns [minX, minY, maxX, maxY] in scene coordinates
        const [minX, minY] = getCommonBounds(elements);

        // scene → screen: screenX = sceneX + scrollX
        ctx.drawImage(elemCanvas, Math.round(minX + scrollX), Math.round(minY + scrollY));
      }

      pageCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${notebookName}-page-${currentPageIndex + 1}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to download page:', err);
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar with previews */}
      <div className="w-64 min-w-[16rem] flex flex-col bg-white border-r border-gray-200">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"
              title="Back to dashboard"
            >
              <Home className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold truncate">{notebookName}</h1>
          </div>
          <div className="relative group flex-shrink-0">
            <button
              onClick={() => {
                const newPages = [...pages];
                newPages.push({
                  id: `page-${pages.length + 1}`,
                  elements: [],
                  appState: {
                    viewBackgroundColor: '#ffffff',
                  },
                });
                onPagesChange(newPages);
              }}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-sm px-2 py-1 rounded top-0 left-full ml-2 whitespace-nowrap z-10">
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

      {/* Custom control rail — replaces Excalidraw's own panel/toolbar, which
          overlap the page in Excalidraw's mobile layout (page < 730px wide). */}
      <EditorControls
        snapshot={snapshot}
        onSetTool={setTool}
        onSetStrokeColor={setStrokeColor}
        onSetBackground={setBackground}
        onSetStrokeWidth={setStrokeWidth}
        onSetStrokeStyle={setStrokeStyle}
        onSetFillStyle={setFillStyle}
        onSetOpacity={setOpacity}
        onSetFontSize={setFontSize}
        onSetFontFamily={setFontFamily}
        onDownload={handleDownload}
      />

      {/* Main canvas with vertical navigation */}
      <div className="flex-1 flex">
        {/* A4 Canvas */}
        <div
          ref={canvasAreaRef}
          className="flex-1 flex items-center justify-center p-8 bg-gray-100"
        >
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
            ref={canvasWrapRef}
            className="notebook-canvas bg-white shadow-lg"
            onWheel={(e) => e.stopPropagation()}
            onWheelCapture={(e) => {
              e.stopPropagation();
            }}
            style={{ touchAction: 'none', width: pageDisplayWidth, height: pageHeight }}
          >
            <Excalidraw
              key={excalidrawKey}
              excalidrawAPI={setExcalidrawAPI}
              initialData={{
                elements: currentPage.elements,
                appState: {
                  zoom: { value: zoomValue as NormalizedZoomValue },
                  scrollX: 0,
                  scrollY: 0,
                },
              }}
              onChange={handleChange}
              gridModeEnabled={false}
              disablePanZoom={true}
              UIOptions={{
                canvasActions: {
                  export: false,
                  loadScene: false,
                  saveAsImage: false,
                },
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
