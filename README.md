# Cv-site

## Multiplayer lobby

A p5.js sketch where each player controls a sprite, and a Socket.IO server that
keeps players in the same lobby in sync.

```
npm install
npm start          # serves the sketch and the socket server on :5000
```

Then open <http://localhost:5000> in two tabs: **Create lobby** in the first,
type the code it shows into the second and **Join lobby**. Move with `WASD`.

### Files

| File | Purpose |
| --- | --- |
| `server.js` | Socket.IO server: lobby membership, movement relay, disconnects |
| `public/index.html` | Lobby controls and the canvas |
| `public/sketch.js` | The sketch: sprites, input, and the socket handlers |

### Sprites

`public/sketch.js` draws from a `sprites.png` spritesheet of 16x16 tiles. That
file is not in the repo — drop it into `public/` and the sprites appear; without
it each player is drawn as a coloured square instead.
