import scdlModule from 'soundcloud-downloader';
const scdl = scdlModule.default || scdlModule;
async function test() {
  const search = await scdl.search({ query: "راشد الماجد مشكلني", resourceType: 'tracks', limit: 20 });
  const expectedDuration = 360000;
  
  const translatedTitle = "راشد الماجد - مشكلني";
  const titleWords = translatedTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  const scored = search.collection.map(t => {
     const diffRatio = Math.abs(t.duration - expectedDuration) / expectedDuration;
     const playsScore = Math.log10(t.playback_count || 1);
     
     const tTitle = t.title.toLowerCase();
     let overlap = 0;
     for (let w of titleWords) {
        if (tTitle.includes(w)) overlap++;
     }
     
     const score = (playsScore * 2) - (diffRatio * 15) + (overlap * 20);
     return { title: t.title, overlap, score: score.toFixed(2) };
  }).sort((a,b) => parseFloat(b.score) - parseFloat(a.score));
  
  console.log(scored.slice(0, 5));
}
test();
