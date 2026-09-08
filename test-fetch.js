async function run() {
  const t = Date.now();
  const res = await fetch("http://localhost:3000/api/resolve/soundcloud?title=Mashkalni&artist=Rashed%20Al%20Majid&duration=360000");
  const data = await res.json();
  console.log("Time:", Date.now() - t, "ms");
  console.log(data);
}
run();
