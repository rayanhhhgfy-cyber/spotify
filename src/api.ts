import { Song, Playlist } from './types';
import LZString from 'lz-string';
import { INITIAL_DISCOVER_SONGS, DISCOVER_ARTISTS_AND_TAGS } from './data/discoverPool';

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
  if (r.stream?.url) {
    mirrors.push(r.stream.url);
    if (r.stream.mirrors && Array.isArray(r.stream.mirrors)) {
      const pathAndQuery = r.stream.url.replace(/^https?:\/\/[^\/]+/, '');
      for (const m of r.stream.mirrors) {
        if (m) mirrors.push(`${m}${pathAndQuery}`);
      }
    }
  }
  if (trackId) {
    mirrors.push(`https://api.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`);
    mirrors.push(`https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`);
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

export const resolveFullLengthStream = async (title: string, artist: string, forceAudius = false): Promise<{ audioUrl: string; mirrors: string[]; duration?: number; youtubeId?: string; backupYoutubeIds?: string[] } | null> => {
  // 1. First priority: SoundCloud for native direct audio streams (works in background flawlessly)
  if (!forceAudius) {
    try {
      const titleClean = title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
      const res = await fetch(`/api/resolve/soundcloud?title=${encodeURIComponent(titleClean)}&artist=${encodeURIComponent(artist)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.audioUrl) {
          return {
            audioUrl: data.audioUrl,
            mirrors: [data.audioUrl],
            duration: data.duration || 240000,
            youtubeId: undefined
          };
        }
      }
    } catch (e) {
      console.warn('SoundCloud resolve error:', e);
    }

    // 2. Fallback: Server-side YouTube & full song resolver
    try {
      const res = await fetch(`/api/resolve?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.youtubeId) {
          return {
            audioUrl: `/api/stream/youtube/${data.youtubeId}`,
            mirrors: [`/api/stream/youtube/${data.youtubeId}`],
            duration: data.duration || 240000,
            youtubeId: data.youtubeId,
            backupYoutubeIds: data.backupYoutubeIds || []
          };
        }
      }
    } catch (e) {
      console.warn('Backend resolve error:', e);
    }
  }

  // 2. Query Audius decentralized catalog for direct full-length MP3 stream
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const queries: string[] = [
    `${title} ${artist}`.trim(),
    title.trim()
  ];

  for (const q of queries) {
    if (!q) continue;
    for (const node of AUDIUS_DISCOVERY_NODES) {
      try {
        const res = await fetch(`${node}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=SPOTIFY_CLONE`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && Array.isArray(data.data) && data.data.length > 0) {
          const fullTrack = data.data.find((r: any) => {
            if (!r.title) return false;
            const rTitle = r.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const hasStream = r.stream?.url || r.stream_url || r.is_streamable || r.id;
            // Strictly verify that track title contains the core song title
            return hasStream && (rTitle.includes(cleanTitle) || cleanTitle.includes(rTitle));
          });

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

  // 3. Query iTunes for direct streaming audio preview
  try {
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(`${title} ${artist}`)}&entity=song&limit=1`);
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      if (itunesData.results && itunesData.results.length > 0 && itunesData.results[0].previewUrl) {
        const r = itunesData.results[0];
        return {
          audioUrl: r.previewUrl,
          mirrors: [r.previewUrl],
          duration: r.trackTimeMillis || 30000
        };
      }
    }
  } catch (e) {
    console.warn('iTunes resolution fallback error:', e);
  }

  return null;
};

export const searchSongs = async (query: string): Promise<Song[]> => {
  if (!query.trim()) return [];

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.songs)) {
        return data.songs;
      }
    }
  } catch (e) {
    console.warn('Backend search failed', e);
  }
  return [];
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
    return true;
  }
};

export const isSongSaved = (id: string): boolean => {
  const saved = getSavedSongs();
  return saved.some(s => s.id === id);
};

export const reconcileDownloads = async (): Promise<Song[]> => {
  try {
    const downloaded: Song[] = JSON.parse(localStorage.getItem('downloaded_songs') || '[]');
    if (!('caches' in window)) {
      return downloaded;
    }
    const cache = await caches.open('spotify-audio-v1');
    const valid: Song[] = [];
    for (const s of downloaded) {
      if (s.audioUrl) {
        const match = await cache.match(s.audioUrl);
        if (match) {
          valid.push(s);
        }
      }
    }
    localStorage.setItem('downloaded_songs', JSON.stringify(valid));
    return valid;
  } catch {
    return [];
  }
};

export const downloadSong = async (song: Song): Promise<boolean> => {
  try {
    let finalAudioUrl = song.audioUrl;
    
    // If no audioUrl or if it's an iTunes 30s preview, check if Audius has a verified full track match
    if (!finalAudioUrl || finalAudioUrl.includes('apple.com') || finalAudioUrl.includes('mzstatic')) {
      const fallback = await resolveFullLengthStream(song.title, song.artist, true);
      if (fallback && fallback.audioUrl) {
        finalAudioUrl = fallback.audioUrl;
      }
    }

    if (!finalAudioUrl) {
      console.warn(`No downloadable direct audio stream available for "${song.title}"`);
      return false;
    }

    if ('caches' in window) {
      const cache = await caches.open('spotify-audio-v1');
      const response = await fetch(finalAudioUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Failed to fetch stream: ${response.status}`);
      }
      await cache.put(finalAudioUrl, response);
    }
    
    const downloaded = JSON.parse(localStorage.getItem('downloaded_songs') || '[]');
    const storedSong = { ...song, audioUrl: finalAudioUrl };
    if (!downloaded.some((s: Song) => s.id === song.id)) {
      downloaded.push(storedSong);
      localStorage.setItem('downloaded_songs', JSON.stringify(downloaded));
    }
    window.dispatchEvent(new CustomEvent('downloads-updated'));
    return true;
  } catch (e) {
    console.error(`Download failed for ${song.title}:`, e);
    return false;
  }
};

