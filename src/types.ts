export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  streamMirrors?: string[];
  duration: number; // in milliseconds
  youtubeId?: string;
  isFullLength?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  coverUrl?: string;
  shareId?: string;
  description?: string;
}

