import scdlModule from 'soundcloud-downloader';
const scdl = scdlModule.default || scdlModule;
async function test() {
  const search = await scdl.search({ query: "راشد الماجد مشكلني", resourceType: 'tracks', limit: 20 });
  const expectedDuration = 360000; // 6 mins (actually 294s is the song without intro, but yt video is 360s)
  
  const scored = search.collection.map(t => {
     // Duration penalty (0 to 1) - closer to expected is better. 
     // We allow up to 40% deviation because music videos often have 1-minute intro acting.
     const diffRatio = Math.abs(t.duration - expectedDuration) / expectedDuration;
     
     // Plays score: log scale
     const playsScore = Math.log10(t.playback_count || 1);
     
     const score = playsScore - (diffRatio * 5); // penalize duration heavily
     return { title: t.title, duration: Math.round(t.duration/1000) + 's', plays: t.playback_count, score: score.toFixed(2) };
  }).sort((a,b) => parseFloat(b.score) - parseFloat(a.score));
  
  console.log(scored.slice(0, 5));
}
test();
