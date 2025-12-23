import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { Song } from '../types';
import { TimelineNode } from './TimelineNode';
import { getYearsWithSongs, PIXELS_PER_YEAR, TIMELINE_PADDING } from '../constants';
import { Plus, Minus } from 'lucide-react';

// Unified zoom constants
const MIN_SCALE = 0.3;
const MAX_SCALE = 5.0;  // Max zoom: 500%
const DEFAULT_SCALE = 1.0;

interface TimelineProps {
  songs: Song[];
  currentlyPlayingId: string | null;
  onPlayToggle: (id: string) => void;
  searchedSongId: string | null;
}

interface PositionedNode {
  song: Song;
  x: number;
  y: number;
}

export const Timeline: React.FC<TimelineProps> = ({
  songs,
  currentlyPlayingId,
  onPlayToggle,
  searchedSongId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Unified scale factor (Excalidraw style) - affects both X and Y uniformly
  const [scale, setScale] = useState(DEFAULT_SCALE);

  // Limit songs to max 200 by random sampling (for performance)
  // Searched songs are always included; playing songs handled separately at render time
  const MAX_DISPLAY_SONGS = 200;
  const displayedSongs = useMemo(() => {
    // If already under limit, return all
    if (songs.length <= MAX_DISPLAY_SONGS) return songs;

    // Find searched song that must be included
    const searchedSong = searchedSongId ? songs.find(s => s.id === searchedSongId) : null;

    // Use a stable shuffle based on songs array length (not random each time)
    // This prevents re-shuffling when other state changes
    const shuffled = [...songs];
    const seed = songs.length;
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Deterministic pseudo-random based on seed and index
      const j = (seed * (i + 1) * 9301 + 49297) % 233280 % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Take first 200
    let result = shuffled.slice(0, MAX_DISPLAY_SONGS);

    // Ensure searched song is included
    if (searchedSong && !result.find(s => s.id === searchedSongId)) {
      result = [searchedSong, ...result.slice(0, MAX_DISPLAY_SONGS - 1)];
    }

    return result;
  }, [songs, searchedSongId]); // Note: currentlyPlayingId removed to prevent freeze

  // Compute dynamic start year based on earliest song
  const dynamicStartYear = useMemo(() => {
    if (songs.length === 0) return 2000;
    const earliestDate = songs.reduce((min, song) => {
      const date = new Date(song.releaseDate);
      return date < min ? date : min;
    }, new Date(songs[0].releaseDate));
    return earliestDate.getFullYear();
  }, [songs]);

  // Generate years dynamically based on songs
  const YEARS = useMemo(() => {
    const years = getYearsWithSongs(songs);
    console.log('[Timeline Debug] Years:', {
      songsCount: songs.length,
      yearsCount: years.length,
      dynamicStartYear,
      sampleYears: years.slice(0, 5)
    });
    return years;
  }, [songs, dynamicStartYear]);

  // Track scroll position for virtualization and fixed bottom timeline
  const [viewport, setViewport] = useState({ scrollLeft: 0, scrollTop: 0, width: 0, height: 0 });
  const scrollThrottleRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  // Update viewport on scroll (throttled)
  const updateViewport = () => {
    const container = containerRef.current;
    if (!container) return;
    setViewport({
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      width: container.clientWidth,
      height: container.clientHeight
    });
  };

  // Initialize viewport on mount
  useEffect(() => {
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // ---------------------------------------------------------------------------
  // Layout Calculation Engine (Memoized) - Non-Linear Density-Based X-Axis
  // Base layout is computed at scale=1, then scale is applied via CSS transform
  // ---------------------------------------------------------------------------

  // Pre-compute density per month for non-linear X scaling (scale-independent)
  const monthDensityData = useMemo(() => {
    const densityMap = new Map<string, number>(); // "YYYY-MM" -> count

    displayedSongs.forEach(song => {
      const dateParts = song.releaseDate.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) || 1;
      if (!isNaN(year)) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        densityMap.set(key, (densityMap.get(key) || 0) + 1);
      }
    });

    // Calculate cumulative X offsets based on density
    // Each month gets a base width, plus extra width proportional to density
    // Layout is computed at scale=1, transform applied later
    const BASE_MONTH_WIDTH = PIXELS_PER_YEAR / 12;
    const DENSITY_MULTIPLIER = 10; // Extra pixels per song in dense months

    const xOffsets = new Map<string, { start: number; width: number }>();
    let currentX = TIMELINE_PADDING;

    // Create offset for all months from dynamicStartYear to END_YEAR
    const END_YEAR = new Date().getFullYear();
    for (let year = dynamicStartYear; year <= END_YEAR; year++) {
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const count = densityMap.get(key) || 0;

        // Calculate width: base + extra for density (tiered)

        let extraWidth = 0;
        if (count > 3) {
          extraWidth += (Math.min(count, 20) - 3) * DENSITY_MULTIPLIER; // Tier 1: 4-20 songs
        }
        if (count > 10) {
          extraWidth += (count - 10) * 40; // Tier 2: 21+ songs get extra 20px each
        }
        if (count > 20) {
          extraWidth += (count - 20) * 80;
        }
        const width = BASE_MONTH_WIDTH + extraWidth;

        xOffsets.set(key, { start: currentX, width });
        currentX += width;
      }
    }

    return { densityMap, xOffsets, totalWidth: currentX + TIMELINE_PADDING };
  }, [displayedSongs, dynamicStartYear]); // Note: scale removed from dependencies

  const layout = useMemo(() => {
    const { densityMap, xOffsets } = monthDensityData;

    // 1. Sort songs by date
    const sortedSongs = [...displayedSongs].sort((a, b) =>
      new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
    );

    const positionedNodes: PositionedNode[] = [];

    // Track how many songs placed in each month for Y distribution
    const monthCounters = new Map<string, number>();

    sortedSongs.forEach((song) => {
      const dateParts = song.releaseDate.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) || 1;
      const day = parseInt(dateParts[2]) || 15; // Default to mid-month

      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const offset = xOffsets.get(monthKey);

      if (!offset) {
        // Fallback for songs outside range
        positionedNodes.push({
          song,
          x: TIMELINE_PADDING,
          y: 50
        });
        return;
      }

      // Calculate X position within the month's allocated space
      const dayFraction = (day - 1) / 30; // Normalize day to 0-1
      let finalX = offset.start + dayFraction * offset.width;

      // Get density for Y distribution
      const localDensity = densityMap.get(monthKey) || 1;
      const monthIndex = monthCounters.get(monthKey) || 0;
      monthCounters.set(monthKey, monthIndex + 1);

      // Minimum spacing requirements
      const MIN_Y_SPACING = 8;
      const MIN_X_SPACING = 20;

      // Calculate Y with varied distribution - avoid horizontal lines
      let finalY: number;

      // Use multiple factors for Y position to create natural scatter:
      // 1. Base from popularity (provides some order)
      // 2. Golden angle offset based on song index for variety
      // 3. Hash-based micro-offset for uniqueness

      // Expanded range: 8-88% based on popularity (was 15-75%)
      const popularityY = 8 + (song.popularity / 100) * 80;

      // Golden angle creates natural-looking spiral distribution
      const goldenAngle = 137.508;
      const globalIndex = positionedNodes.length;
      // Increased offset range: ±20% (was ±15%)
      const goldenOffset = ((globalIndex * goldenAngle) % 360) / 360 * 40 - 20;

      // Hash based on song name for consistent but varied positioning
      const hash = (song.title.charCodeAt(0) || 0) + (song.artist.charCodeAt(0) || 0);
      // Increased offset: ±15% (was ±10%)
      const hashOffset = (hash % 30) - 15;

      // Combine all factors
      finalY = popularityY + goldenOffset + hashOffset;

      // Expanded clamp range: 5-95% (was 10-90%)
      finalY = Math.max(5, Math.min(95, finalY));

      // For dense months, add extra X spreading
      if (localDensity > 3) {
        const spreadFactor = Math.min(localDensity, 15) / 15;
        const xSpread = offset.width * 0.8 * spreadFactor;
        const xOffset = ((monthIndex % 5) - 2) * (xSpread / 5);
        finalX = offset.start + offset.width * 0.1 + (monthIndex / localDensity) * offset.width * 0.8 + xOffset * 0.3;
      }

      // Collision detection
      let attempts = 0;
      while (attempts < 15) {
        const overlapping = positionedNodes.find(n =>
          Math.abs(n.x - finalX) < MIN_X_SPACING && Math.abs(n.y - finalY) < MIN_Y_SPACING
        );

        if (!overlapping) break;

        const angle = attempts * 137.508 * (Math.PI / 180);
        const radius = 5 + attempts * 3;

        finalY = Math.max(8, Math.min(92, finalY + Math.sin(angle) * radius * 0.8));
        finalX = finalX + Math.cos(angle) * radius * 0.3;
        attempts++;
      }

      positionedNodes.push({
        song,
        x: finalX,
        y: finalY
      });
    });

    console.log('[Timeline] Non-linear layout:', {
      totalSongs: songs.length,
      totalWidth: monthDensityData.totalWidth,
      positionedNodes: positionedNodes.length
    });

    return positionedNodes;
  }, [displayedSongs, monthDensityData]);

  // ---------------------------------------------------------------------------
  // Auto-Scroll to Searched Song
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (searchedSongId && containerRef.current) {
      // Find the ACTUAL calculated position of the song from layout
      const targetNode = layout.find(n => n.song.id === searchedSongId);

      if (targetNode) {
        const container = containerRef.current;

        // Half screen dimensions for centering
        const halfScreenX = container.clientWidth / 2;
        const halfScreenY = container.clientHeight / 2;

        // Target position in scaled coordinates
        // X is straightforward
        const scaledX = targetNode.x * scale;

        // Y: targetNode.y is bottom percentage (0-100), convert to top-based position
        // In scaled content, total height is 100vh * scale
        // Node at bottom=y% means it's at (100-y)% from top
        const contentHeight = container.clientHeight * scale;
        const nodeTopPercent = (100 - targetNode.y) / 100;
        const scaledY = nodeTopPercent * contentHeight;

        const targetScrollX = scaledX - halfScreenX;
        const targetScrollY = scaledY - halfScreenY;

        container.scrollTo({
          left: Math.max(0, targetScrollX),
          top: Math.max(0, targetScrollY),
          behavior: 'smooth'
        });
      }
    }
  }, [searchedSongId, layout, scale]); // Re-run if ID changes, Layout changes, or scale changes

  // Track scale in ref for immediate access in wheel handler
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Calculate total width early for zoom useEffect
  const totalWidth = useMemo(() => {
    return monthDensityData.totalWidth;
  }, [monthDensityData]);

  // Content container ref for direct DOM manipulation
  const contentRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  // Debounced scale sync to React state (to avoid re-render during zoom)
  const syncScaleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncScaleToReact = (newScale: number) => {
    if (syncScaleTimeoutRef.current) {
      clearTimeout(syncScaleTimeoutRef.current);
    }
    syncScaleTimeoutRef.current = setTimeout(() => {
      setScale(newScale);
    }, 100); // Sync after 100ms of no zoom activity
  };

  // ---------------------------------------------------------------------------
  // Unified Zoom Logic (Excalidraw style): Ctrl+Scroll = zoom centered on mouse
  // Uses direct DOM manipulation for instant, jitter-free zoom
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const container = containerRef.current;
      const content = contentRef.current;
      const outer = outerRef.current;
      if (!container || !content || !outer) return;

      // Command/Ctrl + Scroll = Unified zoom centered on mouse position
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();

        const rect = container.getBoundingClientRect();

        // Mouse position relative to container viewport (like Excalidraw's viewportX/Y)
        const mouseViewportX = e.clientX - rect.left;
        const mouseViewportY = e.clientY - rect.top;

        // Current scroll position
        const scrollX = container.scrollLeft;
        const scrollY = container.scrollTop;

        // Mouse position in scaled content space
        const mouseInContentX = scrollX + mouseViewportX;
        const mouseInContentY = scrollY + mouseViewportY;

        // Mouse position in base (unscaled) space
        const oldScale = scaleRef.current;
        const mouseBaseX = mouseInContentX / oldScale;
        const mouseBaseY = mouseInContentY / oldScale;

        // Calculate new scale
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * zoomFactor));

        if (newScale !== oldScale) {
          // Update scale ref immediately
          scaleRef.current = newScale;

          // Calculate new mouse position in scaled space
          const newMouseInContentX = mouseBaseX * newScale;
          const newMouseInContentY = mouseBaseY * newScale;

          // Calculate scroll to keep mouse position fixed (Excalidraw formula)
          const newScrollX = newMouseInContentX - mouseViewportX;
          const newScrollY = newMouseInContentY - mouseViewportY;

          // Apply CSS transform directly (no React re-render)
          content.style.transform = `scale(${newScale})`;

          // Update outer container size for scrollbars
          outer.style.width = `${totalWidth * newScale}px`;
          outer.style.height = `calc(100vh * ${newScale})`;
          outer.style.minHeight = `calc(100vh * ${newScale})`;

          // Apply scroll in same frame
          container.scrollLeft = Math.max(0, newScrollX);
          container.scrollTop = Math.max(0, newScrollY);

          // Debounced sync to React state (for zoom indicator etc)
          syncScaleToReact(newScale);
        }
      }
      // Regular Scroll = Normal scroll behavior
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [totalWidth]);


  // ---------------------------------------------------------------------------
  // Dragging Logic - using refs for immediate response
  // ---------------------------------------------------------------------------
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    dragState.current.isDragging = true;
    dragState.current.startX = e.clientX;
    dragState.current.startY = e.clientY;
    dragState.current.scrollLeft = containerRef.current?.scrollLeft || 0;
    dragState.current.scrollTop = containerRef.current?.scrollTop || 0;
  };

  const handleMouseLeave = () => {
    dragState.current.isDragging = false;
  };

  const handleMouseUp = () => {
    dragState.current.isDragging = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle dragging - direct DOM manipulation for instant response
    if (!dragState.current.isDragging || !containerRef.current) return;
    e.preventDefault();

    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;

    containerRef.current.scrollLeft = dragState.current.scrollLeft - dx;
    containerRef.current.scrollTop = dragState.current.scrollTop - dy;
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const handleZoomIn = () => setScale(s => Math.min(MAX_SCALE, s * 1.2));
  const handleZoomOut = () => setScale(s => Math.max(MIN_SCALE, s / 1.2));

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full overflow-x-auto overflow-y-auto no-scrollbar relative cursor-grab active:cursor-grabbing select-none bg-transparent"
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onScroll={() => {
          // Throttle scroll updates using requestAnimationFrame
          if (scrollThrottleRef.current) return;
          scrollThrottleRef.current = requestAnimationFrame(() => {
            updateViewport();
            scrollThrottleRef.current = null;
          });
        }}
      >
        {/* Scaled Content Container - uses CSS transform for smooth zoom */}
        <div
          ref={outerRef}
          style={{
            width: `${totalWidth * scale}px`,
            height: `calc(100vh * ${scale})`,
            minHeight: `calc(100vh * ${scale})`,
            position: 'relative'
          }}
        >
          {/* Inner content with transform origin at top-left */}
          <div
            ref={contentRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${totalWidth}px`,
              height: '100vh',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          >
            {/* Background Grid/Atmosphere */}
            <div
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            >
              {/* Horizon */}
              <div className="absolute bottom-[5%] w-full h-[1px] bg-gradient-to-r from-transparent via-neon-accent/20 to-transparent opacity-60 shadow-[0_0_15px_rgba(56,189,248,0.5)] blur-[0.5px]"></div>

              {/* Years */}
              {YEARS.map((marker) => {
                // Get position from density-based layout (January of this year)
                const monthKey = `${marker.year}-01`;
                const offset = monthDensityData.xOffsets.get(monthKey);
                const leftPos = offset ? offset.start : TIMELINE_PADDING;
                return (
                  <div
                    key={marker.year}
                    className="absolute h-full flex flex-col justify-end pb-2 group"
                    style={{ left: `${leftPos}px` }}
                  >
                    <div className="h-[80%] w-[1px] bg-gradient-to-t from-slate-500/20 via-slate-500/5 to-transparent group-hover:from-neon-accent/30 transition-colors duration-700"></div>
                    <span className="
                      font-mono text-6xl font-bold mt-4 -translate-x-1/2 select-none 
                      text-slate-200/5 
                      group-hover:text-neon-accent/20 
                      drop-shadow-[0_0_5px_rgba(255,255,255,0.1)] 
                      group-hover:drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]
                      transition-all duration-700
                    ">
                      {marker.label}
                    </span>
                  </div>
                );
              })}

              {/* Month Markers (shown when zoomed in) */}
              {scale > 1.5 && YEARS.map((yearMarker) => {
                const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
                return monthNames.map((month) => {
                  const monthKey = `${yearMarker.year}-${month}`;
                  const offset = monthDensityData.xOffsets.get(monthKey);
                  const leftPos = offset ? offset.start : TIMELINE_PADDING;

                  return (
                    <div
                      key={`${yearMarker.year}-${month}`}
                      className="absolute h-full flex flex-col justify-end pb-2"
                      style={{ left: `${leftPos}px` }}
                    >
                      <div className="h-[60%] w-[1px] bg-gradient-to-t from-slate-600/10 via-slate-600/5 to-transparent"></div>
                      <span className="
                        font-mono text-xs font-normal mt-2 -translate-x-1/2 select-none 
                        text-slate-400/20
                      ">
                        {month}
                      </span>
                    </div>
                  );
                });
              })}
            </div>

            {/* Nodes Layer - Virtualization temporarily disabled for debugging */}
            <div className="relative w-full h-full">
              {layout.map((node) => (
                <TimelineNode
                  key={node.song.id}
                  song={node.song}
                  currentlyPlayingId={currentlyPlayingId}
                  onPlayToggle={onPlayToggle}
                  x={node.x}
                  y={node.y}
                  isSearched={node.song.id === searchedSongId}
                  zoomLevel={scale}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Timeline Bar - Always visible, syncs with horizontal scroll */}
      <div
        className="fixed bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent z-40 pointer-events-none"
      >
        <div
          className="absolute bottom-0 left-0 h-full"
          style={{
            width: `${totalWidth * scale}px`,
            transform: `translateX(${-viewport.scrollLeft}px)`
          }}
        >
          <div
            style={{
              transform: `scaleX(${scale})`,
              transformOrigin: 'left',
              width: `${totalWidth}px`,
              height: '100%',
              position: 'relative'
            }}
          >
            {/* Year Labels */}
            {YEARS.map((marker) => {
              const monthKey = `${marker.year}-01`;
              const offset = monthDensityData.xOffsets.get(monthKey);
              const leftPos = offset ? offset.start : TIMELINE_PADDING;
              return (
                <div
                  key={marker.year}
                  className="absolute bottom-2 -translate-x-1/2"
                  style={{ left: `${leftPos}px` }}
                >
                  <span className="font-mono text-sm font-medium text-slate-400/80 select-none">
                    {marker.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Gradient overlay for fade effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-slate-950 pointer-events-none" />
      </div>

      {/* Zoom Controls */}
      <div className="fixed bottom-24 left-6 z-50 flex flex-col items-center gap-2 bg-slate-900/50 backdrop-blur-md p-2 rounded-full border border-slate-700 shadow-xl group hover:bg-slate-900/80 transition-colors">
        <button
          onClick={handleZoomIn}
          className="p-2 text-slate-400 hover:text-neon-accent transition-colors rounded-full hover:bg-white/5"
          title="Zoom In"
        >
          <Plus size={20} />
        </button>

        <div className="relative h-24 w-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute bottom-0 left-0 w-full bg-neon-accent/50 transition-all duration-300"
            style={{
              height: `${((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100}%`
            }}
          />
        </div>

        {/* Scale indicator */}
        <div className="text-[10px] text-slate-400 font-mono">
          {Math.round(scale * 100)}%
        </div>

        <button
          onClick={handleZoomOut}
          className="p-2 text-slate-400 hover:text-neon-accent transition-colors rounded-full hover:bg-white/5"
          title="Zoom Out"
        >
          <Minus size={20} />
        </button>

        {/* Operation Guide Tooltip */}
        <div className="absolute left-full ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg p-3 shadow-2xl">
            <div className="text-slate-200 text-xs font-semibold mb-2">操作指南</div>
            <div className="space-y-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">
                  {navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}
                </kbd>
                <span>+ 滚轮 → 缩放 (以鼠标为中心)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 text-center">🖱️</span>
                <span>滚轮 → 滚动页面</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 text-center">🖱️</span>
                <span>拖动 → 移动视图</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};