// ---------------------------------------------------------------------
// Six small functions pulled out of your Pac-Man code.
//
//   node test.mjs        run all tests
//   node test.mjs 3      run only exercise 3
//
// These are "pure" functions — no canvas, no socket, no p5. That's the
// point: pure functions can be tested without running the game, which is
// why pulling them out is worth doing at all.
//
// Attempt each one before asking Claude anything. When you do ask, ask
// about the concept, not this function.
// ---------------------------------------------------------------------

const TODO = (n) => { throw new Error(`Exercise ${n} not done yet`); };

// --- 1 -----------------------------------------------------------------
// In animate() you have:
//     680 - (14 - this.frame) * 16
// Expand the brackets and simplify it to the form  a + b * frame.
// Work it out on paper first, then write the simplified version here.
// The test checks your version agrees with the original for frames 0..13,
// so if the algebra is wrong you'll know immediately.
export function spriteX(frame) {
  TODO(1);
}

// --- 2 -----------------------------------------------------------------
// The y coordinate is (4 + ghost) * 16. Same idea — expand it.
export function spriteY(ghost) {
  TODO(2);
}

// --- 3 -----------------------------------------------------------------
// You have this block FOUR times in keyup, and the same four again in
// animate(). Eight copies of nearly the same thing:
//
//     this.frame++; this.frame %= 2
//     if (this.frame == 0){this.frame = 4}
//     else if (this.frame == 1){this.frame = 5}
//
// Replace all eight with one function. Each direction owns a pair of
// frames and animating just flips between them:
//
//     up: 4 and 5      down: 6 and 7      left: 2 and 3     right: 0 and 1
//
// nextFrame(dir, frame) returns the OTHER frame of that pair if `frame` is
// already one of them, and the FIRST of the pair otherwise.
// Hint: a lookup object beats a switch here. You want roughly two lines.
export function nextFrame(dir, frame) {
  TODO(3);
}

// --- 4 -----------------------------------------------------------------
// Your sprite slides off the screen and never comes back, because keyup
// never zeroes the velocity. Keep it on the canvas: return `value` forced
// into the range min..max inclusive.
export function clamp(value, min, max) {
  TODO(4);
}

// --- 5 -----------------------------------------------------------------
// animate() emits "player-moved" on EVERY frame — 20 messages a second per
// player, even standing still. Return true only if anything actually
// changed. Both arguments look like { x, y, frame }.
// Either may be null (nothing sent yet) — that counts as moved.
export function hasMoved(previous, current) {
  TODO(5);
}

// --- 6 -----------------------------------------------------------------
// "players-connected" pushes a new Sprite every time it fires. If the
// server ever sends it twice for the same person you get two sprites for
// them, and neither is removable.
// Add the player only if their id isn't already in the list. Return the
// array. Mutating it is fine.
export function addPlayer(players, newPlayer) {
  TODO(6);
}
