import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Excalidraw, exportToCanvas, getCommonBounds } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, NormalizedZoomValue } from '@excalidraw/excalidraw/types/types';
import { Home, Play, X } from 'lucide-react';
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

// Sidebar thumbnail width in px; height follows the page aspect ratio.
const THUMB_WIDTH = 300;

// Composite a page onto a full-resolution PAGE_WIDTH x PAGE_HEIGHT canvas: a
// white sheet with the elements rendered by Excalidraw's real engine and placed
// at their scene coordinates. This is the single source of truth for both the
// download and the sidebar thumbnail, so the two can never drift apart.
//
// Elements live in scene coordinates; on the page the view is locked to scroll
// 0, so scene coords map directly onto the sheet. scrollX/scrollY are passed
// through only to correct for any residual live-canvas scroll on download.
async function compositePageCanvas(
  elements: unknown[],
  appState: unknown,
  files: Record<string, unknown> | undefined,
  scrollX = 0,
  scrollY = 0
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // White page background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  // exportToCanvas sizes its output to the bounds of the elements it actually
  // renders: internally it drops soft-deleted elements (kept in the scene for
  // undo history), empty text, and invisibly small elements. The placement
  // offset below must come from getCommonBounds over that SAME set — if it saw
  // e.g. a deleted element sitting above the visible content, the offset and
  // the canvas origin would disagree and the whole composite would shift.
  const drawable = (
    elements as Array<Record<string, unknown> & { type: string }>
  ).filter((el) => {
    if (el.isDeleted) return false;
    if (el.type === 'text' && !el.text) return false;
    if (Array.isArray(el.points)) return el.points.length >= 2;
    return el.width !== 0 || el.height !== 0;
  });
  const typedElements = drawable as unknown as Parameters<typeof exportToCanvas>[0]['elements'];

  if (drawable.length > 0) {
    const elemCanvas = await exportToCanvas({
      elements: typedElements,
      appState: appState as Parameters<typeof exportToCanvas>[0]['appState'],
      files: (files ?? null) as Parameters<typeof exportToCanvas>[0]['files'],
      exportPadding: 0,
    });

    if (elemCanvas.width > 0 && elemCanvas.height > 0) {
      // getCommonBounds returns [minX, minY, ...] in scene coordinates.
      const [minX, minY] = getCommonBounds(typedElements);
      ctx.drawImage(elemCanvas, Math.round(minX + scrollX), Math.round(minY + scrollY));
    }
  }

  return canvas;
}

