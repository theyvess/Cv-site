# Pac-Man exercises

Based on your own `game.js` — the p5 + socket.io multiplayer sprite code.
Nothing here is invented; every one points at something actually in the file.

Two parts. **Part A** is written and tested — run `node test.mjs`. **Part B**
is reading and judgement, no test runner; answer out loud or in comments.

Ground rule: attempt each one alone first. Only then open Claude, and ask
about the *concept*, not the answer. The `CLAUDE.md` one folder up already
tells it to refuse.

---

## Part A — six functions to write (`frames.js`)

```bash
node test.mjs        # all of them
node test.mjs 3      # just exercise 3
```

They're pulled out of your code as pure functions — no canvas, no socket.
That's the lesson as much as the exercise: logic you can test without
launching the game is logic you can trust.

| # | What | Why it's in your code |
|---|---|---|
| 1 | `spriteX` | simplify `680 - (14 - frame) * 16` |
| 2 | `spriteY` | simplify `(4 + ghost) * 16` |
| 3 | `nextFrame` | replaces **eight** near-identical copies |
| 4 | `clamp` | your sprite currently slides off screen forever |
| 5 | `hasMoved` | you emit 20 messages/second while standing still |
| 6 | `addPlayer` | `players-connected` can add someone twice |

Exercise 3 is the important one. Do it properly and you delete about 30
lines from `game.js`.

---

## Part B — read your own code

**B1. Where does `frameRate(20)` belong?**
It's the last line of `draw()`, so it runs 20 times a second forever. Where
should it go, and why does it work anyway?

**B2. Count the event listeners.**
Every `new Sprite(...)` runs `addEventListener("keydown", ...)` in its
constructor. Four players join. How many keydown listeners exist? What
happens to them when a player leaves? Is this a bug today, or a bug waiting?

**B3. `const player = new Sprite(10, 10, 2, socket.id)`**
This runs the moment the file loads. Has the socket connected by then? What
is `socket.id` at that instant? Find the line that rescues you — and say
why the `keydown` guard `this.id !== socket.id` still works despite it.

**B4. Spot the inconsistency.**
Compare the `KeyW` case to the `KeyS` case in `keyup`. One uses `else if`,
the other uses two separate `if`s. Both work right now. Construct a change
to the frame numbers that would break the `KeyS` version but not `KeyW`.
*This is the same skill as Paper 2's "find the bad step in this proof".*

**B5. Who cleans up?**
Search for a handler that removes a player when they disconnect. What
happens to their sprite? Write the handler.

**B6. `switch (true)` in `animate()`.**
Explain why this works. Then: what happens if two direction flags are ever
true at once? Is that reachable in your code? Prove it either way.

**B7. Dead code.**
`msg` and `joinLobbyBtn` are both declared and never used. `createLobby()`
is never called from anywhere. Wire up the button, or delete them — but
decide deliberately rather than leaving them.

---

## Why this is TMUA practice too

- **1 and 2** are literally expanding brackets. `680 - (14 - f) * 16`
  becomes `456 + 16f`. Same operation as any algebra question, except here
  the test tells you instantly whether you got it right — which is a much
  better feedback loop than the back of a textbook.
- **B4 and B6** are proof-checking. Finding the input that breaks a claim
  is exactly finding a counterexample; showing two flags can never both be
  true is exactly a proof by exhaustion over your four `case` branches.
- **B3** is a necessary-vs-sufficient question in disguise. Is the socket
  being connected *necessary* for the guard to work, or only for `player.id`
  to be right? They aren't the same thing, and the answer is why the code
  survives.
