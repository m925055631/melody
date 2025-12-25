
export interface Song {
  id: string;
  title: string;
  artist: string;
  releaseDate: string; // ISO Date YYYY-MM-DD
  popularity: number; // 0-100, determines Y-axis height
  coverUrl: string;
  description?: string;
  audioUrl?: string; // URL for the audio file (uploaded by user)
  fileId?: string; // CTFile file ID
  audioUrlUpdatedAt?: string; // ISO Date when the audio URL was last updated
  lyrics?: string; // Lyrics content
  fileId?: string; // CTFile file ID (without 'f' prefix)
  audioUrlUpdatedAt?: string; // ISO timestamp of when audioUrl was last updated
}

export interface YearMarker {
  year: number;
  label: string;
}