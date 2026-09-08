async function run() {
  const t = Date.now();
  const res = await fetch("http://localhost:3000/api/resolve/soundcloud?title=" + encodeURIComponent("مشكلني") + "&artist=" + encodeURIComponent("راشد الماجد") + "&duration=360000");
  const data = await res.json();
  console.log("Time:", Date.now() - t, "ms");
  console.log(data);
}
run();
