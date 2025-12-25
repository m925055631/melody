
import type { Song, YearMarker } from './types';

// Timeline configuration constants
export const START_YEAR = 2000;
export const END_YEAR = new Date().getFullYear();
export const PIXELS_PER_YEAR = 800;
export const MIN_PIXELS_PER_YEAR = 100;
export const MAX_PIXELS_PER_YEAR = 2400;
export const TIMELINE_PADDING = 800;

/**
 * Generate year markers for years that have at least one song
 * Automatically adjusts start year based on earliest song
 */
export function getYearsWithSongs(songs: Song[]): YearMarker[] {
  if (songs.length === 0) {
    // Return current year range if no songs (for initial render)
    return Array.from(
      { length: END_YEAR - START_YEAR + 1 },
      (_, i) => ({ year: START_YEAR + i, label: String(START_YEAR + i) })
    );
  }

  // Extract years from songs and find min/max
  const songYears = songs.map(song => new Date(song.releaseDate).getFullYear());
  const minYear = Math.min(...songYears);
  const maxYear = Math.max(...songYears);

  // Use actual min year from songs, but ensure reasonable bounds
  const actualStartYear = Math.max(1950, minYear);
  const actualEndYear = Math.max(new Date().getFullYear(), maxYear);

  // Generate year markers for the entire range
  const years: YearMarker[] = [];
  for (let year = actualStartYear; year <= actualEndYear; year++) {
    years.push({ year, label: String(year) });
  }

  // console.log('[getYearsWithSongs]', {
  //   songsCount: songs.length,
  //   minYear,
  //   maxYear,
  //   actualStartYear,
  //   actualEndYear,
  //   yearsGenerated: years.length
  // });

  return years;
}

// Legacy YEARS export for backwards compatibility
export const YEARS: YearMarker[] = Array.from(
  { length: END_YEAR - START_YEAR + 1 },
  (_, i) => ({ year: START_YEAR + i, label: String(START_YEAR + i) })
);
