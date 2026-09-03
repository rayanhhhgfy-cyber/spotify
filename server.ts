import express from 'express';
import path from 'path';
import fs from 'fs';
import ytSearch from 'yt-search';
import ytdl from '@distube/ytdl-core';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

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
  return {
    id: `yt-${v.videoId}`,
    title: v.title.replace(/\s*(\[Official.*?\]|\(Official.*?\)|Official Video|Official Audio|فيديو كليب|النسخة الأصلية|حصرياً|\(Audio\))\s*/gi, '').trim(),
    artist: v.author?.name ? v.author.name.replace(/\s*-\s*Topic$/i, '').trim() : 'Unknown Artist',
    album: 'Single',
    coverUrl: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    audioUrl: '', // played via YouTube audio engine
    duration: (v.seconds || 180) * 1000,
    youtubeId: v.videoId,
    isFullLength: true,
  };
}

// 1. Search endpoint: searches YouTube + Audius with full song support
app.get('/api/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) {
    return res.json({ songs: [] });
  }

  try {
    const badWords = ['10 hours', '1 hour', 'roblox', 'minecraft', 'gameplay', 'walkthrough', 'unboxing', 'reaction to'];

    const ytPromise = ytSearch(query)
      .then(r => (r.videos || [])
        .filter(v => {
          const sec = v.seconds || 0;
          if (sec < 45 || sec > 700) return false;
          const t = v.title.toLowerCase();
          if (badWords.some(w => t.includes(w))) return false;
          return true;
        })
        .slice(0, 20)
        .map(formatYtVideo)
      )
      .catch(err => {
        console.warn('YouTube search error:', err.message);
        return [];
      });

    const audiusPromise = fetch(`https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=SPOTIFY_CLONE`)
      .then(async r => {
        if (!r.ok) return [];
        const data = await r.json();
        if (!data || !Array.isArray(data.data)) return [];
        return data.data.slice(0, 10).map((item: any) => {
          const trackId = item.id || item.track_id;
          const art = item.artwork ? (item.artwork['480x480'] || item.artwork['150x150'] || item.artwork['1000x1000']) : null;
          return {
            id: `audius-${trackId}`,
            title: item.title || 'Unknown Title',
            artist: item.user?.name || 'Unknown Artist',
            album: item.user?.handle ? `@${item.user.handle}` : 'Single',
            coverUrl: art || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
            audioUrl: `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`,
            streamMirrors: [
              `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`,
              `https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=SPOTIFY_CLONE`
            ],
            duration: (item.duration || 180) * 1000,
            isFullLength: true
          };
        });
      })
      .catch(() => []);

    const [ytSongs, audiusSongs] = await Promise.all([ytPromise, audiusPromise]);

    const combined = [...ytSongs, ...audiusSongs];

    // Deduplicate
    const seen = new Set<string>();
    const unique = combined.filter(song => {
      const key = `${song.title.toLowerCase()}-${song.artist.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.json({ songs: unique });
  } catch (error: any) {
    console.error('Search error:', error);
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

    const badWords = ['10 hours', '1 hour', 'reaction', 'review', 'tutorial', 'how to play', 'unboxing', 'interview', 'podcast', 'roblox', 'minecraft', 'parody'];

    const scoreVideo = (v: ytSearch.VideoSearchResult) => {
      let score = 0;
      const t = v.title.toLowerCase();
      const a = (v.author?.name || '').toLowerCase();
      const sec = v.seconds || 0;

      if (sec < 45 || sec > 600) return -100;
      if (badWords.some(w => t.includes(w))) return -100;

      // Prefer official topic / album audio releases (these allow embedding 100% of the time and have no video dialogues)
      if (a.endsWith('- topic')) score += 60;
      if (t.includes('(official audio)') || t.includes('(audio)')) score += 40;
      if (t.includes('official music video') || t.includes('official video')) score += 25;
      if (t.includes('lyrics') || t.includes('lyric video')) score += 20;

      // Word matches for title
      const titleWords = cleanTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let matches = 0;
      for (const w of titleWords) {
        if (t.includes(w)) matches++;
      }
      score += matches * 15;

      // Word matches for artist
      if (artist) {
        const artistWords = artist.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        for (const w of artistWords) {
          if (t.includes(w) || a.includes(w)) score += 10;
        }
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
    if (!id) return res.status(400).send('Missing ID');
    
    const info = await ytdl.getInfo(id);
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    const format = ytdl.chooseFormat(audioFormats, { quality: 'highestaudio' });
    
    if (!format) {
      return res.status(404).send('No audio format found');
    }
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days cache
    
    ytdl(id, { format }).pipe(res);
  } catch (error: any) {
    console.error('YTDL stream error:', error);
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

// 4. Spotify & Playlist import endpoint
app.post('/api/import-playlist', async (req, res) => {
  const url = (req.body.url as string || '').trim();
  if (!url) {
    return res.status(400).json({ error: 'Missing playlist URL', songs: [] });
  }

  try {
    // 1. Spotify URL parsing (playlist, album, track, artist, user playlist)
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
            const rawTracks: any[] = entity.trackList || entity.tracks?.items || entity.tracks || [];

            if (rawTracks.length > 0) {
              // Import all playlist tracks (up to 200 tracks)
              const selectedTracks = rawTracks.slice(0, 200);
              const resolvedSongs: any[] = [];
              const batchSize = 10;

              for (let i = 0; i < selectedTracks.length; i += batchSize) {
                const batch = selectedTracks.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                  batch.map(async (t: any) => {
                    const cleanTitle = (t.title || t.name || '').trim();
                    const cleanArtist = (t.subtitle || t.artists?.[0]?.name || t.artist || '').trim();
                    if (!cleanTitle) return null;

                    try {
                      const ytRes = await ytSearch(`${cleanTitle} ${cleanArtist}`);
                      if (ytRes.videos && ytRes.videos.length > 0) {
                        const top = ytRes.videos[0];
                        return {
                          id: `yt-${top.videoId}`,
                          title: cleanTitle,
                          artist: cleanArtist || top.author?.name || 'Unknown Artist',
                          album: playlistName,
                          coverUrl: top.thumbnail || `https://i.ytimg.com/vi/${top.videoId}/hqdefault.jpg`,
                          audioUrl: '',
                          duration: (top.seconds || 180) * 1000,
                          youtubeId: top.videoId,
                          isFullLength: true,
                        };
                      }
                    } catch (e) {}

                    // Fallback track object if search misses
                    return {
                      id: `sp-${t.id || Math.random().toString(36).substring(2, 9)}`,
                      title: cleanTitle,
                      artist: cleanArtist || 'Unknown Artist',
                      album: playlistName,
                      coverUrl: t.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
                      audioUrl: t.audioUrl || t.preview_url || '',
                      duration: t.duration || 180000,
                      isFullLength: false,
                    };
                  })
                );
                resolvedSongs.push(...batchResults.filter(Boolean));
              }

              if (resolvedSongs.length > 0) {
                return res.json({
                  success: true,
                  name: playlistName,
                  songs: resolvedSongs
                });
              }
            } else if (entity.title || entity.name) {
              // Single track / item
              const q = `${entity.title || entity.name} ${entity.subtitle || ''}`.trim();
              const ytRes = await ytSearch(q);
              if (ytRes.videos && ytRes.videos.length > 0) {
                const top = ytRes.videos[0];
                return res.json({
                  success: true,
                  name: entity.title || entity.name,
                  songs: [{
                    id: `yt-${top.videoId}`,
                    title: entity.title || entity.name,
                    artist: entity.subtitle || top.author?.name || 'Unknown Artist',
                    album: 'Single',
                    coverUrl: top.thumbnail || `https://i.ytimg.com/vi/${top.videoId}/hqdefault.jpg`,
                    audioUrl: '',
                    duration: (top.seconds || 180) * 1000,
                    youtubeId: top.videoId,
                    isFullLength: true,
                  }]
                });
              }
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

    // 2. Generic Search / Apple Music / YouTube URL or keyword search
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
