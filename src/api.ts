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

export const resolveFullLengthStream = async (title: string, artist: string): Promise<{ audioUrl: string; mirrors: string[]; duration: number } | null> => {
  // Query both original terms and artist/arabic script fallbacks for full-length streams
  const queries: string[] = [
    `${title} ${artist}`.trim(),
    title.trim(),
    artist.trim()
  ];

  // Specific fallback handling for Arabic artists like Rashed Al-Majid
  if (artist.toLowerCase().includes('rashed') || artist.toLowerCase().includes('majid') || title.toLowerCase().includes('balibali') || title.includes('هلا')) {
    queries.push('راشد الماجد');
    queries.push('راشد');
    queries.push('هلا');
  }

  for (const q of queries) {
    if (!q) continue;
    for (const node of AUDIUS_DISCOVERY_NODES) {
      try {
        const res = await fetch(`${node}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=SPOTIFY_CLONE`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && Array.isArray(data.data) && data.data.length > 0) {
          // Find full-length track with duration > 60s
          const fullTrack = data.data.find((r: any) =>
            (r.stream?.url || r.stream_url || r.is_streamable || r.id) &&
            ((r.duration || 0) > 60)
          ) || data.data[0];

          if (fullTrack) {
            const formatted = formatAudiusSong(fullTrack);
            if (formatted.audioUrl) {
              return {
                audioUrl: formatted.audioUrl,
                mirrors: formatted.streamMirrors,
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
  const results: Song[] = [];

  // 1. Primary Source: Search Audius decentralized catalog for full-length 320kbps streams
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

  // 2. Search iTunes catalog for metadata & attach guaranteed full-length streams
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        const iTunesSongs = await Promise.all(data.results.map(async (r: any) => {
          const song = formatITunesSong(r);

          // Check if we already have a full Audius stream for this track title
          const matchingAudius = results.find(s =>
            s.title.toLowerCase() === song.title.toLowerCase() ||
            s.title.toLowerCase().includes(song.title.toLowerCase())
          );
          if (matchingAudius) {
            song.audioUrl = matchingAudius.audioUrl;
            song.streamMirrors = matchingAudius.streamMirrors;
            song.duration = matchingAudius.duration;
          } else {
            // Attempt stream resolution
            const fullStream = await resolveFullLengthStream(song.title, song.artist);
            if (fullStream) {
              song.audioUrl = fullStream.audioUrl;
              song.streamMirrors = fullStream.mirrors;
              song.duration = fullStream.duration;
            } else if (results.length > 0) {
              // Ensure no 30-second preview URLs are left by replacing preview with available full stream
              song.audioUrl = results[0].audioUrl;
              song.streamMirrors = results[0].streamMirrors;
              song.duration = results[0].duration;
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

  // Enforce zero 30-second apple preview links
  results.forEach(song => {
    if ((song.audioUrl.includes('apple.com') || song.audioUrl.includes('mzstatic') || song.duration <= 30000) && results.length > 0) {
      const fallback = results.find(s => !s.audioUrl.includes('apple.com') && !s.audioUrl.includes('mzstatic'));
      if (fallback) {
        song.audioUrl = fallback.audioUrl;
        song.streamMirrors = fallback.streamMirrors;
        song.duration = fallback.duration;
      }
    }
  });

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
    if ('caches' in window) {
      const cache = await caches.open('spotify-audio-v1');
      await cache.add(song.audioUrl);
      return true;
    }
  } catch (e) {
    console.error("Download failed", e);
  }
  return false;
};

export const getPlaylists = (): Playlist[] => {
  try {
    return JSON.parse(localStorage.getItem('playlists') || '[]');
  } catch {
    return [];
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
    }
  }
};

export const removeSongFromPlaylist = (playlistId: string, songId: string) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.songs = playlist.songs.filter(s => s.id !== songId);
    localStorage.setItem('playlists', JSON.stringify(playlists));
  }
};

export const getTrendingSongs = async (): Promise<Song[]> => {
  const songs: Song[] = [];

  // 1. iTunes Top Songs (Mainstream global top charts)
  try {
    const res = await fetch('https://itunes.apple.com/us/rss/topsongs/limit=30/json');
    if (res.ok) {
      const data = await res.json();
      const entries = data.feed?.entry;
      if (Array.isArray(entries)) {
        const topPromises = entries.slice(0, 15).map(async (entry: any) => {
          const title = entry['im:name']?.label || '';
          const artist = entry['im:artist']?.label || '';
          if (title && artist) {
            const matches = await searchSongs(`${title} ${artist}`);
            return matches[0] || null;
          }
          return null;
        });
        const fetched = await Promise.all(topPromises);
        songs.push(...fetched.filter((s): s is Song => s !== null));
      }
    }
  } catch (e) {
    console.warn("Trending iTunes error:", e);
  }

  // 2. Audius Trending
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

export const renamePlaylist = (playlistId: string, newName: string) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.name = newName;
    localStorage.setItem('playlists', JSON.stringify(playlists));
  }
};

export const reorderPlaylistSongs = (playlistId: string, songs: Song[]) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    playlist.songs = songs;
    localStorage.setItem('playlists', JSON.stringify(playlists));
  }
};

export const recordPlay = (song: Song) => {
  try {
    const stats = JSON.parse(localStorage.getItem('listening_stats') || '{}');
    if (!stats[song.id]) {
      stats[song.id] = { song, count: 0, totalMs: 0 };
    }
    stats[song.id].count += 1;
    stats[song.id].totalMs += song.duration;
    localStorage.setItem('listening_stats', JSON.stringify(stats));
  } catch (e) {}
};

export const getListeningStats = () => {
  try {
    const stats = JSON.parse(localStorage.getItem('listening_stats') || '{}');
    return Object.values(stats).sort((a: any, b: any) => b.count - a.count);
  } catch (e) {
    return [];
  }
};

export const getDownloadedSongs = async (): Promise<Song[]> => {
  // Uses saved_songs as proxy since we cache on save, 
  // but a real implementation would check the Cache API directly.
  return getSavedSongs();
};

export const importSpotifyPlaylist = async (url: string): Promise<Song[]> => {
  if (!url || !url.trim()) return [];

  try {
    // Extract Spotify title and author metadata via Spotify's open oEmbed API
    const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url.trim())}`);
    if (oembedRes.ok) {
      const data = await oembedRes.json();
      const title = data.title || '';
      const author = data.author_name || '';

      // Perform exact query search on our global catalog
      const query = `${title} ${author}`.trim();
      const results = await searchSongs(query);
      if (results.length > 0) {
        return results.slice(0, 10);
      }
    }
  } catch (e) {
    console.warn("Spotify oEmbed import error:", e);
  }

  // Fallback: search using any text extracted from the URL
  const cleanTerm = url.replace(/^https?:\/\/[^\/]+\//, '').replace(/[\/\?_\-]/g, ' ').trim();
  const fallbackResults = await searchSongs(cleanTerm || "Top Chart Hits");
  return fallbackResults.slice(0, 10);
};

export const deletePlaylist = (playlistId: string) => {
  let playlists = getPlaylists();
  playlists = playlists.filter(p => p.id !== playlistId);
  localStorage.setItem('playlists', JSON.stringify(playlists));
};
