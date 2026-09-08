const reqTitle = "Mashkalni";
const reqArtist = "Rashed Al Majid";
const translatedTitle = "راشد الماجد - مشكلني (فيديو كليب) | 2002".replace(/[\(\[].*?[\)\]]/g, '').replace(/\|.*/, '').trim();

const titleWords = translatedTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== '-');

console.log("Title words:", titleWords);

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
   for (let w of titleWords) {
      if (tTitle.includes(w)) overlap++;
   }
   
   // Bonus if the english original title is present
   const engTitle = reqTitle.toLowerCase();
   if (tTitle.includes(engTitle)) overlap += 2;

   const score = (playsScore * 2) - (diffRatio * 15) + (overlap * 20);
   return { title: t.title, overlap, playsScore, diffRatio, score };
}).sort((a,b) => b.score - a.score);

console.log(scored);
