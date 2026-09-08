import { Extras } from "@saavn-labs/sdk";
async function test() {
  try {
    const results = await Extras.search("مشكلني راشد الماجد");
    console.log(results);
  } catch (e) {
    console.log(e.message);
  }
}
test();
