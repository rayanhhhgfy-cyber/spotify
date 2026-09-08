import scdlModule from 'soundcloud-downloader';
const scdl = scdlModule.default || scdlModule;
async function test() {
  const search = await scdl.search({ query: "مشكلني", resourceType: 'tracks', limit: 15 });
  search.collection.forEach(t => {
     if (t.duration > 200000 && t.duration < 400000)
       console.log(t.title, t.playback_count);
  });
}
test();