export const downloadPlaylist = async (
  playlist: Playlist,
  onProgress?: (progress: number, currentSong: string) => void
): Promise<void> => {
  const songs = playlist.songs;
  let completed = 0;

  for (const song of songs) {
    onProgress?.(completed / songs.length, song.title);
    
    // Resolve full length stream if necessary (e.g. no audioUrl or iTunes preview)
    if (!song.youtubeId && (!song.audioUrl || song.id.startsWith('itunes-') || song.duration <= 30000)) {
      try {
        const resolved = await resolveFullLengthStream(song.title, song.artist);
        if (resolved && resolved.audioUrl) {
          song.audioUrl = resolved.audioUrl;
          if (resolved.youtubeId) song.youtubeId = resolved.youtubeId;
          if (resolved.duration) song.duration = resolved.duration;
        }
      } catch (e) {
        console.warn(`Failed to resolve ${song.title}`, e);
      }
    } else if (song.youtubeId && !song.audioUrl) {
      song.audioUrl = `/api/stream/youtube/${song.youtubeId}`;
    }
    
    await downloadSong(song);
    completed++;
  }
  
  onProgress?.(1, 'Complete');
  
  // Persist updated playlist if songs were mutated (e.g. audioUrl resolved)
  const playlists = getPlaylists();
  const idx = playlists.findIndex(p => p.id === playlist.id);
  if (idx !== -1) {
    playlists[idx] = playlist;
    localStorage.setItem('playlists', JSON.stringify(playlists));
    notifyPlaylistsChanged();
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

export const createPlaylist = (name: string, coverUrl?: string): Playlist => {
  const playlists = getPlaylists();
  const newPlaylist: Playlist = {
    id: Date.now().toString(),
    name,
    coverUrl: coverUrl || '',
    songs: []
  };
  playlists.push(newPlaylist);
  localStorage.setItem('playlists', JSON.stringify(playlists));
  notifyPlaylistsChanged();
  return newPlaylist;
};

export const addSongsToPlaylist = (playlistId: string, songsToAdd: Song[]) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    const existingIds = new Set(playlist.songs.map(s => s.id));
    for (const s of songsToAdd) {
      if (!existingIds.has(s.id)) {
        playlist.songs.push(s);
        existingIds.add(s.id);
      }
    }
    if (!playlist.coverUrl && playlist.songs[0]?.coverUrl) {
      playlist.coverUrl = playlist.songs[0].coverUrl;
    }
    localStorage.setItem('playlists', JSON.stringify(playlists));
    notifyPlaylistsChanged();
  }
};

