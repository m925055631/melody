import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { Song } from '../types';
import { TimelineNode } from './TimelineNode';
import { getYearsWithSongs, PIXELS_PER_YEAR, TIMELINE_PADDING } from '../constants';
import { Plus, Minus } from 'lucide-react';

interface TimelineProps {
  songs: Song[];
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  searchedSongId: string | null;
  onRefreshUrl?: (songId: string) => Promise<string | null>;
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
  searchedSongId,
  onRefreshUrl
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixelsPerYear = PIXELS_PER_YEAR; // Fixed zoom level
  const [yAxisScale, setYAxisScale] = useState(1); // Y-axis zoom scale (1 = normal)
  const [scrollX, setScrollX] = useState(0); // Track horizontal scroll for fixed timeline

  // Generate years dynamically based on songs
  const YEARS = useMemo(() => {
    const years = getYearsWithSongs(songs);
    // console.log('[Timeline Debug] Years:', {
    //   songsCount: songs.length,
    //   yearsCount: years.length,
    //   sampleYears: years.slice(0, 5)
    // });
    return years;
  }, [songs]);

  // Dragging state (supports both horizontal and vertical)
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

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

    // Use dynamic year range from YEARS instead of hardcoded START_YEAR
    const startYear = YEARS.length > 0 ? YEARS[0].year : new Date().getFullYear();
    const endYear = YEARS.length > 0 ? YEARS[YEARS.length - 1].year : new Date().getFullYear();

