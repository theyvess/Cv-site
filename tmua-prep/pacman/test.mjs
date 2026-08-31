// Tiny test runner, no dependencies. node test.mjs [number]
import * as f from "./frames.js";

const only = process.argv[2] ? Number(process.argv[2]) : null;
let pass = 0, fail = 0, todo = 0;
const out = [];

function check(n, name, fn) {
  if (only !== null && n !== only) return;
  try {
    fn(); pass++; out.push(`  \x1b[32mPASS\x1b[0m  ${n}. ${name}`);
  } catch (err) {
    if (/not done yet/.test(err.message)) { todo++; out.push(`  \x1b[90mTODO\x1b[0m  ${n}. ${name}`); }
    else { fail++; out.push(`  \x1b[31mFAIL\x1b[0m  ${n}. ${name}\n        ${err.message}`); }
  }
}
const eq = (a, b, m = "") => {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${m} expected ${y}, got ${x}`);
};

check(1, "spriteX() matches the original expression", () => {
  for (let n = 0; n <= 13; n++) eq(f.spriteX(n), 680 - (14 - n) * 16, `frame ${n}:`);
});

check(2, "spriteY() matches the original expression", () => {
  for (let g = 0; g <= 5; g++) eq(f.spriteY(g), (4 + g) * 16, `ghost ${g}:`);
});

check(3, "nextFrame() replaces all eight copies", () => {
  eq(f.nextFrame("up", 4), 5, "up flips 4->5:");
  eq(f.nextFrame("up", 5), 4, "up flips 5->4:");
  eq(f.nextFrame("down", 6), 7);
  eq(f.nextFrame("down", 7), 6);
  eq(f.nextFrame("left", 2), 3);
  eq(f.nextFrame("left", 3), 2);
  eq(f.nextFrame("right", 0), 1);
  eq(f.nextFrame("right", 1), 0);
  eq(f.nextFrame("up", 0), 4, "coming from another direction, start the pair:");
  eq(f.nextFrame("left", 7), 2, "coming from down, start the left pair:");
});

check(4, "clamp() keeps the sprite on screen", () => {
  eq(f.clamp(50, 0, 100), 50, "already inside:");
  eq(f.clamp(-30, 0, 100), 0, "below:");
  eq(f.clamp(9999, 0, 100), 100, "above:");
  eq(f.clamp(0, 0, 100), 0, "exactly on the low edge:");
  eq(f.clamp(100, 0, 100), 100, "exactly on the high edge:");
});

check(5, "hasMoved() stops the 20-a-second spam", () => {
  eq(f.hasMoved({ x: 1, y: 2, frame: 0 }, { x: 1, y: 2, frame: 0 }), false, "identical:");
  eq(f.hasMoved({ x: 1, y: 2, frame: 0 }, { x: 5, y: 2, frame: 0 }), true, "x changed:");
  eq(f.hasMoved({ x: 1, y: 2, frame: 0 }, { x: 1, y: 9, frame: 0 }), true, "y changed:");
  eq(f.hasMoved({ x: 1, y: 2, frame: 0 }, { x: 1, y: 2, frame: 1 }), true, "frame changed:");
  eq(f.hasMoved(null, { x: 1, y: 2, frame: 0 }), true, "nothing sent yet:");
});

check(6, "addPlayer() refuses duplicates", () => {
  const list = [{ id: "abc" }];
  f.addPlayer(list, { id: "xyz" });
  eq(list.length, 2, "new player added:");
  f.addPlayer(list, { id: "xyz" });
  eq(list.length, 2, "same player NOT added twice:");
  eq(list.map((p) => p.id), ["abc", "xyz"], "order preserved:");
});

console.log("\n" + out.join("\n"));
console.log(`\n  ${pass} passing, ${fail} failing, ${todo} not started\n`);
process.exit(fail > 0 ? 1 : 0);
