const reqTitle = "Mashkalni";
const reqArtist = "Rashed Al Majid";
const translatedTitle = "راشد الماجد - مشكلني (فيديو كليب) | 2002".replace(/[\(\[].*?[\)\]]/g, '').replace(/\|.*/, '').trim();
// translatedTitle = "راشد الماجد - مشكلني"

const artistWords = reqArtist.toLowerCase().split(/\s+/).filter(w => w.length > 2);
const titleWords = translatedTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
const allWords = Array.from(new Set([...artistWords, ...titleWords]));

console.log("All words:", allWords);

const tracks = [
  { title: "Majed almohandes - Rashed Al Majid", duration: 605000, playback_count: 500000 },
  { title: "مشكلني fusion --- راشد الماجد", duration: 297000, playback_count: 11000 },
  { title: "راشد الماجد & اميمه طالب - انتي مثل ما انتي | Enti - Rashed Al Majid & Oumaima Taleb", duration: 300000, playback_count: 2000000 }
];
const expectedDuration = 360000;

const scored = tracks.map(t => {
   const diffRatio = Math.abs(t.duration - expectedDuration) / expectedDuration;
   const playsScore = Math.log10(t.playback_count || 1);
   const tTitle = t.title.toLowerCase();
   
   let overlap = 0;
   for (let w of allWords) {
      if (tTitle.includes(w)) overlap++;
   }

   const score = (playsScore * 2) - (diffRatio * 15) + (overlap * 20);
   return { title: t.title, overlap, playsScore, diffRatio, score };
}).sort((a,b) => b.score - a.score);

console.log(scored);
