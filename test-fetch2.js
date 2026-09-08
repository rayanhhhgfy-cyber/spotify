async function run() {
  const res = await fetch("http://localhost:3000/api/resolve/soundcloud?title=Mashkalni&artist=Rashed%20Al%20Majid&duration=360000");
  const data = await res.json();
  console.log(data.title);
}
run();