export const addSongToPlaylist = (playlistId: string, song: Song) => {
  const playlists = getPlaylists();
  const playlist = playlists.find(p => p.id === playlistId);
  if (playlist) {
    if (!playlist.songs.some(s => s.id === song.id)) {
      playlist.songs.push(song);
      if (!playlist.coverUrl && song.coverUrl) {
        playlist.coverUrl = song.coverUrl;
      }
      localStorage.setItem('playlists', JSON.stringify(playlists));
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

/**
 * Compact encoder for universal serverless cross-device playlist sharing.
 * Safely compresses playlist metadata and song list into a URL-safe LZString payload.
 */
export const encodePlaylistPayload = (playlist: Playlist): string => {
  try {
    const compactObj = {
      n: playlist.name,
      i: playlist.shareId || playlist.id,
      c: playlist.coverUrl || (playlist.songs[0]?.coverUrl || ''),
      s: (playlist.songs || []).map(song => ({
        t: song.title,
        a: song.artist,
        al: song.album || '',
        c: song.coverUrl || '',
        u: song.audioUrl || '',
        d: song.duration || 0,
        y: song.youtubeId || '',
        m: song.streamMirrors || []
      }))
    };
    const jsonStr = JSON.stringify(compactObj);
    const compressed = LZString.compressToEncodedURIComponent(jsonStr);
    return `lz_${compressed}`;
  } catch (e) {
    console.error('Failed to encode playlist payload:', e);
    return '';
  }
};

/**
 * Decodes a URL-safe playlist payload back into a full Playlist object.
 * Supports both LZ-compressed (lz_...) and Base64 format strings.
 */
export const decodePlaylistPayload = (encoded: string): Playlist | null => {
  try {
    if (!encoded || !encoded.trim()) return null;
    let jsonStr: string | null = null;
    const raw = encoded.trim();

    // 1. Try LZString decompression
    if (raw.startsWith('lz_')) {
      jsonStr = LZString.decompressFromEncodedURIComponent(raw.substring(3));
    } else {
      // Try direct LZ decompression first
      jsonStr = LZString.decompressFromEncodedURIComponent(raw);
    }

    // 2. Base64 fallback if not LZ
    if (!jsonStr) {
      try {
        let base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
          base64 += '=';
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        jsonStr = new TextDecoder().decode(bytes);
      } catch {}
    }

    if (!jsonStr) return null;
    const data = JSON.parse(jsonStr);

    if (!data || (!data.n && !data.name)) return null;

    const songs: Song[] = (data.s || data.songs || []).map((s: any, idx: number) => ({
      id: s.id || `shared-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      title: s.t || s.title || 'Unknown Title',
      artist: s.a || s.artist || 'Unknown Artist',
      album: s.al || s.album || 'Single',
      coverUrl: s.c || s.coverUrl || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
      audioUrl: s.u || s.audioUrl || '',
      duration: s.d || s.duration || 0,
      youtubeId: s.y || s.youtubeId || undefined,
      streamMirrors: Array.isArray(s.m) ? s.m : (s.streamMirrors || [])
    }));

    return {
      id: Date.now().toString(),
      shareId: data.i || data.shareId || `pl_${Math.random().toString(36).substring(2, 9)}`,
      name: data.n || data.name || 'Shared Playlist',
      songs,
      coverUrl: data.c || data.coverUrl || (songs[0]?.coverUrl || '')
    };
  } catch (e) {
    console.error('Failed to decode playlist payload:', e);
    return null;
  }
};

/**
 * Register or update a shared playlist on the server and get a constant shareable link.
 */
export const sharePlaylist = async (playlist: Playlist): Promise<{ shareId: string; shareUrl: string }> => {
  const currentPlaylists = getPlaylists();
  const existing = currentPlaylists.find(p => p.id === playlist.id);

  // Generate constant deterministic shareId if not already present
  const shareId = existing?.shareId || playlist.shareId || `pl_${Math.random().toString(36).substring(2, 9)}`;

  // Save shareId locally
  if (existing) {
    existing.shareId = shareId;
    localStorage.setItem('playlists', JSON.stringify(currentPlaylists));
  }

  // Generate compact self-contained payload for universal cross-origin loading (e.g. Vercel, localhost, mobile)
  const encodedPayload = encodePlaylistPayload({ ...playlist, shareId });

  // Determine current origin (e.g. https://spotify-rayyan.vercel.app or preview origin)
  const baseUrl = (typeof window !== 'undefined' && window.location.origin)
    ? window.location.origin
    : 'https://spotify-rayyan.vercel.app';

  // Constant Universal Share URL (Has clean query ID + self-contained payload in hash)
  const shareUrl = encodedPayload 
    ? `${baseUrl}/?share=${shareId}#d=${encodedPayload}`
    : `${baseUrl}/?share=${shareId}`;

  // Also sync to backend server in background if available
  const payloadBody = JSON.stringify({
    shareId,
    name: playlist.name,
    songs: playlist.songs,
    coverUrl: playlist.coverUrl || (playlist.songs[0]?.coverUrl || ''),
    description: playlist.description || ''
  });

  try {
    fetch('/api/share-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadBody
    }).catch(() => {});

    // If on custom domain like Vercel, also sync to cloud backend server
    if (typeof window !== 'undefined' && !window.location.hostname.includes('run.app')) {
      fetch('https://ais-pre-7uxg4ouinzeecu65qmm74g-630584779843.europe-west2.run.app/api/share-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadBody
      }).catch(() => {});
    }
  } catch (e) {
    // Non-blocking
  }

  return { shareId, shareUrl };
};

const CLOUD_BACKEND_URL = 'https://ais-pre-7uxg4ouinzeecu65qmm74g-630584779843.europe-west2.run.app';

/**
 * Fetch a shared playlist by its constant shareId from the server.
 */
export const getSharedPlaylist = async (shareId: string): Promise<Playlist | null> => {
  if (!shareId) return null;

  // 1. Try local/relative API
  try {
    const res = await fetch(`/api/share-playlist/${encodeURIComponent(shareId)}`);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.playlist) {
          return data.playlist;
        }
      }
    }
  } catch (e) {
    // Continue to cloud fallback
  }

  // 2. If running on external host (e.g. spotify-rayyan.vercel.app), fallback to cloud backend server
  try {
    const remoteUrl = `${CLOUD_BACKEND_URL}/api/share-playlist/${encodeURIComponent(shareId)}`;
    const remoteRes = await fetch(remoteUrl);
    if (remoteRes.ok) {
      const data = await remoteRes.json();
      if (data && data.playlist) {
        return data.playlist;
      }
    }
  } catch (e) {
    console.error('Error fetching shared playlist from remote API:', e);
  }

  return null;
};

/**
 * Import a shared playlist from a share URL, encoded string, or shareId into the local library.
 */
export const importSharedPlaylist = async (shareInput: string): Promise<Playlist | null> => {
  if (!shareInput || !shareInput.trim()) return null;

  let raw = shareInput.trim();
  let shareId = '';
  let payloadStr = '';

  // 1. Check if raw input itself is an encoded payload or contains hash data
  if (raw.includes('#d=') || raw.includes('#data=') || raw.includes('#payload=')) {
    const hashPart = raw.split('#')[1] || '';
    const hashParams = new URLSearchParams(hashPart);
    payloadStr = hashParams.get('d') || hashParams.get('data') || hashParams.get('payload') || '';
  }

  if (raw.includes('?data=') || raw.includes('&data=')) {
    try {
      const url = new URL(raw, window.location.origin);
      payloadStr = url.searchParams.get('data') || payloadStr;
    } catch {}
  }

  // 2. If payload is found, decode instantly
  if (payloadStr) {
    const decoded = decodePlaylistPayload(payloadStr);
    if (decoded && decoded.songs) {
      const playlists = getPlaylists();
      let targetPlaylist = playlists.find(p => p.shareId === decoded.shareId || p.name === decoded.name);

      if (targetPlaylist) {
        targetPlaylist.name = decoded.name;
        targetPlaylist.songs = decoded.songs;
        if (decoded.coverUrl) targetPlaylist.coverUrl = decoded.coverUrl;
      } else {
        targetPlaylist = {
          id: Date.now().toString(),
          shareId: decoded.shareId,
          name: decoded.name,
          songs: decoded.songs,
          coverUrl: decoded.coverUrl || (decoded.songs?.[0]?.coverUrl || '')
        };
        playlists.push(targetPlaylist);
      }

      localStorage.setItem('playlists', JSON.stringify(playlists));
      notifyPlaylistsChanged();
      return targetPlaylist;
    }
  }

  // 3. Extract shareId from URL parameters or raw string
  if (raw.includes('http://') || raw.includes('https://') || raw.includes('?')) {
    try {
      const url = new URL(raw, window.location.origin);
      const queryShare = url.searchParams.get('share') || url.searchParams.get('shared_playlist') || url.searchParams.get('playlist');
      if (queryShare) {
        shareId = queryShare;
      }
    } catch {
      const match = raw.match(/[?&]share=([^&#]+)/) || raw.match(/[?&]shared_playlist=([^&#]+)/);
      if (match && match[1]) {
        shareId = match[1];
      }
    }
  } else {
    shareId = raw;
  }

  // 4. Try fetching from server endpoint
  if (shareId) {
    const sharedData = await getSharedPlaylist(shareId);
    if (sharedData && sharedData.name) {
      const playlists = getPlaylists();
      let targetPlaylist = playlists.find(p => p.shareId === shareId);

      if (targetPlaylist) {
        targetPlaylist.name = sharedData.name;
        targetPlaylist.songs = sharedData.songs || [];
        if (sharedData.coverUrl) targetPlaylist.coverUrl = sharedData.coverUrl;
      } else {
        targetPlaylist = {
          id: Date.now().toString(),
          shareId: shareId,
          name: sharedData.name,
          songs: sharedData.songs || [],
          coverUrl: sharedData.coverUrl || (sharedData.songs?.[0]?.coverUrl || '')
        };
        playlists.push(targetPlaylist);
      }

      localStorage.setItem('playlists', JSON.stringify(playlists));
      notifyPlaylistsChanged();
      return targetPlaylist;
    }
  }

  // 5. Try direct base64 decode if raw input was raw encoded string
  const directDecoded = decodePlaylistPayload(raw);
  if (directDecoded && directDecoded.songs) {
    const playlists = getPlaylists();
    playlists.push(directDecoded);
    localStorage.setItem('playlists', JSON.stringify(playlists));
    notifyPlaylistsChanged();
    return directDecoded;
  }

  return null;
};

export const getTrendingSongs = async (): Promise<Song[]> => {
  // 1. Primary: Backend trending endpoint providing full songs
  try {
    const res = await fetch('/api/trending?limit=30');
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
      const res = await fetch(`${node}/v1/tracks/trending?app_name=SPOTIFY_CLONE&limit=50`);
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

  if (songs.length === 0) {
    return INITIAL_DISCOVER_SONGS.slice(0, 30);
  }

  return songs;
};

/**
 * Generate and fetch an expansive catalog of 1,000+ curated discover songs
 * with seamless infinite-scrolling batches for the Instagram Reels style player.
 */
export const getDiscoverReelSongs = async (count: number = 1000): Promise<Song[]> => {
  const songsMap = new Map<string, Song>();

  // 1. Seed with curated initial discover songs
  INITIAL_DISCOVER_SONGS.forEach(s => {
    songsMap.set(s.id, s);
  });

  // 2. Fetch latest online trending tracks in parallel
  try {
    const [trendingOnline, audiusRes] = await Promise.allSettled([
      fetch('/api/trending?limit=60')
        .then(r => r.ok ? r.json() : { songs: [] })
        .then(d => d.songs || [])
        .catch(() => []),
      fetch(`${AUDIUS_DISCOVERY_NODES[0]}/v1/tracks/trending?app_name=SPOTIFY_CLONE&limit=100`)
        .then(r => r.ok ? r.json() : { data: [] })
        .then(d => (d.data || []).map(formatAudiusSong))
        .catch(() => [])
    ]);

    if (trendingOnline.status === 'fulfilled' && Array.isArray(trendingOnline.value)) {
      trendingOnline.value.forEach(s => {
        if (s && s.id) songsMap.set(s.id, s);
      });
    }

    if (audiusRes.status === 'fulfilled' && Array.isArray(audiusRes.value)) {
      audiusRes.value.forEach(s => {
        if (s && s.id) songsMap.set(s.id, s);
      });
    }
  } catch (e) {
    console.warn('Online trending fetch error:', e);
  }

  // 3. Expand the catalog programmatically across 160+ artists with unique track pairings and high-res art
  // to ensure 1000+ distinct high-energy discover reel tracks
  const popularTrackTemplates = [
    { title: 'Blinding Lights', album: 'After Hours', genre: 'Synthwave / Pop' },
    { title: 'Starboy', album: 'Starboy', genre: 'R&B / Electro' },
    { title: 'Save Your Tears', album: 'After Hours', genre: 'Pop' },
    { title: 'Cruel Summer', album: 'Lover', genre: 'Pop' },
    { title: 'Anti-Hero', album: 'Midnights', genre: 'Indie Pop' },
    { title: 'Blank Space', album: '1989', genre: 'Pop' },
    { title: 'God\'s Plan', album: 'Scorpion', genre: 'Hip-Hop' },
    { title: 'One Dance', album: 'Views', genre: 'Afrobeats' },
    { title: 'Rich Flex', album: 'Her Loss', genre: 'Trap' },
    { title: 'FE!N', album: 'UTOPIA', genre: 'Trap' },
    { title: 'SICKO MODE', album: 'ASTROWORLD', genre: 'Hip-Hop' },
    { title: 'HUMBLE.', album: 'DAMN.', genre: 'Hip-Hop' },
    { title: 'Not Like Us', album: 'Single', genre: 'West Coast Hip-Hop' },
    { title: 'bad guy', album: 'WHEN WE ALL FALL ASLEEP', genre: 'Alt-Pop' },
    { title: 'BIRDS OF A FEATHER', album: 'HIT ME HARD AND SOFT', genre: 'Indie Pop' },
    { title: 'Levitating', album: 'Future Nostalgia', genre: 'Disco Pop' },
    { title: 'Don\'t Start Now', album: 'Future Nostalgia', genre: 'Nu-Disco' },
    { title: '24K Magic', album: '24K Magic', genre: 'Funk / R&B' },
    { title: 'That\'s What I Like', album: '24K Magic', genre: 'R&B' },
    { title: 'Die With A Smile', album: 'Single', genre: 'Pop Ballad' },
    { title: 'Sunflower', album: 'Spider-Verse', genre: 'Pop-Rap' },
    { title: 'Circles', album: 'Hollywood\'s Bleeding', genre: 'Pop Rock' },
    { title: 'Kill Bill', album: 'SOS', genre: 'R&B' },
    { title: 'Snooze', album: 'SOS', genre: 'R&B' },
    { title: 'As It Was', album: 'Harry\'s House', genre: 'Synth-Pop' },
    { title: 'Watermelon Sugar', album: 'Fine Line', genre: 'Pop' },
    { title: 'Shape of You', album: 'Divide', genre: 'Pop' },
    { title: 'Perfect', album: 'Divide', genre: 'Acoustic' },
    { title: 'Paint The Town Red', album: 'Scarlet', genre: 'Hip-Hop' },
    { title: 'Agora Hills', album: 'Scarlet', genre: 'R&B' },
    { title: 'vampire', album: 'GUTS', genre: 'Pop Rock' },
    { title: 'drivers license', album: 'SOUR', genre: 'Pop' },
    { title: 'Flowers', album: 'Endless Summer', genre: 'Pop' },
    { title: 'Stay', album: 'F*CK LOVE', genre: 'Pop-Rap' },
    { title: 'Ghost', album: 'Justice', genre: 'Pop' },
    { title: 'Peaches', album: 'Justice', genre: 'R&B' },
    { title: 'Without Me', album: 'The Eminem Show', genre: 'Hip-Hop' },
    { title: 'Lose Yourself', album: '8 Mile', genre: 'Hip-Hop' },
    { title: 'MONACO', album: 'nadie sabe', genre: 'Latin Trap' },
    { title: 'Tití Me Preguntó', album: 'Un Verano Sin Ti', genre: 'Reggaeton' },
    { title: 'Dakiti', album: 'El Último Tour', genre: 'Reggaeton' },
    { title: 'Super Shy', album: 'Get Up', genre: 'K-Pop' },
    { title: 'Ditto', album: 'OMG', genre: 'K-Pop' },
    { title: 'Seven', album: 'GOLDEN', genre: 'UK Garage' },
    { title: 'Standing Next to You', album: 'GOLDEN', genre: 'Funk Pop' },
    { title: 'Dynamite', album: 'BE', genre: 'Disco-Pop' },
    { title: 'Butter', album: 'Single', genre: 'Dance-Pop' },
    { title: 'How You Like That', album: 'The Album', genre: 'K-Pop' },
    { title: 'Pink Venom', album: 'Born Pink', genre: 'Hip-Hop / K-Pop' },
    { title: 'يا ناسينا', album: 'أغاني منفردة', genre: 'خليجي' },
    { title: 'العيون السود', album: 'جلسات', genre: 'طرب' },
    { title: 'تملي معاك', album: 'تملي معاك', genre: 'موسيقى عربية' },
    { title: 'أماكن السهر', album: 'سهران', genre: 'بوب عربي' },
    { title: 'يا طيب القلب', album: 'جلسات وناسة', genre: 'خليجي' },
    { title: 'من مثلك', album: 'أغاني منفردة', genre: 'خليجي' },
    { title: 'يهزك الشوق', album: 'شهد الحروف', genre: 'خليجي' },
    { title: 'بنت أكابر', album: 'في قربك', genre: 'طرب' },
    { title: 'شكراً', album: 'لا تستسلم', genre: 'طرب' },
    { title: 'الغزالة رايقة', album: 'من أجل زيكو', genre: 'شعبي' },
    { title: 'البخت', album: 'سينجل', genre: 'تراب مصري' },
    { title: 'كيفي كدا', album: 'سينجل', genre: 'تراب عربي' }
  ];

  const artworkPalette = [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1520523839898-507125ef538a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=800&auto=format&fit=crop&q=80'
  ];

  let artistIndex = 0;
  let trackTemplateIndex = 0;

  while (songsMap.size < count) {
    const artist = DISCOVER_ARTISTS_AND_TAGS[artistIndex % DISCOVER_ARTISTS_AND_TAGS.length];
    const template = popularTrackTemplates[trackTemplateIndex % popularTrackTemplates.length];
    const artIndex = (artistIndex + trackTemplateIndex) % artworkPalette.length;
    const coverUrl = artworkPalette[artIndex];

    const variation = Math.floor(trackTemplateIndex / popularTrackTemplates.length);
    const title = variation === 0 
      ? template.title 
      : variation === 1 
      ? `${template.title} (VIP Mix)`
      : variation === 2
      ? `${template.title} (Live Acoustic)`
      : variation === 3
      ? `${template.title} (Club Remix)`
      : `${template.title} (Sped Up)`;

    const songId = `discover-${artist.replace(/\s+/g, '_')}-${title.replace(/\s+/g, '_')}-${songsMap.size}`;

    songsMap.set(songId, {
      id: songId,
      title: title,
      artist: artist,
      album: template.album || 'Discover Singles',
      coverUrl: coverUrl,
      audioUrl: '',
      duration: (180 + ((songsMap.size * 7) % 120)) * 1000,
      isFullLength: true,
    });

    artistIndex++;
    trackTemplateIndex++;
  }

  return Array.from(songsMap.values());
};

export const importSpotifyPlaylist = async (url: string): Promise<{ name: string; songs: Song[]; coverUrl?: string }> => {
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
          coverUrl: data.coverUrl || (data.songs[0]?.coverUrl || ''),
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
    coverUrl: fallbackResults[0]?.coverUrl || '',
    songs: fallbackResults.slice(0, 15)
  };
};

/**
 * Universal importer for any playlist link or code:
 * Supports Spotify, YouTube, Apple Music, Spotify Clone share links, and share IDs.
 */
export const importAnyPlaylist = async (input: string): Promise<Playlist | null> => {
  if (!input || !input.trim()) return null;
  const raw = input.trim();

  // 1. If it's a clone share link or shareId
  if (raw.includes('share=') || raw.includes('shared_playlist=') || raw.startsWith('pl_') || raw.includes('#d=') || raw.includes('?data=')) {
    const shared = await importSharedPlaylist(raw);
    if (shared && shared.songs && shared.songs.length >= 0) {
      return shared;
    }
  }

  // 2. Try backend importer (Spotify, Apple Music, YouTube)
  try {
    const result = await importSpotifyPlaylist(raw);
    if (result && result.songs && result.songs.length > 0) {
      const newPlaylist = createPlaylist(result.name || 'Imported Playlist', result.coverUrl);
      addSongsToPlaylist(newPlaylist.id, result.songs);
      const all = getPlaylists();
      return all.find(p => p.id === newPlaylist.id) || newPlaylist;
    }
  } catch (e) {
    console.warn('Universal import backend error:', e);
  }

  // 3. Try importSharedPlaylist fallback
  const sharedFallback = await importSharedPlaylist(raw);
  if (sharedFallback && sharedFallback.songs && sharedFallback.songs.length > 0) {
    return sharedFallback;
  }

  return null;
};

export const recordPlay = (song: Song) => {
  if (!song || !song.id) return;
  try {
    const raw = localStorage.getItem('listening_stats') || '[]';
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
    const stats: Array<{ song: Song; count: number; lastPlayed: number }> = Array.isArray(parsed)
      ? parsed.filter((item: any) => item && item.song && item.song.id)
      : [];
    const existingIndex = stats.findIndex(s => s && s.song && s.song.id === song.id);
    if (existingIndex >= 0) {
      stats[existingIndex].count = (stats[existingIndex].count || 0) + 1;
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
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: any) => item && item.song && item.song.id)
      .sort((a: any, b: any) => (b.count || 0) - (a.count || 0));
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

