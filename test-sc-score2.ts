import scdlModule from 'soundcloud-downloader';
const scdl = scdlModule.default || scdlModule;
async function test() {
  const search = await scdl.search({ query: "راشد الماجد مشكلني", resourceType: 'tracks', limit: 30 });
  const expectedDuration = 360000;
  
  const titleWords = ["مشكلني"];
  let validTracks = search.collection.filter(t => titleWords.some(w => t.title.toLowerCase().includes(w)));
  
  const scored = validTracks.map(t => {
     // Expected is 360s. We know official song audio is 294s.
     // So a track of 215s is bad (too short). A track of 297s is great.
     const diffRatio = Math.abs(t.duration - expectedDuration) / expectedDuration;
     const playsScore = Math.log10(t.playback_count || 1);
     
     // 10 * log10(plays) - (diffRatio * 50)
     const score = (playsScore * 2) - (diffRatio * 15);
     return { title: t.title, duration: Math.round(t.duration/1000) + 's', plays: t.playback_count, score: score.toFixed(2) };
  }).sort((a,b) => parseFloat(b.score) - parseFloat(a.score));
  
  console.log(scored);
}
test();
