import scdlModule from 'soundcloud-downloader';
const scdl = scdlModule.default || scdlModule;
async function test() {
  const search = await scdl.search({ query: "راشد الماجد مشكلني", resourceType: 'tracks', limit: 20 });
  search.collection.forEach(t => {
     console.log(t.title, Math.round(t.duration/1000) + 's');
  });
}
test();
