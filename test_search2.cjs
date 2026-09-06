const ytSearch = require('yt-search');
async function test(title, artist) {
  const cleanTitle = title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
  const q = artist ? `${cleanTitle} ${artist} audio` : `${cleanTitle} audio`;
  const result = await ytSearch(q);
  const videos = result.videos || [];
  
  const badWords = ['10 hours', '1 hour', 'reaction', 'review', 'tutorial', 'how to play', 'unboxing', 'interview', 'podcast', 'roblox', 'minecraft', 'parody', 'karaoke', 'instrumental', 'cover'];
  
  const scoreVideo = (v) => {
    let score = 0;
    const t = v.title.toLowerCase();
    const a = (v.author?.name || '').toLowerCase();
    const sec = v.seconds || 0;
    
    if (sec < 45 || sec > 600) return -100;
    if (badWords.some(w => t.includes(w))) return -100;
    
    if (a.endsWith('- topic')) score += 60;
    if (t.includes('(official audio)') || t.includes('(audio)')) score += 40;
    if (t.includes('official music video') || t.includes('official video') || t.includes('music video')) score += 25;
    if (t.includes('lyrics') || t.includes('lyric video')) score += 20;
    
    const titleWords = cleanTitle.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    let matches = 0;
    for (const w of titleWords) {
      if (t.includes(w)) matches++;
    }
    score += matches * 15;
    
    if (artist) {
      const artistWords = artist.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      for (const w of artistWords) {
        if (t.includes(w) || a.includes(w)) score += 10;
      }
    }
    
    return score;
  };
  
  const scored = videos.map(v => ({ v, score: scoreVideo(v) })).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  
  console.log('--- Query:', q, '---');
  if (scored.length > 0) {
    console.log('Top match:', scored[0].v.title, '||', scored[0].v.author.name, '|| Score:', scored[0].score);
    console.log('Top 3:', scored.slice(0,3).map(x => `${x.v.title} (${x.score})`).join(', '));
  } else {
    console.log('No matches found for', q);
  }
}
async function run() {
  await test('Snooze', 'SZA');
  await test('Escapism.', 'RAYE');
}
run();
