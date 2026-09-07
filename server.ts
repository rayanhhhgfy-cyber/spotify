import express from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import https from 'https';
import ytSearch from 'yt-search';
import ytdl from '@distube/ytdl-core';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// yt-dlp binary path and stream cache
const ytdlpPath = fs.existsSync(path.join(process.cwd(), 'yt-dlp'))
  ? path.join(process.cwd(), 'yt-dlp')
  : fs.existsSync(path.join(process.cwd(), 'bin', 'yt-dlp'))
  ? path.join(process.cwd(), 'bin', 'yt-dlp')
  : '/usr/local/bin/yt-dlp';

try {
  if (fs.existsSync(ytdlpPath)) {
    fs.chmodSync(ytdlpPath, '755');
  }
} catch (e) {
  console.warn('Failed to chmod yt-dlp:', e);
}

const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();

app.use(express.json({ limit: '10mb' }));

// CORS middleware to allow cross-origin requests from custom subdomains (e.g. spotify-rayyan.vercel.app)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Shared playlists persistence
const DATA_DIR = path.join(process.cwd(), 'data');
const SHARED_PLAYLISTS_FILE = path.join(DATA_DIR, 'shared_playlists.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {}

function getSharedPlaylists(): Record<string, any> {
  try {
    if (fs.existsSync(SHARED_PLAYLISTS_FILE)) {
      const content = fs.readFileSync(SHARED_PLAYLISTS_FILE, 'utf-8');
      return JSON.parse(content || '{}');
    }
  } catch (e) {
    console.error('Error reading shared playlists:', e);
  }
  return {};
}

function saveSharedPlaylistToDisk(id: string, playlistData: any) {
  try {
    const all = getSharedPlaylists();
    all[id] = {
      ...playlistData,
      shareId: id,
      updatedAt: Date.now()
    };
    fs.writeFileSync(SHARED_PLAYLISTS_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving shared playlist:', e);
  }
}

// Format YouTube search results into unified Song format
function formatYtVideo(v: ytSearch.VideoSearchResult) {
  const streamUrl = `/api/stream/youtube/${v.videoId}`;
  return {
    id: `yt-${v.videoId}`,
    title: v.title.replace(/\s*(\[Official.*?\]|\(Official.*?\)|Official Video|Official Audio|فيديو كليب|النسخة الأصلية|حصرياً|\(Audio\))\s*/gi, '').trim(),
    artist: v.author?.name ? v.author.name.replace(/\s*-\s*Topic$/i, '').trim() : 'Unknown Artist',
    album: 'Single',
    coverUrl: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    audioUrl: streamUrl,
    streamMirrors: [streamUrl],
    duration: (v.seconds || 180) * 1000,
    youtubeId: v.videoId,
    isFullLength: true,
  };
}

// 1. Search endpoint: searches YouTube + Audius + iTunes with full song support
app.get('/api/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) return res.json({ songs: [] });
  try {
    const ytPromise = ytSearch(query)
      .then(r => (r.videos || []).slice(0, 10).map(formatYtVideo))
      .catch(() => []);

    const itunesPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`)
      .then(async r => {
        if (!r.ok) return [];
        const data = await r.json();
        if (!data || !Array.isArray(data.results)) return [];
        return data.results.map((r) => {
          const art = (r.artworkUrl100 || r.artworkUrl60 || '').replace('100x100bb', '600x600bb');
          return {
            id: `itunes-${r.trackId || Math.random()}`,
            title: r.trackName || 'Unknown Title',
            artist: r.artistName || 'Unknown Artist',
            album: r.collectionName || 'Single',
            coverUrl: art || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
            audioUrl: r.previewUrl || '',
            streamMirrors: r.previewUrl ? [r.previewUrl] : [],
            duration: r.trackTimeMillis || 200000,
            isFullLength: false,
            youtubeId: undefined
          };
        });
      }).catch(() => []);

    const audiusPromise = fetch(`https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=SPOTIFY_CLONE`)
      .then(async r => {
        if (!r.ok) return [];
        const data = await r.json();
        if (!data || !Array.isArray(data.data)) return [];
        return data.data.slice(0, 5).map((item) => {
          const trackId = item.id || item.track_id;
          const art = item.artwork ? (item.artwork['480x480'] || item.artwork['150x150'] || item.artwork['1000x1000']) : null;
          return {
            id: `audius-${trackId}`,
            title: item.title || 'Unknown Title',
            artist: item.user?.name || 'Unknown Artist',
            album: item.user?.handle ? `@${item.user.handle}` : 'Single',
            coverUrl: art || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
            audioUrl: `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`,
            streamMirrors: [`https://api.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`],
            duration: (item.duration || 180) * 1000,
            isFullLength: true,
            youtubeId: undefined
          };
        });
      }).catch(() => []);

    const [ytSongs, itunesSongs, audiusSongs] = await Promise.all([ytPromise, itunesPromise, audiusPromise]);
    const combined = [...ytSongs, ...itunesSongs, ...audiusSongs];

    const seen = new Set();
    const unique = combined.filter(song => {
      const key = `${song.title.toLowerCase()}-${song.artist.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.json({ songs: unique });
  } catch (error) {
    return res.status(500).json({ error: error.message, songs: [] });
  }
});

// 2. Resolve endpoint: finds exact full-length YouTube track and backup IDs
app.get('/api/resolve', async (req, res) => {
  const title = (req.query.title as string || '').trim();
  const artist = (req.query.artist as string || '').trim();
  const cleanTitle = title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
  const q = (req.query.q as string || (artist ? `${cleanTitle} ${artist} audio` : `${cleanTitle} audio`)).trim();

  if (!q) {
    return res.status(400).json({ error: 'Missing query' });
  }

  try {
    const result = await ytSearch(q);
    const videos = result.videos || [];

    const badWords = ['10 hours', '1 hour', 'reaction', 'review', 'tutorial', 'how to play', 'unboxing', 'interview', 'podcast', 'roblox', 'minecraft', 'parody', 'karaoke', 'instrumental', 'cover'];

    const scoreVideo = (v: ytSearch.VideoSearchResult) => {
      let score = 0;
      const t = v.title.toLowerCase();
      const a = (v.author?.name || '').toLowerCase();
      const sec = v.seconds || 0;

      if (sec < 45 || sec > 600) return -100;
      if (badWords.some(w => t.includes(w))) return -100;

      // Prefer official topic / album audio releases (these allow embedding 100% of the time and have no video dialogues)
      if (a.endsWith('- topic')) score += 30;
      if (t.includes('(official audio)') || t.includes('(audio)')) score += 30;
      if (t.includes('official music video') || t.includes('official video') || t.includes('music video')) score += 20;
      if (t.includes('lyrics') || t.includes('lyric video')) score += 10;

      // Word matches for title
      const titleWords = cleanTitle.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      let matches = 0;
      for (const w of titleWords) {
        if (t.includes(w)) matches++;
      }
      score += matches * 20;

      // Word matches for artist
      if (artist) {
        const artistWords = artist.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        let artistMatches = 0;
        for (const w of artistWords) {
          if (t.includes(w) || a.includes(w)) artistMatches++;
        }
        score += artistMatches * 30;
      }

      return score;
    };

    const scored = videos
      .map(v => ({ v, score: scoreVideo(v) }))
      .filter(x => x.score > 0);

    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const top = scored[0].v;
      const backupIds = scored.slice(1, 4).map(x => x.v.videoId);
      return res.json({
        youtubeId: top.videoId,
        backupYoutubeIds: backupIds,
        title: top.title.replace(/\s*(\[Official.*?\]|\(Official.*?\)|Official Video|Official Audio|\(Audio\))\s*/gi, '').trim(),
        artist: top.author?.name ? top.author.name.replace(/\s*-\s*Topic$/i, '').trim() : artist,
        duration: (top.seconds || 200) * 1000,
        coverUrl: top.thumbnail || `https://i.ytimg.com/vi/${top.videoId}/hqdefault.jpg`,
        isFullLength: true,
      });
    }

    // Fallback to top unpenalized video if scoring had no positive matches
    if (videos.length > 0) {
      const fallback = videos[0];
      return res.json({
        youtubeId: fallback.videoId,
        backupYoutubeIds: videos.slice(1, 3).map(v => v.videoId),
        title: fallback.title,
        artist: fallback.author?.name || artist,
        duration: (fallback.seconds || 200) * 1000,
        coverUrl: fallback.thumbnail || `https://i.ytimg.com/vi/${fallback.videoId}/hqdefault.jpg`,
        isFullLength: true,
      });
    }

    return res.status(404).json({ error: 'Song not found' });
  } catch (error: any) {
    console.error('Resolve error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/stream/youtube/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.status(400).send('Invalid or missing ID');

    // 1. Check in-memory stream URL cache
    let streamUrl: string | null = null;
    const cached = streamUrlCache.get(id);
    if (cached && cached.expiresAt > Date.now() + 60000) {
      streamUrl = cached.url;
    }

    // 2. Extract with yt-dlp if not cached
    if (!streamUrl && fs.existsSync(ytdlpPath)) {
      try {
        const extractedUrl = await new Promise<string>((resolve, reject) => {
          execFile(
            ytdlpPath,
            ['-g', '-f', '140/ba[ext=m4a]/ba/b', '--no-warnings', '--no-playlist', `https://www.youtube.com/watch?v=${id}`],
            { timeout: 12000 },
            (err, stdout) => {
              if (err) return reject(err);
              const lines = stdout.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
              const url = lines[0];
              if (url && url.startsWith('http')) {
                resolve(url);
              } else {
                reject(new Error('No stream URL in output'));
              }
            }
          );
        });

        if (extractedUrl) {
          streamUrl = extractedUrl;
          streamUrlCache.set(id, { url: extractedUrl, expiresAt: Date.now() + 4 * 60 * 60 * 1000 });
        }
      } catch (e: any) {
        // Silently catch yt-dlp failures as YouTube blocks datacenter IPs
        // The frontend will automatically fall back to iTunes/Audius if this endpoint returns 404
      }
    }

    // 3. Fallback to Piped API stream if yt-dlp did not produce URL
    if (!streamUrl) {
      const pipedInstances = [
        'https://pipedapi.kavin.rocks',
        'https://api.piped.privacydev.net',
        'https://pipedapi.adminforge.de'
      ];
      for (const instance of pipedInstances) {
        try {
          const resp = await fetch(`${instance}/streams/${id}`, { signal: AbortSignal.timeout(3500) });
          if (resp.ok) {
            const data: any = await resp.json();
            const audioStreams = data.audioStreams || [];
            const best = audioStreams.find((s: any) => s.mimeType?.includes('mp4') || s.mimeType?.includes('audio')) || audioStreams[0];
            if (best?.url) {
              streamUrl = best.url;
              streamUrlCache.set(id, { url: best.url, expiresAt: Date.now() + 3 * 60 * 60 * 1000 });
              break;
            }
          }
        } catch (e) {}
      }
    }

    // 4. Fallback to ytdl if still no stream
    if (!streamUrl) {
      try {
        const info = await ytdl.getInfo(id);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        const format = ytdl.chooseFormat(audioFormats, { quality: 'highestaudio' });
        if (format) {
          res.setHeader('Content-Type', 'audio/mp4');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return ytdl(id, { format }).pipe(res);
        }
      } catch (e) {
        // Fallback failed
      }
      return res.status(404).send('Stream unavailable, use client playback');
    }

    // 4. Proxy direct audio stream with full Range header support
    const targetUrl = new URL(streamUrl);
    const rangeHeader = req.headers.range;
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    };
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader;
    }

    const method = req.method === 'HEAD' ? 'HEAD' : 'GET';
    const proxyReq = https.request(
      {
        hostname: targetUrl.hostname,
        path: targetUrl.pathname + targetUrl.search,
        method: method,
        headers: requestHeaders
      },
      proxyRes => {
        const status = proxyRes.statusCode || 200;
        res.status(status);
        const upstreamContentType = proxyRes.headers['content-type'];
        const contentType = upstreamContentType && !upstreamContentType.includes('text') && !upstreamContentType.includes('html')
          ? (upstreamContentType.includes('mp4') || upstreamContentType.includes('m4a') ? 'audio/mp4' : upstreamContentType)
          : 'audio/mp4';
        res.setHeader('Content-Type', contentType);
        if (proxyRes.headers['content-length']) res.setHeader('Content-Length', proxyRes.headers['content-length']);
        if (proxyRes.headers['content-range']) res.setHeader('Content-Range', proxyRes.headers['content-range']);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=14400');

        if (req.method === 'HEAD') {
          res.end();
          proxyRes.destroy();
          return;
        }

        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      // Log proxy disconnects quietly (happens frequently during track scrubbing)
      if (!res.headersSent) res.status(502).send('Upstream stream error');
    });

    proxyReq.end();

    req.on('close', () => {
      proxyReq.destroy();
    });
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).send('Streaming failed');
    }
  }
});

