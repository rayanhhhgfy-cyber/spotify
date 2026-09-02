import { Song, Playlist } from './types';

const AUDIUS_DISCOVERY_NODES = [
  'https://api.audius.co',
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co'
];

export const formatITunesSong = (r: any): Song => {
  const art = (r.artworkUrl100 || r.artworkUrl60 || '').replace('100x100bb', '600x600bb');
  return {
    id: `itunes-${r.trackId || Math.random()}`,
    title: r.trackName || 'Unknown Title',
    artist: r.artistName || 'Unknown Artist',
    album: r.collectionName || 'Single',
    coverUrl: art || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
    audioUrl: r.previewUrl || '',
    streamMirrors: r.previewUrl ? [r.previewUrl] : [],
    duration: r.trackTimeMillis || 30000,
  };
};

export const formatAudiusSong = (r: any): Song => {
  const art = r.artwork ? (r.artwork['480x480'] || r.artwork['150x150'] || r.artwork['1000x1000']) : null;
  const trackId = r.id || (r.track_id ? r.track_id.toString() : '');
  
  const mirrors: string[] = [];
  if (trackId) {
    mirrors.push(`https://api.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`);
    mirrors.push(`https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`);
    mirrors.push(`https://discoveryprovider2.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`);
  }
  if (r.stream?.url) {
    if (r.stream.mirrors && Array.isArray(r.stream.mirrors)) {
      const pathAndQuery = r.stream.url.replace(/^https?:\/\/[^\/]+/, '');
      for (const m of r.stream.mirrors) {
        if (m) mirrors.push(`${m}${pathAndQuery}`);
      }
    }
    mirrors.push(r.stream.url);
  }
  
  const uniqueMirrors = Array.from(new Set(mirrors.filter(Boolean)));
  const primaryUrl = uniqueMirrors[0] || (trackId ? `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE` : '');

  return {
    id: trackId || Math.random().toString(),
    title: r.title || 'Unknown Title',
    artist: r.user?.name || 'Unknown Artist',
    album: r.user?.handle ? `@${r.user.handle}` : 'Single',
    coverUrl: art || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
    audioUrl: primaryUrl,
    streamMirrors: uniqueMirrors,
    duration: (r.duration || 0) * 1000,
  };
};

