const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

const resolveRegex = /const scoreVideo = \(\(v: ytSearch\.VideoSearchResult\) => \{[\s\S]*?return score;\n    \}\);/m;
const newResolve = `const scoreVideo = (v: ytSearch.VideoSearchResult) => {
      let score = 0;
      const t = v.title.toLowerCase();
      const a = (v.author?.name || '').toLowerCase();
      const sec = v.seconds || 0;

      if (sec < 45 || sec > 600) return -100;
      const badWords = ['10 hours', '1 hour', 'reaction', 'review', 'tutorial', 'how to play', 'unboxing', 'interview', 'podcast', 'roblox', 'minecraft', 'parody', 'karaoke', 'instrumental', 'cover'];
      if (badWords.some(w => t.includes(w))) return -100;

      if (a.endsWith('- topic')) score += 30;
      if (t.includes('(official audio)') || t.includes('(audio)')) score += 30;
      if (t.includes('official music video') || t.includes('official video') || t.includes('music video')) score += 20;
      if (t.includes('lyrics') || t.includes('lyric video')) score += 10;

      const titleWords = cleanTitle.toLowerCase().split(/\\s+/).filter(w => w.length > 1);
      let matches = 0;
      for (const w of titleWords) {
        if (t.includes(w)) matches++;
      }
      score += matches * 20;

      if (artist) {
        const artistWords = artist.toLowerCase().split(/\\s+/).filter(w => w.length > 1);
        let artistMatches = 0;
        for (const w of artistWords) {
          if (t.includes(w) || a.includes(w)) artistMatches++;
        }
        score += artistMatches * 30;
      }

      return score;
    };`;

code = code.replace(resolveRegex, newResolve);
fs.writeFileSync('server.ts', code);