// 3. Trending endpoint: returns curated trending songs (Arabic & Global top tracks in full length)
app.get('/api/trending', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string || '20', 10), 10), 100);
    const trendingQueries = [
      'The Weeknd', 'Taylor Swift', 'Drake', 'Billie Eilish', 'Dua Lipa', 'Bruno Mars',
      'راشد الماجد', 'عمرو دياب', 'عبدالمجيد عبدالله', 'ماجد المهندس', 'أصالة', 'محمد عبده',
      'Travis Scott', 'Kendrick Lamar', 'Ariana Grande', 'Post Malone', 'Harry Styles',
      'Ed Sheeran', 'Justin Bieber', 'Eminem', 'SZA', 'Olivia Rodrigo', 'Doja Cat',
      'Bad Bunny', 'BTS', 'BLACKPINK', 'NewJeans', 'Jung Kook', 'Coldplay', 'Imagine Dragons'
    ];

    const countQueries = Math.ceil(limit / 3);
    const randomQueries = [...trendingQueries].sort(() => Math.random() - 0.5).slice(0, countQueries);
    
    const results = await Promise.all(
      randomQueries.map(q => ytSearch(q).then(r => (r.videos || []).slice(0, 4).map(formatYtVideo)).catch(() => []))
    );

    const flat = results.flat();
    const seen = new Set<string>();
    const unique = flat.filter(song => {
      if (seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    });

    return res.json({ songs: unique });
  } catch (error: any) {
    console.error('Trending error:', error);
    return res.status(500).json({ error: error.message, songs: [] });
  }
});

