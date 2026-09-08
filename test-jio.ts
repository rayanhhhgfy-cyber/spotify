async function test() {
  const query = "مشكلني راشد الماجد";
  const res = await fetch(`https://saavn.me/search/songs?query=${encodeURIComponent(query)}&limit=5`);
  const data = await res.json();
  console.log(JSON.stringify(data.data.results.map(r => ({title: r.name, url: r.downloadUrl})), null, 2));
}
test();
