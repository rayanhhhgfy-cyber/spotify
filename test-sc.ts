import scdlModule from 'soundcloud-downloader';
const scdl = scdlModule.default || scdlModule;

async function test() {
  const search = await scdl.search({ query: "راشد الماجد مشكلني", resourceType: 'tracks', limit: 5 });
  for (let t of search.collection) {
    console.log(t.title, "Likes:", t.likes_count, "Plays:", t.playback_count, "URL:", t.permalink_url);
  }
}
test();