// Render a page-shaped thumbnail. Built by downscaling the full-resolution page
// composite in one step, so the thumbnail is a pixel-exact miniature of the
// download (and therefore of the live canvas) rather than an independently
// positioned re-render that can drift. Returns a PNG data URL.
async function renderPageThumbnail(
  elements: unknown[],
  appState: unknown,
  files: Record<string, unknown> | undefined
): Promise<string> {
  const pageCanvas = await compositePageCanvas(elements, appState, files);

  const scale = THUMB_WIDTH / PAGE_WIDTH;
  const thumb = document.createElement('canvas');
  thumb.width = Math.round(PAGE_WIDTH * scale);
  thumb.height = Math.round(PAGE_HEIGHT * scale);
  const ctx = thumb.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(pageCanvas, 0, 0, thumb.width, thumb.height);

  return thumb.toDataURL('image/png');
}

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
  const [isSlideShow, setIsSlideShow] = useState(false);
  const [slideDataUrl, setSlideDataUrl] = useState<string | null>(null);
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
      debounce(async (elements: unknown[], files: Record<string, unknown>) => {
        const areElementsEqual = isEqual(pages[currentPageIndex].elements, elements);
        if (areElementsEqual) {
          return;
        }

        // Regenerate the thumbnail only here — i.e. after the user pauses on a
        // real commit (letter typed, shape added/moved), and only for the page
        // being edited. This is what stops the high-frequency preview redraws.
        const thumbnail = await renderPageThumbnail(
          elements,
          pages[currentPageIndex].appState,
          files
        );

        const newPages = cloneDeep(pages);
        newPages[currentPageIndex] = {
          elements: cloneDeep(elements),
          id: pages[currentPageIndex].id,
          appState: pages[currentPageIndex].appState,
          files: cloneDeep(files),
          thumbnail,
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

  // Lazily backfill a thumbnail for the active page if it doesn't have one yet
  // (e.g. notebooks created before thumbnails were persisted). Runs once per
  // page: generating a thumbnail sets `thumbnail`, so this won't re-fire.
  useEffect(() => {
    const page = pages[currentPageIndex];
    if (!page || page.thumbnail) return;
    const drawable = (page.elements as Array<{ isDeleted?: boolean }>).filter(
      (el) => !el.isDeleted
    );
    if (drawable.length === 0) return; // empty page: blank preview, nothing to render

    let cancelled = false;
    (async () => {
      const thumbnail = await renderPageThumbnail(page.elements, page.appState, page.files);
      if (cancelled) return;
      const newPages = cloneDeep(pages);
      newPages[currentPageIndex] = { ...newPages[currentPageIndex], thumbnail };
      onPagesChange(newPages);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIndex, pages[currentPageIndex]?.id, pages[currentPageIndex]?.thumbnail]);

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

  // Render the current page to a full-resolution image whenever the slideshow is
  // open or the page changes. Reuses the same 600x800 composite the download and
  // sidebar thumbnails are built from, so a slide is pixel-consistent with the
  // rest of the app. The thumbnail (already on the page) paints instantly while
  // this async render completes.
  useEffect(() => {
    if (!isSlideShow || !currentPage) return;
    let cancelled = false;
    setSlideDataUrl(currentPage.thumbnail ?? null);
    (async () => {
      const canvas = await compositePageCanvas(
        currentPage.elements,
        currentPage.appState,
        currentPage.files
      );
      if (cancelled) return;
      setSlideDataUrl(canvas.toDataURL('image/png'));
    })();
    return () => {
      cancelled = true;
    };
  }, [isSlideShow, currentPage]);

  // Slideshow keyboard navigation: arrows/space/page keys move between slides,
  // Escape exits. Only active while presenting. Modeled on the pan-blocking
  // capture handler above.
  useEffect(() => {
    if (!isSlideShow) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSlideShow(false);
      } else if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === 'PageDown' ||
        e.key === ' '
      ) {
        e.preventDefault();
        goToNextPage();
      } else if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowUp' ||
        e.key === 'PageUp'
      ) {
        e.preventDefault();
        goToPreviousPage();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSlideShow, goToNextPage, goToPreviousPage]);

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
      // Correct for any residual live-canvas scroll (the view is locked to 0).
      const appState = excalidrawAPIRef.current?.getAppState();
      const scrollX = appState?.scrollX ?? 0;
      const scrollY = appState?.scrollY ?? 0;

      // Same composite the sidebar thumbnail downscales, so download and preview
      // always agree with each other and with the live canvas.
      const pageCanvas = await compositePageCanvas(
        currentPage.elements,
        currentPage.appState,
        currentPage.files,
        scrollX,
        scrollY
      );

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
            <button
              onClick={() => setIsSlideShow(true)}
              className="p-2 rounded-full hover:bg-gray-100 flex-shrink-0"
              title="Start slideshow"
            >
              <Play className="w-5 h-5" />
            </button>
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
        currentPageNumber={currentPageIndex + 1}
        totalPages={pages.length}
        onPrevPage={goToPreviousPage}
        onNextPage={goToNextPage}
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

      {/* Main canvas. Page navigation lives in the sidebar (see the nav bar
          under the sidebar header) so nothing above the canvas can offset the
          page-height calculation or introduce a scroll. */}
      <div className="flex-1 flex">
        {/* A4 Canvas */}
        <div
          ref={canvasAreaRef}
          className="flex-1 flex items-center justify-center p-8 bg-gray-100"
        >
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
        </div>
      </div>

      {/* Presentation / slideshow overlay: full viewport, black letterbox borders.
          Navigate with arrow/space/page keys, Esc (or the X) to exit. */}
      {isSlideShow && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <button
            onClick={() => setIsSlideShow(false)}
            className="absolute top-4 right-4 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10"
            title="Exit slideshow (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
          {(slideDataUrl ?? currentPage?.thumbnail) && (
            <img
              src={slideDataUrl ?? currentPage?.thumbnail}
              alt={`Page ${currentPageIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />
          )}
          <div className="absolute bottom-4 text-white/70 text-sm select-none">
            Page {currentPageIndex + 1} of {pages.length}
          </div>
        </div>
      )}
    </div>
  );
}
