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
  // Layout Calculation Engine (Memoized)
  // ---------------------------------------------------------------------------
  const layout = useMemo(() => {
    // 1. Sort songs by date (essential for linear layout processing)
    const sortedSongs = [...songs].sort((a, b) =>
      new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
    );

    const positionedNodes: PositionedNode[] = [];

    // Layout Constants
    const X_COLLISION_THRESHOLD = 50; // Increased from 30 to better detect crowding
    const SEVERE_COLLISION_THRESHOLD = 5; // Trigger jitter when 5+ songs at same time

    // Define available vertical "slots" or "tracks" to organize crowded songs
    // Expanded from 12 to 24 slots for better distribution (15% to 85% height)
    const Y_SLOTS = [
      15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85,
      22, 27, 32, 37, 42, 47, 52, 57, 62, 67, 72, 77, 82
    ];

    sortedSongs.forEach((song) => {
      const dateParts = song.releaseDate.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);

      // Calculate Ideal X based STRICTLY on time
      const idealX = isNaN(year) ? 0 :
        ((year - START_YEAR) * pixelsPerYear) +
        ((Math.max(0, isNaN(month) ? 0 : month - 1) / 12) * pixelsPerYear) +
        TIMELINE_PADDING;

      // Calculate Ideal Y based on popularity (15-85 range, expanded)
      let finalY = 15 + (song.popularity / 100) * 70;
      let finalX = idealX;

      // Check collision with recently placed nodes
      const neighbors = positionedNodes.filter(n => Math.abs(n.x - idealX) < X_COLLISION_THRESHOLD);

      if (neighbors.length > 0) {
        // Find a Y slot that maximizes distance from neighbors
        let bestSlot = finalY;
        let maxMinDist = -1;

        // Try all predefined slots
        for (const slotY of Y_SLOTS) {
          // Calculate the minimum distance to any neighbor if we place it at this slotY
          let currentMinDist = 1000; // Start high
          for (const neighbor of neighbors) {
            const dist = Math.abs(neighbor.y - slotY);
            if (dist < currentMinDist) currentMinDist = dist;
          }

          if (currentMinDist > maxMinDist) {
            maxMinDist = currentMinDist;
            bestSlot = slotY;
          }
        }

        // If even the best slot is too close (< 5%), add a small random jitter
        if (maxMinDist < 5) {
          finalY = bestSlot + (Math.random() * 6 - 3);
        } else {
          finalY = bestSlot;
        }

        // SEVERE CROWDING: Add smart X-axis jitter (keeps time accuracy within ±20px)
        if (neighbors.length >= SEVERE_COLLISION_THRESHOLD) {
          const jitterIndex = neighbors.length;
          const jitter = ((jitterIndex % 3) - 1) * 15; // -15, 0, +15 cycle
          finalX = idealX + jitter;
        }
      }

      positionedNodes.push({
        song,
        x: finalX,
        y: finalY
      });
    });

    console.log('[Timeline Debug] Layout calculated:', {
      totalSongs: songs.length,
      positionedNodes: positionedNodes.length,
      sampleNode: positionedNodes[0]
    });

    return positionedNodes;
  }, [songs, pixelsPerYear]);

  // ---------------------------------------------------------------------------
  // Auto-Scroll to Searched Song
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (searchedSongId && containerRef.current) {
      // Find the ACTUAL calculated position of the song from layout
      const targetNode = layout.find(n => n.song.id === searchedSongId);

      if (targetNode) {
        // Center the node
        const halfScreen = window.innerWidth / 2;
        const targetScroll = targetNode.x - halfScreen;

        containerRef.current.scrollTo({
          left: targetScroll,
          behavior: 'smooth'
        });
      }
    }
  }, [searchedSongId, layout]); // Re-run if ID changes or Layout changes (zoom)

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
    // We base total width on the furthest node + padding, or the standard length, whichever is larger
    const maxNodeX = layout.length > 0 ? layout[layout.length - 1].x : 0;
    const standardWidth = (YEARS.length * pixelsPerYear) + (TIMELINE_PADDING * 2);
    return Math.max(standardWidth, maxNodeX + TIMELINE_PADDING);
  }, [pixelsPerYear, layout]);

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
          <div className="absolute bottom-[15%] w-full h-[1px] bg-gradient-to-r from-transparent via-neon-accent/20 to-transparent opacity-60 shadow-[0_0_15px_rgba(56,189,248,0.5)] blur-[0.5px]"></div>

          {/* Years */}
          {YEARS.map((marker) => {
            const leftPos = (marker.year - START_YEAR) * pixelsPerYear + TIMELINE_PADDING;
            return (
              <div
                key={marker.year}
                className="absolute h-full flex flex-col justify-end pb-8 group"
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
            return monthNames.map((month, idx) => {
              const monthFraction = idx / 12;
              const leftPos = ((yearMarker.year - START_YEAR) + monthFraction) * pixelsPerYear + TIMELINE_PADDING;

              return (
                <div
                  key={`${yearMarker.year}-${month}`}
                  className="absolute h-full flex flex-col justify-end pb-8"
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