export const resolveFullLengthStream = async (title: string, artist: string): Promise<{ audioUrl: string; mirrors: string[]; duration?: number; youtubeId?: string } | null> => {
  // 1. First priority: Server-side YouTube & full song resolver
  try {
    const res = await fetch(`/api/resolve?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.youtubeId) {
        return {
          audioUrl: '',
          mirrors: [],
          duration: data.duration || 240000,
          youtubeId: data.youtubeId
        };
      }
    }
  } catch (e) {
    console.warn('Backend resolve error:', e);
  }

  // 2. Query Audius decentralized catalog for stream resolution
  const queries: string[] = [
    `${title} ${artist}`.trim(),
    title.trim(),
    artist.trim()
  ];

  for (const q of queries) {
    if (!q) continue;
    for (const node of AUDIUS_DISCOVERY_NODES) {
      try {
        const res = await fetch(`${node}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=SPOTIFY_CLONE`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && Array.isArray(data.data) && data.data.length > 0) {
          const fullTrack = data.data.find((r: any) =>
            (r.stream?.url || r.stream_url || r.is_streamable || r.id) &&
            ((r.duration || 0) > 60)
          ) || data.data[0];

          if (fullTrack) {
            const formatted = formatAudiusSong(fullTrack);
            if (formatted.audioUrl) {
              return {
                audioUrl: formatted.audioUrl,
                mirrors: formatted.streamMirrors || [],
                duration: formatted.duration > 30000 ? formatted.duration : 240000
              };
            }
          }
        }
      } catch (e) {
        console.warn(`Stream resolution error on node ${node}:`, e);
      }
    }
  }
  return null;
};

export const searchSongs = async (query: string): Promise<Song[]> => {
  if (!query.trim()) return [];

  // 1. Primary Source: Backend search providing full-length songs (YouTube + Audius)
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.songs) && data.songs.length > 0) {
        return data.songs;
      }
    }
  } catch (e) {
    console.warn('Backend search failed, using client fallback:', e);
  }

  const results: Song[] = [];

  // 2. Fallback: Search Audius decentralized catalog for full-length 320kbps streams
  for (const node of AUDIUS_DISCOVERY_NODES) {
    try {
      const res = await fetch(`${node}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=SPOTIFY_CLONE`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        const audiusSongs = data.data
          .filter((r: any) => r.stream?.url || r.stream_url || r.is_streamable || r.id)
          .map(formatAudiusSong);
        results.push(...audiusSongs);
        break;
      }
    } catch (e) {
      console.warn(`Search error on node ${node}:`, e);
    }
  }

  // 3. Search iTunes catalog for metadata & attach matching full streams
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        const iTunesSongs = await Promise.all(data.results.map(async (r: any) => {
          const song = formatITunesSong(r);

          const matchingAudius = results.find(s =>
            s.title.toLowerCase() === song.title.toLowerCase() &&
            s.artist.toLowerCase() === song.artist.toLowerCase()
          );
          if (matchingAudius) {
            song.audioUrl = matchingAudius.audioUrl;
            song.streamMirrors = matchingAudius.streamMirrors;
            song.duration = r.trackTimeMillis || matchingAudius.duration;
            song.isFullLength = true;
          } else {
            const fullStream = await resolveFullLengthStream(song.title, song.artist);
            if (fullStream) {
              if (fullStream.youtubeId) {
                song.youtubeId = fullStream.youtubeId;
              }
              if (fullStream.audioUrl) {
                song.audioUrl = fullStream.audioUrl;
                song.streamMirrors = fullStream.mirrors;
              }
              song.duration = r.trackTimeMillis || fullStream.duration || 210000;
              song.isFullLength = true;
            }
          }
          return song;
        }));
        results.push(...iTunesSongs);
      }
    }
  } catch (e) {
    console.warn("iTunes Search error:", e);
  }

  // Deduplicate results by title+artist
  const seen = new Set<string>();
  return results.filter(s => {
    const key = `${s.title.toLowerCase()}-${s.artist.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const getSavedSongs = (): Song[] => {
  try {
    return JSON.parse(localStorage.getItem('saved_songs') || '[]');
  } catch {
    return [];
  }
};

export const toggleSaveSong = async (song: Song): Promise<boolean> => {
  const saved = getSavedSongs();
  const exists = saved.find(s => s.id === song.id);
  if (exists) {
    const filtered = saved.filter(s => s.id !== song.id);
    localStorage.setItem('saved_songs', JSON.stringify(filtered));
    return false;
  } else {
    saved.push(song);
    localStorage.setItem('saved_songs', JSON.stringify(saved));
    // Trigger SW cache
    downloadSong(song);
    return true;
  }
};

export const isSongSaved = (id: string): boolean => {
  const saved = getSavedSongs();
  return saved.some(s => s.id === id);
};

export const downloadSong = async (song: Song): Promise<boolean> => {
  try {
    const downloaded = JSON.parse(localStorage.getItem('downloaded_songs') || '[]');
    if (!downloaded.some((s: Song) => s.id === song.id)) {
      downloaded.push(song);
      localStorage.setItem('downloaded_songs', JSON.stringify(downloaded));
    }
    if (song.audioUrl && 'caches' in window) {
      const cache = await caches.open('spotify-audio-v1');
      await cache.add(song.audioUrl);
    }
    return true;
  } catch (e) {
    console.error("Download failed", e);
    return true; // Still marked as downloaded locally
  }
};

export const getPlaylists = (): Playlist[] => {
  try {
    return JSON.parse(localStorage.getItem('playlists') || '[]');
  } catch {
    return [];
  }
};

const notifyPlaylistsChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('playlists-updated'));
  }
};

export const createPlaylist = (name: string): Playlist => {
  const playlists = getPlaylists();
  const newPlaylist: Playlist = {
    id: Date.now().toString(),
    name,
    songs: []
  };
  playlists.push(newPlaylist);
  localStorage.setItem('playlists', JSON.stringify(playlists));
  notifyPlaylistsChanged();
  return newPlaylist;
};

export const addSongToPlaylist = (playlistId: string, song: Song) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    if (!playlist.songs.some(s => s.id === song.id)) {
      playlist.songs.push(song);
      localStorage.setItem('playlists', JSON.stringify(playlists));
      downloadSong(song);
      notifyPlaylistsChanged();
    }
  }
};

