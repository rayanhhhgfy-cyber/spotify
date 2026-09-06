const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

const searchRegex = /app\.get\('\/api\/search', async \(req, res\) => \{[\s\S]*?\}\);\n\n\/\/ 2\. Resolve endpoint/m;
const newSearch = `app.get('/api/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) return res.json({ songs: [] });
  try {
    const itunesPromise = fetch(\`https://itunes.apple.com/search?term=\${encodeURIComponent(query)}&entity=song&limit=15\`)
      .then(async r => {
        if (!r.ok) return [];
        const data = await r.json();
        if (!data || !Array.isArray(data.results)) return [];
        return data.results.map((r) => {
          const art = (r.artworkUrl100 || r.artworkUrl60 || '').replace('100x100bb', '600x600bb');
          return {
            id: \`itunes-\${r.trackId || Math.random()}\`,
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

    const audiusPromise = fetch(\`https://api.audius.co/v1/tracks/search?query=\${encodeURIComponent(query)}&app_name=SPOTIFY_CLONE\`)
      .then(async r => {
        if (!r.ok) return [];
        const data = await r.json();
        if (!data || !Array.isArray(data.data)) return [];
        return data.data.slice(0, 10).map((item) => {
          const trackId = item.id || item.track_id;
          const art = item.artwork ? (item.artwork['480x480'] || item.artwork['150x150'] || item.artwork['1000x1000']) : null;
          return {
            id: \`audius-\${trackId}\`,
            title: item.title || 'Unknown Title',
            artist: item.user?.name || 'Unknown Artist',
            album: item.user?.handle ? \`@\${item.user.handle}\` : 'Single',
            coverUrl: art || 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg',
            audioUrl: \`https://api.audius.co/v1/tracks/\${trackId}/stream?app_name=SPOTIFY_CLONE\`,
            streamMirrors: [\`https://api.audius.co/v1/tracks/\${trackId}/stream?app_name=SPOTIFY_CLONE\`],
            duration: (item.duration || 180) * 1000,
            isFullLength: true,
            youtubeId: undefined
          };
        });
      }).catch(() => []);

    const [itunesSongs, audiusSongs] = await Promise.all([itunesPromise, audiusPromise]);
    const combined = [...itunesSongs, ...audiusSongs];

    const seen = new Set();
    const unique = combined.filter(song => {
      const key = \`\${song.title.toLowerCase()}-\${song.artist.toLowerCase()}\`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.json({ songs: unique });
  } catch (error) {
    return res.status(500).json({ error: error.message, songs: [] });
  }
});

// 2. Resolve endpoint`;

code = code.replace(searchRegex, newSearch);

// Also update the scoring logic in /api/resolve
const resolveRegex = /const scoreVideo = \(\(v: ytSearch\.VideoSearchResult\) => \{[\s\S]*?return score;\n    \}\);/m;
const newResolve = `const scoreVideo = (v: ytSearch.VideoSearchResult) => {
      let score = 0;
      const t = v.title.toLowerCase();
      const a = (v.author?.name || '').toLowerCase();
      const sec = v.seconds || 0;

      if (sec < 45 || sec > 600) return -100;
      const badWords = ['10 hours', '1 hour', 'reaction', 'review', 'tutorial', 'how to play', 'unboxing', 'interview', 'podcast', 'roblox', 'minecraft', 'parody', 'karaoke', 'instrumental', 'cover'];
      if (badWords.some(w => t.includes(w))) return -100;

      if (a.endsWith('- topic')) score += 60;
      if (t.includes('(official audio)') || t.includes('(audio)')) score += 40;
      if (t.includes('official music video') || t.includes('official video') || t.includes('music video')) score += 25;
      if (t.includes('lyrics') || t.includes('lyric video')) score += 20;

      const titleWords = cleanTitle.toLowerCase().split(/\\s+/).filter(w => w.length > 1);
      let matches = 0;
      for (const w of titleWords) {
        if (t.includes(w)) matches++;
      }
      score += matches * 15;

      if (artist) {
        const artistWords = artist.toLowerCase().split(/\\s+/).filter(w => w.length > 1);
        for (const w of artistWords) {
          if (t.includes(w) || a.includes(w)) score += 10;
        }
      }

      return score;
    };`;

code = code.replace(resolveRegex, newResolve);

fs.writeFileSync('server.ts', code);
