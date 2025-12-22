import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { Song } from '../types';
import { TimelineNode } from './TimelineNode';
import { getYearsWithSongs, PIXELS_PER_YEAR, MIN_PIXELS_PER_YEAR, MAX_PIXELS_PER_YEAR, TIMELINE_PADDING, START_YEAR } from '../constants';
import { Plus, Minus } from 'lucide-react';

interface TimelineProps {
  songs: Song[];
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
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
  setCurrentlyPlayingId,
  searchedSongId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerYear, setPixelsPerYear] = useState(PIXELS_PER_YEAR);
  const [yAxisScale, setYAxisScale] = useState(1); // Y-axis zoom scale (1 = normal)

  // Generate years dynamically based on songs
  const YEARS = useMemo(() => {
    const years = getYearsWithSongs(songs);
    console.log('[Timeline Debug] Years:', {
      songsCount: songs.length,
      yearsCount: years.length,
      sampleYears: years.slice(0, 5)
    });
    return years;
  }, [songs]);

  // Dragging state (supports both horizontal and vertical)
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // Mouse position for magnetic repulsion effect
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);

  // ---------------------------------------------------------------------------
  // Layout Calculation Engine (Memoized) - Non-Linear Density-Based X-Axis
  // ---------------------------------------------------------------------------

  // Pre-compute density per month for non-linear X scaling
  const monthDensityData = useMemo(() => {
    const densityMap = new Map<string, number>(); // "YYYY-MM" -> count

    songs.forEach(song => {
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
    const BASE_MONTH_WIDTH = pixelsPerYear / 12;
    const DENSITY_MULTIPLIER = 10; // Extra pixels per song in dense months

    const xOffsets = new Map<string, { start: number; width: number }>();
    let currentX = TIMELINE_PADDING;

    // Create offset for all months from START_YEAR to END_YEAR
    const END_YEAR = new Date().getFullYear();
    for (let year = START_YEAR; year <= END_YEAR; year++) {
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const count = densityMap.get(key) || 0;

        // Calculate width: base + extra for density (tiered)
        // Tier 1: > 3 songs: +8px per song
        // Tier 2: > 20 songs: +20px per song (additional)
        let extraWidth = 0;
        if (count > 3) {
          extraWidth += (Math.min(count, 20) - 3) * DENSITY_MULTIPLIER; // Tier 1: 4-20 songs
        }
        if (count > 10) {
          extraWidth += (count - 10) * 20; // Tier 2: 21+ songs get extra 20px each
        }
        if (count > 20) {
          extraWidth += (count - 20) * 40;
        }
        const width = BASE_MONTH_WIDTH + extraWidth;

        xOffsets.set(key, { start: currentX, width });
        currentX += width;
      }
    }

    return { densityMap, xOffsets, totalWidth: currentX + TIMELINE_PADDING };
  }, [songs, pixelsPerYear]);

  const layout = useMemo(() => {
    const { densityMap, xOffsets } = monthDensityData;

    // 1. Sort songs by date
    const sortedSongs = [...songs].sort((a, b) =>
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

      const popularityY = 15 + (song.popularity / 100) * 60; // 15-75% based on popularity

      // Golden angle creates natural-looking spiral distribution
      const goldenAngle = 137.508;
      const globalIndex = positionedNodes.length;
      const goldenOffset = ((globalIndex * goldenAngle) % 360) / 360 * 30 - 15; // ±15% offset

      // Hash based on song name for consistent but varied positioning
      const hash = (song.title.charCodeAt(0) || 0) + (song.artist.charCodeAt(0) || 0);
      const hashOffset = (hash % 20) - 10; // ±10% offset

      // Combine all factors
      finalY = popularityY + goldenOffset + hashOffset;

      // Clamp to valid range (10-90%)
      finalY = Math.max(10, Math.min(90, finalY));

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
  }, [songs, monthDensityData]);

  // ---------------------------------------------------------------------------
  // Auto-Scroll to Searched Song
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (searchedSongId && containerRef.current) {
      // Find the ACTUAL calculated position of the song from layout
      const targetNode = layout.find(n => n.song.id === searchedSongId);

      if (targetNode) {
        const container = containerRef.current;

        // Center horizontally
        const halfScreenX = window.innerWidth / 2;
        const targetScrollX = targetNode.x - halfScreenX;

        // Center vertically - account for Y-axis scaling
        const containerHeight = container.clientHeight;
        const scaledContentHeight = containerHeight * yAxisScale;
        const halfScreenY = containerHeight / 2;

        // Convert percentage Y (0-100) to actual pixel position
        const actualY = (targetNode.y / 100) * scaledContentHeight;
        const targetScrollY = actualY - halfScreenY;

        container.scrollTo({
          left: Math.max(0, targetScrollX),
          top: Math.max(0, targetScrollY),
          behavior: 'smooth'
        });
      }
    }
  }, [searchedSongId, layout, yAxisScale]); // Re-run if ID changes, Layout changes, or Y scale changes

  // ---------------------------------------------------------------------------
  // Zoom Logic: Command+Scroll for horizontal, Shift+Scroll for vertical, Scroll for page scroll
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Command/Ctrl + Scroll = Horizontal timeline zoom
      if (e.metaKey || e.ctrlKey) {
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        setPixelsPerYear(p => Math.min(MAX_PIXELS_PER_YEAR, Math.max(MIN_PIXELS_PER_YEAR, p * zoomFactor)));
      }
      // Shift + Scroll = Vertical (Y-axis) zoom
      // Note: Some browsers convert Shift+Scroll's deltaY to deltaX
      else if (e.shiftKey) {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        setYAxisScale(s => {
          const newScale = Math.min(3, Math.max(0.5, s * zoomFactor));
          console.log('[Y-Axis Zoom]', { deltaX: e.deltaX, deltaY: e.deltaY, delta, zoomFactor, oldScale: s, newScale });
          return newScale;
        });
      }
      // Regular Scroll = Vertical scroll (default browser behavior)
      else {
        const container = containerRef.current;
        if (container) {
          container.scrollTop += e.deltaY;
        }
      }
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
  }, []);

  // Preserve scroll center on zoom
  const prevPixelsPerYear = useRef(pixelsPerYear);
  useEffect(() => {
    if (containerRef.current && prevPixelsPerYear.current !== pixelsPerYear) {
      const container = containerRef.current;
      const centerRatio = (container.scrollLeft + container.clientWidth / 2) / ((YEARS.length * prevPixelsPerYear.current) + TIMELINE_PADDING * 2);

      const newTotalWidth = (YEARS.length * pixelsPerYear) + TIMELINE_PADDING * 2;
      const newScrollLeft = (centerRatio * newTotalWidth) - (container.clientWidth / 2);

      container.scrollLeft = newScrollLeft;
      prevPixelsPerYear.current = pixelsPerYear;
    }
  }, [pixelsPerYear]);


  // ---------------------------------------------------------------------------
  // Dragging Logic
  // ---------------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (containerRef.current?.offsetLeft || 0));
    setStartY(e.pageY - (containerRef.current?.offsetTop || 0));
    setScrollLeft(containerRef.current?.scrollLeft || 0);
    setScrollTop(containerRef.current?.scrollTop || 0);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update mouse position for repulsion effect (relative to container)
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + containerRef.current.scrollLeft;
      const y = e.clientY - rect.top + containerRef.current.scrollTop;
      setMousePos({ x, y });
    }

    // Handle dragging (both horizontal and vertical)
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (containerRef.current?.offsetLeft || 0);
    const y = e.pageY - (containerRef.current?.offsetTop || 0);
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollLeft - walkX;
      containerRef.current.scrollTop = scrollTop - walkY;
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const totalWidth = useMemo(() => {
    // Use density-based total width
    return monthDensityData.totalWidth;
  }, [monthDensityData]);

  const handleZoomIn = () => setPixelsPerYear(p => Math.min(MAX_PIXELS_PER_YEAR, p + 200));
  const handleZoomOut = () => setPixelsPerYear(p => Math.max(MIN_PIXELS_PER_YEAR, p - 200));

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full overflow-x-auto overflow-y-auto no-scrollbar relative cursor-grab active:cursor-grabbing select-none bg-transparent"
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {/* Background Grid/Atmosphere */}
        <div
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            width: `${totalWidth}px`,
            height: `${100 * yAxisScale}%`,
            minHeight: '100%'
          }}
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
          {pixelsPerYear > 600 && YEARS.map((yearMarker) => {
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

        {/* Nodes Layer - Wrapped in scalable container */}
        <div
          className="relative"
          style={{
            width: `${totalWidth}px`,
            height: `${100 * yAxisScale}%`,
            minHeight: '100%'
          }}
        >
          {layout.map((node) => (
            <TimelineNode
              key={node.song.id}
              song={node.song}
              currentlyPlayingId={currentlyPlayingId}
              setCurrentlyPlayingId={setCurrentlyPlayingId}
              x={node.x}
              y={node.y} // Keep original Y percentage, scaling is done via container height
              mousePos={mousePos}
              containerHeight={(containerRef.current?.clientHeight || 0) * yAxisScale}
              isSearched={node.song.id === searchedSongId}
            />
          ))}
        </div>
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
              height: `${((pixelsPerYear - MIN_PIXELS_PER_YEAR) / (MAX_PIXELS_PER_YEAR - MIN_PIXELS_PER_YEAR)) * 100}%`
            }}
          />
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
                <span>+ 滚轮 → 时间轴缩放</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">⇧</kbd>
                <span>+ 滚轮 → Y轴缩放</span>
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