export const removeSongFromPlaylist = (playlistId: string, songId: string) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.songs = playlist.songs.filter(s => s.id !== songId);
    localStorage.setItem('playlists', JSON.stringify(playlists));
    notifyPlaylistsChanged();
  }
};

export const renamePlaylist = (playlistId: string, newName: string) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.name = newName;
    localStorage.setItem('playlists', JSON.stringify(playlists));
    notifyPlaylistsChanged();
  }
};

export const reorderPlaylistSongs = (playlistId: string, songs: Song[]) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.songs = songs;
    localStorage.setItem('playlists', JSON.stringify(playlists));
    notifyPlaylistsChanged();
  }
};

export const deletePlaylist = (playlistId: string) => {
  let playlists = getPlaylists();
  playlists = playlists.filter(p => p.id !== playlistId);
  localStorage.setItem('playlists', JSON.stringify(playlists));
  notifyPlaylistsChanged();
};

export const getTrendingSongs = async (): Promise<Song[]> => {
  // 1. Primary: Backend trending endpoint providing full songs
  try {
    const res = await fetch('/api/trending');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.songs) && data.songs.length > 0) {
        return data.songs;
      }
    }
  } catch (e) {
    console.warn('Backend trending fetch failed:', e);
  }

  const songs: Song[] = [];

  // 2. Audius Trending fallback
  for (const node of AUDIUS_DISCOVERY_NODES) {
    try {
      const res = await fetch(`${node}/v1/tracks/trending?app_name=SPOTIFY_CLONE&limit=25`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        const audiusSongs = data.data
          .filter((r: any) => r.stream?.url || r.stream_url || r.is_streamable || r.id)
          .map(formatAudiusSong);
        songs.push(...audiusSongs);
        break;
      }
    } catch (e) {
      console.warn(`Trending error on node ${node}:`, e);
    }
  }

  return songs;
};

export const importSpotifyPlaylist = async (url: string): Promise<{ name: string; songs: Song[] }> => {
  if (!url || !url.trim()) return { name: 'Imported Playlist', songs: [] };

  try {
    const res = await fetch('/api/import-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.songs) && data.songs.length > 0) {
        return {
          name: data.name || 'Imported Playlist',
          songs: data.songs
        };
      }
    }
  } catch (e) {
    console.warn('Backend playlist import error:', e);
  }

  // Fallback search if server is unreachable
  const cleanTerm = url.replace(/^https?:\/\/[^\/]+\//, '').replace(/[\/\?_\-]/g, ' ').trim();
  const fallbackResults = await searchSongs(cleanTerm || 'Top Chart Hits');
  return {
    name: cleanTerm ? `Import: ${cleanTerm}` : 'Imported Playlist',
    songs: fallbackResults.slice(0, 15)
  };
};

export const recordPlay = (song: Song) => {
  if (!song || !song.id) return;
  try {
    const raw = localStorage.getItem('listening_stats') || '[]';
    const stats: Array<{ song: Song; count: number; lastPlayed: number }> = JSON.parse(raw);
    const existingIndex = stats.findIndex(s => s.song.id === song.id);
    if (existingIndex >= 0) {
      stats[existingIndex].count += 1;
      stats[existingIndex].lastPlayed = Date.now();
    } else {
      stats.push({ song, count: 1, lastPlayed: Date.now() });
    }
    localStorage.setItem('listening_stats', JSON.stringify(stats));
  } catch (e) {
    console.error('Error recording play:', e);
  }
};

export const getListeningStats = (): Array<{ song: Song; count: number; lastPlayed: number }> => {
  try {
    const raw = localStorage.getItem('listening_stats') || '[]';
    return JSON.parse(raw).sort((a: any, b: any) => b.count - a.count);
  } catch {
    return [];
  }
};

export const getDownloadedSongs = async (): Promise<Song[]> => {
  try {
    const raw = localStorage.getItem('downloaded_songs') || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

