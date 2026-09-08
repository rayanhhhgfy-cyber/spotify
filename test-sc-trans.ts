import scdlModule from 'soundcloud-downloader';
const scdl = scdlModule.default || scdlModule;
async function test() {
  const search = await scdl.search({ query: "مشكلني", resourceType: 'tracks', limit: 1 });
  const t = search.collection[0];
  console.log(t.media ? "Has media" : "No media");
  if (t.media) {
    console.log(t.media.transcodings.map(tr => tr.format.protocol));
  }
}
test();