// 4. Spotify, Apple Music & Playlist import endpoint
app.post('/api/import-playlist', async (req, res) => {
  let url = (req.body.url as string || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'Missing playlist URL', songs: [] });
  }

  try {
    // 0. Handle shortened URLs like spotify.link/xyz or youtu.be
    if (url.includes('spotify.link/') || url.includes('tinyurl.com/') || url.includes('bit.ly/')) {
      try {
        const headRes = await fetch(url, { redirect: 'follow' });
        url = headRes.url || url;
      } catch (e) {
        // continue with original url
      }
    }

    // 1. Check if user pasted a Spotify Clone internal share URL or shareId (e.g. ?share=pl_123 or pl_123)
    if (url.includes('share=') || url.includes('shared_playlist=') || url.startsWith('pl_') || url.includes('#d=')) {
      let shareId = '';
      if (url.startsWith('pl_')) {
        shareId = url.trim();
      } else {
        const m = url.match(/[?&]share=([^&#]+)/) || url.match(/[?&]shared_playlist=([^&#]+)/);
        if (m && m[1]) shareId = decodeURIComponent(m[1]);
      }
      if (shareId) {
        const all = getSharedPlaylists();
        if (all[shareId]) {
          return res.json({
            success: true,
            name: all[shareId].name,
            coverUrl: all[shareId].coverUrl,
            songs: all[shareId].songs || []
          });
        }
      }
    }

    // 2. Spotify URL parsing (playlist, album, track, artist, user playlist)
    const spotifyMatch = url.match(/(playlist|album|track|artist)\/([a-zA-Z0-9]+)/);
    if (spotifyMatch) {
      const type = spotifyMatch[1];
      const id = spotifyMatch[2];

      const embedRes = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (embedRes.ok) {
        const html = await embedRes.text();
        const scriptMatch = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([^<]+)<\/script>/);
        if (scriptMatch) {
          const data = JSON.parse(scriptMatch[1]);
          const entity = data.props?.pageProps?.state?.data?.entity;
          if (entity) {
            const playlistName = entity.name || entity.title || 'Spotify Playlist';
            const playlistCover = entity.coverArt?.sources?.[0]?.url || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg';
            const rawTracks: any[] = entity.trackList || entity.tracks?.items || entity.tracks || [];

            if (rawTracks.length > 0) {
              const selectedTracks = rawTracks.slice(0, 150);
              const resolvedSongs = selectedTracks.map((t: any, idx: number) => {
                const cleanTitle = (t.title || t.name || '').trim();
                const cleanArtist = (t.subtitle || (Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(', ') : t.artist) || '').trim();
                if (!cleanTitle) return null;

                const trackId = t.id || (t.uri ? t.uri.split(':')[2] : `${Date.now()}-${idx}`);
                return {
                  id: `sp-${trackId}`,
                  title: cleanTitle,
                  artist: cleanArtist || 'Unknown Artist',
                  album: playlistName,
                  coverUrl: t.album?.images?.[0]?.url || playlistCover,
                  audioUrl: t.audioPreview?.url || t.preview_url || '',
                  duration: t.duration || 180000,
                  isFullLength: false,
                };
              }).filter(Boolean);

              if (resolvedSongs.length > 0) {
                return res.json({
                  success: true,
                  name: playlistName,
                  coverUrl: playlistCover,
                  songs: resolvedSongs
                });
              }
            } else if (entity.title || entity.name) {
              // Single track
              const cleanTitle = (entity.title || entity.name).trim();
              const cleanArtist = (entity.subtitle || (Array.isArray(entity.artists) ? entity.artists.map((a: any) => a.name).join(', ') : entity.artist) || '').trim();
              return res.json({
                success: true,
                name: cleanTitle,
                coverUrl: playlistCover,
                songs: [{
                  id: `sp-${entity.id || id}`,
                  title: cleanTitle,
                  artist: cleanArtist || 'Unknown Artist',
                  album: 'Single',
                  coverUrl: playlistCover,
                  audioUrl: entity.audioPreview?.url || '',
                  duration: entity.duration || 180000,
                  isFullLength: false,
                }]
              });
            }
          }
        }
      }

      // Fallback: oEmbed
      try {
        const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
        if (oembedRes.ok) {
          const odata = await oembedRes.json();
          const plTitle = odata.title || 'Spotify Playlist';
          const ytRes = await ytSearch(plTitle);
          if (ytRes.videos && ytRes.videos.length > 0) {
            const songs = ytRes.videos.slice(0, 15).map(formatYtVideo);
            return res.json({ success: true, name: plTitle, songs });
          }
        }
      } catch (e) {}
    }

    // 3. Apple Music URL parsing
    const appleMatch = url.match(/music\.apple\.com\/([a-z]{2})\/(album|playlist)\/([^\/]+)\/([0-9]+|pl\.[a-zA-Z0-9]+)/);
    if (appleMatch) {
      const country = appleMatch[1];
      const kind = appleMatch[2];
      const titleSlug = decodeURIComponent(appleMatch[3]).replace(/-/g, ' ');
      const entityId = appleMatch[4];

      if (kind === 'album' && /^\d+$/.test(entityId)) {
        try {
          const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${entityId}&entity=song&limit=50&country=${country}`);
          if (lookupRes.ok) {
            const ldata = await lookupRes.json();
            if (ldata && Array.isArray(ldata.results) && ldata.results.length > 0) {
              const albumItem = ldata.results[0];
              const tracks = ldata.results.slice(1);
              const songs = tracks.map((r: any) => ({
                id: `itunes-${r.trackId}`,
                title: r.trackName || 'Unknown Title',
                artist: r.artistName || 'Unknown Artist',
                album: albumItem.collectionName || r.collectionName || 'Album',
                coverUrl: (r.artworkUrl100 || albumItem.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
                audioUrl: r.previewUrl || '',
                duration: r.trackTimeMillis || 180000,
                isFullLength: false,
              }));
              if (songs.length > 0) {
                return res.json({
                  success: true,
                  name: albumItem.collectionName || titleSlug,
                  songs
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    // 4. YouTube URL parsing (video or playlist)
    const ytVidMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytVidMatch) {
      const vidId = ytVidMatch[1];
      try {
        const ytRes = await ytSearch({ videoId: vidId });
        if (ytRes) {
          return res.json({
            success: true,
            name: ytRes.title,
            songs: [formatYtVideo(ytRes as any)]
          });
        }
      } catch (e) {}
    }

    // 5. Generic Search fallback
    const cleanQuery = url
      .replace(/^https?:\/\/[^\/]+\//, '')
      .replace(/[\/\?_\-=&]/g, ' ')
      .replace(/playlist|album|track/gi, '')
      .trim();

    const ytRes = await ytSearch(cleanQuery || 'Top Songs');
    const songs = (ytRes.videos || []).slice(0, 15).map(formatYtVideo);
    return res.json({
      success: true,
      name: cleanQuery ? `Import: ${cleanQuery}` : 'Imported Playlist',
      songs
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return res.status(500).json({ error: error.message, songs: [] });
  }
});

// 4. Share Playlist endpoints (Constant link for cross-device playlist sharing)
app.post('/api/share-playlist', (req, res) => {
  try {
    const { name, songs, shareId, description, coverUrl } = req.body;
    if (!name && (!songs || songs.length === 0)) {
      return res.status(400).json({ error: 'Playlist name or songs required' });
    }

    // Generate constant shareId if not already provided
    const id = (shareId && typeof shareId === 'string' && shareId.trim()) 
      ? shareId.trim() 
      : `pl_${Math.random().toString(36).substring(2, 9)}`;

    const playlistData = {
      id,
      shareId: id,
      name: name || 'Shared Playlist',
      description: description || '',
      coverUrl: coverUrl || (Array.isArray(songs) && songs[0]?.coverUrl ? songs[0].coverUrl : ''),
      songs: Array.isArray(songs) ? songs : [],
      createdAt: Date.now(),
    };

    saveSharedPlaylistToDisk(id, playlistData);

    return res.json({
      success: true,
      shareId: id,
      playlist: playlistData
    });
  } catch (err: any) {
    console.error('Error sharing playlist:', err);
    return res.status(500).json({ error: 'Failed to share playlist' });
  }
});

app.get('/api/share-playlist/:id', (req, res) => {
  try {
    const id = req.params.id;
    const all = getSharedPlaylists();
    const playlist = all[id];

    if (!playlist) {
      return res.status(404).json({ error: 'Shared playlist not found' });
    }

    return res.json({
      success: true,
      shareId: id,
      playlist
    });
  } catch (err: any) {
    console.error('Error retrieving shared playlist:', err);
    return res.status(500).json({ error: 'Failed to get shared playlist' });
  }
});

app.get('/api/shared/:id', (req, res) => {
  const id = req.params.id;
  const all = getSharedPlaylists();
  const playlist = all[id];
  if (!playlist) {
    return res.status(404).json({ error: 'Shared playlist not found' });
  }
  return res.json({ success: true, shareId: id, playlist });
});

app.get('/api/stream/soundcloud', async (req, res) => {
  try {
    const songUrl = (req.query.url as string || '').trim();
    const q = (req.query.q as string || '').trim();

    if (!songUrl && !q) {
      return res.status(400).send('Missing url or q parameter');
    }

    const scScraper = await import('soundcloud-scraper');
    const client = new scScraper.Client();

    let targetUrl = songUrl;

    if (!targetUrl && q) {
      const searchResults = await client.search(q, 'track');
      if (searchResults && searchResults.length > 0) {
        targetUrl = searchResults[0].url;
      }
    }

    if (!targetUrl) {
      return res.status(404).send('Track not found on SoundCloud');
    }

    const songInfo = await client.getSongInfo(targetUrl);
    if (!songInfo) {
      return res.status(404).send('Song info unavailable');
    }

    const stream = await songInfo.downloadProgressive();
    if (!stream) {
      return res.status(404).send('Progressive stream unavailable');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (req.method === 'HEAD') {
      return res.end();
    }

    stream.pipe(res);

    req.on('close', () => {
      if (stream.destroy) stream.destroy();
    });
  } catch (e: any) {
    console.error('SoundCloud streaming proxy error:', e);
    if (!res.headersSent) {
      res.status(500).send('SoundCloud stream failed');
    }
  }
});

app.get('/api/resolve/soundcloud', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    const titleQuery = (req.query.title as string || '').trim().toLowerCase();
    const artistQuery = (req.query.artist as string || '').trim().toLowerCase();
    if (!q && !titleQuery) return res.status(400).json({ error: 'Missing query' });
    
    const searchQuery = q || `${titleQuery} ${artistQuery}`.trim();
    const scScraper = await import('soundcloud-scraper');
    const client = new scScraper.Client();

    const searchResults = await client.search(searchQuery, 'track');
    if (!searchResults || searchResults.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const cleanTitle = titleQuery.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();

    const scoredTracks = searchResults.map((track: any) => {
      let score = 0;
      const trackName = (track.name || track.title || '').toLowerCase();
      const artistName = (track.artist || track.author?.name || '').toLowerCase();

      if (cleanTitle && trackName.includes(cleanTitle)) score += 50;
      if (artistQuery && (trackName.includes(artistQuery) || artistName.includes(artistQuery))) score += 40;

      const badWords = ['remix', 'remake', 'cover', 'live', 'sped up', 'slowed', '8d', '10 hours', 'karaoke', 'instrumental', 'bass boosted'];
      for (const bw of badWords) {
        if (!searchQuery.toLowerCase().includes(bw) && trackName.includes(bw)) {
          score -= 30;
        }
      }

      return { track, score };
    });

    scoredTracks.sort((a: any, b: any) => b.score - a.score);
    const bestMatch = scoredTracks[0]?.track || searchResults[0];

    const streamUrl = `/api/stream/soundcloud?url=${encodeURIComponent(bestMatch.url)}`;

    let durationSec = 210;
    try {
      const songInfo = await client.getSongInfo(bestMatch.url);
      if (songInfo && songInfo.duration) {
        durationSec = Math.round(songInfo.duration / 1000);
      }
    } catch (e) {}

    return res.json({
      audioUrl: streamUrl,
      duration: durationSec,
      title: bestMatch.name || bestMatch.title || titleQuery,
      artist: bestMatch.artist || bestMatch.author?.name || artistQuery,
      youtubeId: null
    });
  } catch (e: any) {
    console.error('SoundCloud resolve error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
