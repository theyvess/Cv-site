# Sky Dodge

A 2D portrait arcade game — Phaser 3 + TypeScript (strict) + Vite, packaged for
iOS and Android with Capacitor.

Steer a ship with your thumb, dodge falling obstacles, grab coins. Speed and
spawn rate ramp with time survived.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Vite dev server with HMR                      |
| `npm run typecheck` | `tsc --noEmit`                                |
| `npm run build`     | Typecheck, then build `dist/`                 |
| `npm run preview`   | Serve the production build locally            |
| `npm run sync`      | Build, then `cap sync` the native projects    |

## Mobile packaging

The native projects are not committed. Generate them once per machine:

```bash
npm run build
npx cap add ios        # requires Xcode
npx cap add android    # requires Android Studio
npx cap sync
npx cap open ios       # or: npx cap open android
```

After that, `npm run sync` is all it takes to push web changes into both
native shells. App id and name live in `capacitor.config.ts`.

## Layout

```
src/
  main.ts                 Phaser game config + scene registration
  config/GameConfig.ts    Resolution, palette, scene/texture keys, tuning
  scenes/
    BootScene.ts          Loading bar, procedural textures, service init
    MenuScene.ts          Title, high score, sound toggle, play
    GameScene.ts          Main loop, pooling, input, collisions, pause
    GameOverScene.ts      Score banking, retry, rewarded revive
  managers/SaveManager.ts Persistent data (high score, coins, settings)
  objects/TextButton.ts   Touch-sized pill button
  services/
    AdService.ts          Rewarded-ad boundary (stub provider)
    IAPService.ts         Purchase/entitlement boundary (stub provider)
```

## Conventions

**Resolution.** Everything is authored against a 720x1280 virtual canvas and
letterboxed with `Phaser.Scale.FIT` + `CENTER_BOTH`. No scene should read
`window.innerWidth`; use `GAME_WIDTH` / `GAME_HEIGHT` from `config/GameConfig`.

**Input.** Pointer/touch only. No keyboard bindings — a phone has none.

**Performance.** `update()` allocates nothing. Obstacles and coins come from
fixed-size `Phaser.GameObjects.Group` pools (`Tuning.poolSize`); an exhausted
pool skips a spawn rather than growing mid-run. Collisions are squared-distance
circle tests, so there is no physics engine to step. Placeholder art is drawn
once at boot into canvas textures so pooled sprites share one texture and batch.

**Storage.** All persistence goes through `SaveManager` — never touch
`localStorage` directly. It feature-detects storage and falls back to an
in-memory store when it is unavailable (private browsing, restricted WebView),
so reads always return a complete, well-typed record.

**Monetization.** `AdService` and `IAPService` are boundaries: scenes see the
facade, and swapping the stub provider for a real SDK (AdMob, RevenueCat, ...)
via `setProvider()` is a one-file change. Ads are rewarded-only and always
user-initiated — there is deliberately no `showInterstitial()`. Entitlements are
mirrored into `SaveManager` so UI can ask a synchronous question.

## Tuning

Balance lives in `Tuning` in `src/config/GameConfig.ts` — fall speed and its
ramp, spawn interval and its ramp, pool sizes, scoring, and the post-revive
invulnerability window. Gameplay code reads from there rather than hard-coding
numbers.

## Notes

- `style.css` at the repo root is left over from the previous CV site and is not
  referenced by the game; the game's host styles are `src/style.css`.
- Art is procedural (`BootScene.generateTextures`). Dropping in real assets
  means loading them in `preload()` and keeping the same `TextureKeys`.
