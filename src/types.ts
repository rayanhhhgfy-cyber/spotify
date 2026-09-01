export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  streamMirrors?: string[];
  duration: number; // in milliseconds
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  coverUrl?: string;
}