    for (let year = startYear; year <= endYear; year++) {
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
  }, [songs, pixelsPerYear, YEARS]);

  const layout = useMemo(() => {
    const { densityMap, xOffsets } = monthDensityData;

    // 1. Sort songs by date
    const sortedSongs = [...songs].sort((a, b) =>
      new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
    );

    const positionedNodes: PositionedNode[] = [];

    // Track how many songs placed in each month for Y distribution
    const monthCounters = new Map<string, number>();

    sortedSongs.forEach((song, songIndex) => {
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

      // **Popularity-based Y positioning**
      // Higher popularity = higher Y (appears at top since Y is bottom-based %)
      // Map popularity (0-100) to Y range (15-85)
      const MIN_Y = 15;
      const MAX_Y = 85;
      const Y_RANGE = MAX_Y - MIN_Y;

      // Base Y from popularity (higher popularity = higher Y position)
      const popularityNormalized = Math.min(100, Math.max(0, song.popularity)) / 100;
      const baseY = MIN_Y + popularityNormalized * Y_RANGE;

      // Add small random jitter to prevent exact overlaps for same popularity
      const randomSeed = (song.title.charCodeAt(0) || 0) + (song.artist.charCodeAt(0) || 0) + songIndex;
      const pseudoRandom = (Math.sin(randomSeed) + 1) / 2;
      const jitter = (pseudoRandom - 0.5) * 8; // ±4% jitter

      let finalY = baseY + jitter;

      // Clamp to valid range (10-90%)
      finalY = Math.max(10, Math.min(90, finalY));

      // For dense months, add extra X spreading
      if (localDensity > 3) {
        const spreadFactor = Math.min(localDensity, 15) / 15;
        const xSpread = offset.width * 0.8 * spreadFactor;
        const xOffset = ((monthIndex % 5) - 2) * (xSpread / 5);
        finalX = offset.start + offset.width * 0.1 + (monthIndex / localDensity) * offset.width * 0.8 + xOffset * 0.3;
      }

      // Collision detection with improved attempts
      let attempts = 0;
      while (attempts < 20) {
        const overlapping = positionedNodes.find(n =>
          Math.abs(n.x - finalX) < MIN_X_SPACING && Math.abs(n.y - finalY) < MIN_Y_SPACING
        );

        if (!overlapping) break;

        const angle = attempts * 137.508 * (Math.PI / 180);
        const radius = 4 + attempts * 2.5;

        finalY = Math.max(10, Math.min(90, finalY + Math.sin(angle) * radius * 0.6));
        finalX = finalX + Math.cos(angle) * radius * 0.4;
        attempts++;
      }

      positionedNodes.push({
        song,
        x: finalX,
        y: finalY
      });
    });

    // console.log('[Timeline] Uniform Y-axis layout:', {
    //   totalSongs: songs.length,
    //   totalWidth: monthDensityData.totalWidth,
    //   positionedNodes: positionedNodes.length,
    //   bandDistribution: bandCounters
    // });

    return positionedNodes;
  }, [songs, monthDensityData]);

  // ---------------------------------------------------------------------------
  // Auto-Scroll to Searched Song
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (searchedSongId) {
      console.log('[Timeline Auto-Scroll] Triggered for:', searchedSongId);
      if (containerRef.current) {
        // Find the ACTUAL calculated position of the song from layout
        const targetNode = layout.find(n => n.song.id === searchedSongId);

        console.log('[Timeline Auto-Scroll] Target node found:', !!targetNode, targetNode);

        if (targetNode) {
          const container = containerRef.current;

          // Center horizontally
          const halfScreenX = window.innerWidth / 2;
          const targetScrollX = targetNode.x - halfScreenX;

          // Center vertically - account for Y-axis scaling
          const containerHeight = container.clientHeight;
          const scaledContentHeight = containerHeight * yAxisScale;
          const halfScreenY = containerHeight / 2;

          // Node is positioned from bottom (bottom: y%)
          // Convert to top position: (100 - y)% from top
          const topPercent = 100 - targetNode.y;
          const actualY = (topPercent / 100) * scaledContentHeight;
          const targetScrollY = actualY - halfScreenY;

          console.log('[Timeline Auto-Scroll] Scrolling to:', { x: targetScrollX, y: targetScrollY });

          container.scrollTo({
            left: Math.max(0, targetScrollX),
            top: Math.max(0, targetScrollY),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [searchedSongId, layout, yAxisScale]); // Re-run if ID changes, Layout changes, or Y scale changes

  // ---------------------------------------------------------------------------
  // Initial Scroll to Year 2000 (Only Once - After Songs are Loaded)
  // ---------------------------------------------------------------------------
  const hasInitialScrolledRef = useRef(false);

  useEffect(() => {
    // Only scroll once songs are loaded and we haven't scrolled yet
    if (!hasInitialScrolledRef.current && containerRef.current && songs.length > 0) {
      const container = containerRef.current;

      // Try to find year 2000 position from density data
      const targetYear = 2000;
      const monthKey = `${targetYear}-01`;
      const offset = monthDensityData.xOffsets.get(monthKey);

      if (offset) {
        // If we have songs from 2000, scroll to that position
        const targetScrollX = offset.start - window.innerWidth / 3;

        setTimeout(() => {
          container.scrollTo({
            left: Math.max(0, targetScrollX),
            top: 0,
            behavior: 'smooth'
          });
          hasInitialScrolledRef.current = true;
          console.log(`Initial scroll to year ${targetYear} at x=${offset.start}`);
        }, 200); // Slightly longer delay to ensure layout is ready
      } else if (YEARS.length > 0) {
        // If no 2000, but we have other years, find the closest year or scroll to middle
        const startYear = YEARS[0].year;
        const endYear = YEARS[YEARS.length - 1].year;

        // Scroll to the middle of the timeline if 2000 is not in range
        const middleYear = Math.floor((startYear + endYear) / 2);
        const middleMonthKey = `${middleYear}-01`;
        const middleOffset = monthDensityData.xOffsets.get(middleMonthKey);

        const targetX = middleOffset
          ? middleOffset.start - window.innerWidth / 3
          : TIMELINE_PADDING + ((middleYear - startYear) * pixelsPerYear) - window.innerWidth / 3;

        setTimeout(() => {
          container.scrollTo({
            left: Math.max(0, targetX),
            top: 0,
            behavior: 'smooth'
          });
          hasInitialScrolledRef.current = true;
          console.log(`Initial scroll to middle year ${middleYear}`);
        }, 200);
      }
    }
  }, [monthDensityData, YEARS, songs.length, pixelsPerYear]); // Added songs.length as dependency

  // ---------------------------------------------------------------------------
  // Zoom Logic: Ctrl/Cmd+Scroll for Y-axis zoom, Regular scroll for page scroll
  // X-axis zoom disabled
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Command/Ctrl + Scroll = Vertical (Y-axis) zoom
      if (e.metaKey || e.ctrlKey) {
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        setYAxisScale(s => {
          const newScale = Math.min(3, Math.max(0.5, s * zoomFactor));
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

  // Track horizontal scroll position for fixed timeline
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollX(container.scrollLeft);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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

  const handleZoomIn = () => setYAxisScale(s => Math.min(3, s + 0.2));
  const handleZoomOut = () => setYAxisScale(s => Math.max(0.5, s - 0.2));

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
          {(() => {
            // Calculate adjusted Y positions with collision avoidance when zoomed
            // Group nodes by X proximity (within 20px are considered same column)
            const X_THRESHOLD = 30;
            const sortedNodes = [...layout].sort((a, b) => a.x - b.x);

            // Create groups of overlapping nodes
            const groups: typeof layout[] = [];
            let currentGroup: typeof layout = [];

            for (const node of sortedNodes) {
              if (currentGroup.length === 0) {
                currentGroup.push(node);
              } else {
                const lastNode = currentGroup[currentGroup.length - 1];
                if (Math.abs(node.x - lastNode.x) < X_THRESHOLD) {
                  currentGroup.push(node);
                } else {
                  groups.push(currentGroup);
                  currentGroup = [node];
                }
              }
            }
            if (currentGroup.length > 0) {
              groups.push(currentGroup);
            }

            // Calculate final Y positions
            const adjustedPositions = new Map<string, number>();

            for (const group of groups) {
              if (group.length === 1) {
                // Single node - keep original Y, no aggressive spreading
                const node = group[0];
                adjustedPositions.set(node.song.id, node.y);
              } else {
                // Multiple nodes in same column - spread them evenly within bounds
                // Sort by original Y position
                const sortedByY = [...group].sort((a, b) => a.y - b.y);

                // Calculate available Y range (15-85 to avoid edge clustering)
                const MIN_Y = 15;
                const MAX_Y = 85;
                const availableRange = MAX_Y - MIN_Y;

                // Calculate spacing - distribute evenly across available range
                // At zoom 1, use less spacing; at higher zoom, use more
                const spacingMultiplier = 1 + (yAxisScale - 1) * 0.3; // Gentle increase
                const idealSpacing = (availableRange / (sortedByY.length + 1)) * spacingMultiplier;
                const actualSpacing = Math.min(idealSpacing, 15 * yAxisScale); // Cap spacing

                // Calculate total height needed
                const totalHeight = actualSpacing * (sortedByY.length - 1);

                // Center the group around the average Y position, keeping within bounds
                const avgY = sortedByY.reduce((sum, n) => sum + n.y, 0) / sortedByY.length;
                let startY = avgY - totalHeight / 2;

                // Adjust if exceeding bounds
                if (startY < MIN_Y) startY = MIN_Y;
                if (startY + totalHeight > MAX_Y) startY = MAX_Y - totalHeight;

                sortedByY.forEach((node, index) => {
                  const newY = startY + index * actualSpacing;
                  adjustedPositions.set(node.song.id, Math.max(MIN_Y, Math.min(MAX_Y, newY)));
                });
              }
            }

            return layout.map((node) => {
              const finalY = adjustedPositions.get(node.song.id) ?? node.y;

              return (
                <TimelineNode
                  key={node.song.id}
                  song={node.song}
                  currentlyPlayingId={currentlyPlayingId}
                  setCurrentlyPlayingId={setCurrentlyPlayingId}
                  x={node.x}
                  y={finalY}
                  isSearched={node.song.id === searchedSongId}
                  onRefreshUrl={onRefreshUrl ? () => onRefreshUrl(node.song.id) : undefined}
                />
              );
            });
          })()}
        </div>
      </div>

      {/* Fixed Timeline Axis - Stays at bottom, only moves with horizontal scroll */}
      <div
        className="fixed bottom-16 left-0 right-0 h-16 z-30 pointer-events-none overflow-hidden bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent"
      >
        <div
          className="relative h-full"
          style={{
            width: `${totalWidth}px`,
            transform: `translateX(${-scrollX}px)`
          }}
        >
          {/* Years */}
          {YEARS.map((marker) => {
            const monthKey = `${marker.year}-01`;
            const offset = monthDensityData.xOffsets.get(monthKey);
            const leftPos = offset ? offset.start : TIMELINE_PADDING;
            return (
              <div
                key={marker.year}
                className="absolute h-full flex flex-col justify-end items-start pb-1"
                style={{ left: `${leftPos}px` }}
              >
                <div className="h-[50%] w-[1px] bg-gradient-to-t from-slate-400/40 via-slate-400/20 to-transparent"></div>
                <span className="font-mono text-lg font-bold mt-1 -translate-x-1/2 select-none text-slate-400/60">
                  {marker.label}
                </span>
              </div>
            );
          })}

          {/* Month Markers (shown when zoomed in) */}
          {pixelsPerYear > 500 && YEARS.map((yearMarker) => {
            const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            return monthNames.map((month) => {
              const monthKey = `${yearMarker.year}-${month}`;
              const offset = monthDensityData.xOffsets.get(monthKey);
              const leftPos = offset ? offset.start + offset.width / 2 : TIMELINE_PADDING;

              return (
                <div
                  key={`${yearMarker.year}-${month}`}
                  className="absolute h-full flex flex-col justify-end items-start pb-1"
                  style={{ left: `${leftPos}px` }}
                >
                  <div className="h-[30%] w-[1px] bg-gradient-to-t from-slate-500/30 via-slate-500/10 to-transparent"></div>
                  <span className="font-mono text-xs font-normal mt-0.5 -translate-x-1/2 select-none text-slate-500/40">
                    {month}
                  </span>
                </div>
              );
            });
          })}
        </div>
      </div>
      <div className="fixed bottom-24 left-6 z-50 flex flex-col items-center gap-2 bg-slate-900/50 backdrop-blur-md p-2 rounded-full border border-slate-700 shadow-xl group hover:bg-slate-900/80 transition-colors">
        <button
          onClick={handleZoomIn}
          className="p-2 text-slate-400 hover:text-neon-accent transition-colors rounded-full hover:bg-white/5"
          title="Zoom In"
        >
          <Plus size={20} />
        </button>

        <div
          className="relative h-24 w-1 bg-slate-700 rounded-full overflow-hidden cursor-pointer"
          onMouseDown={(e) => {
            e.preventDefault();
            const slider = e.currentTarget;
            const rect = slider.getBoundingClientRect();

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const y = moveEvent.clientY - rect.top;
              const percent = Math.max(0, Math.min(1, 1 - (y / rect.height))); // Inverted: top = max
              const newScale = 0.5 + percent * (3 - 0.5);
              setYAxisScale(newScale);
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            // Initial set
            handleMouseMove(e.nativeEvent);

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <div
            className="absolute bottom-0 left-0 w-full bg-neon-accent/50 transition-none pointer-events-none"
            style={{
              height: `${((yAxisScale - 0.5) / (3 - 0.5)) * 100}%`
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
                <span className="w-5 text-center">📊</span>
                <span>拖动进度条 → Y轴缩放</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">
                  {navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}
                </kbd>
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