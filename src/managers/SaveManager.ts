/**
 * Single owner of persistent player data.
 *
 * Scenes and services must never touch `localStorage` directly — go through
 * here so the storage shape stays in one place and so every read has a sane
 * fallback when storage is unavailable (Safari private mode, a WebView with
 * site data disabled, an SSR-less first paint, etc.).
 */

export interface SaveData {
  highScore: number;
  coins: number;
  soundEnabled: boolean;
  /** Product ids unlocked through IAPService. */
  ownedProducts: string[];
}

const STORAGE_KEY = 'sky-dodge:save:v1';

const DEFAULTS: SaveData = {
  highScore: 0,
  coins: 0,
  soundEnabled: true,
  ownedProducts: []
};

/** Feature-detects storage once; a throwing `localStorage` degrades to memory. */
function resolveStorage(): Storage | null {
  try {
    const probe = '__sky-dodge-probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Coerces whatever is on disk into a complete, well-typed SaveData. */
function normalize(raw: unknown): SaveData {
  if (!isRecord(raw)) {
    return { ...DEFAULTS, ownedProducts: [] };
  }

  const highScore = typeof raw['highScore'] === 'number' && Number.isFinite(raw['highScore'])
    ? Math.max(0, Math.floor(raw['highScore']))
    : DEFAULTS.highScore;

  const coins = typeof raw['coins'] === 'number' && Number.isFinite(raw['coins'])
    ? Math.max(0, Math.floor(raw['coins']))
    : DEFAULTS.coins;

  const soundEnabled = typeof raw['soundEnabled'] === 'boolean'
    ? raw['soundEnabled']
    : DEFAULTS.soundEnabled;

  const ownedProducts = Array.isArray(raw['ownedProducts'])
    ? raw['ownedProducts'].filter((id): id is string => typeof id === 'string')
    : [];

  return { highScore, coins, soundEnabled, ownedProducts };
}

export class SaveManager {
  private static storage: Storage | null | undefined;
  /** In-memory mirror; also the source of truth when storage is unavailable. */
  private static cache: SaveData | null = null;

  private static getStorage(): Storage | null {
    if (this.storage === undefined) {
      this.storage = resolveStorage();
    }
    return this.storage;
  }

  private static read(): SaveData {
    if (this.cache) {
      return this.cache;
    }

    const storage = this.getStorage();
    if (!storage) {
      this.cache = { ...DEFAULTS, ownedProducts: [] };
      return this.cache;
    }

    try {
      const serialized = storage.getItem(STORAGE_KEY);
      this.cache = normalize(serialized === null ? null : JSON.parse(serialized));
    } catch {
      // Corrupt payload — start clean rather than trapping the player in it.
      this.cache = { ...DEFAULTS, ownedProducts: [] };
    }
    return this.cache;
  }

  private static write(next: SaveData): void {
    this.cache = next;
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota or private-mode failure: the in-memory cache still serves the
      // rest of the session, we just cannot persist across launches.
    }
  }

  /** Defensive copy so callers cannot mutate the cache behind our back. */
  static getAll(): SaveData {
    const data = this.read();
    return { ...data, ownedProducts: [...data.ownedProducts] };
  }

  static getHighScore(): number {
    return this.read().highScore;
  }

  /** Returns true when `score` beat the stored best (and was therefore saved). */
  static submitScore(score: number): boolean {
    const data = this.read();
    const candidate = Math.max(0, Math.floor(score));
    if (candidate <= data.highScore) {
      return false;
    }
    this.write({ ...data, highScore: candidate });
    return true;
  }

  static getCoins(): number {
    return this.read().coins;
  }

  static addCoins(amount: number): number {
    const data = this.read();
    const next = Math.max(0, data.coins + Math.floor(amount));
    this.write({ ...data, coins: next });
    return next;
  }

  /** Returns false when the player cannot afford `amount`; no partial spend. */
  static spendCoins(amount: number): boolean {
    const data = this.read();
    const cost = Math.max(0, Math.floor(amount));
    if (data.coins < cost) {
      return false;
    }
    this.write({ ...data, coins: data.coins - cost });
    return true;
  }

  static isSoundEnabled(): boolean {
    return this.read().soundEnabled;
  }

  static setSoundEnabled(enabled: boolean): void {
    this.write({ ...this.read(), soundEnabled: enabled });
  }

  static toggleSound(): boolean {
    const next = !this.isSoundEnabled();
    this.setSoundEnabled(next);
    return next;
  }

  static ownsProduct(productId: string): boolean {
    return this.read().ownedProducts.includes(productId);
  }

  static grantProduct(productId: string): void {
    const data = this.read();
    if (data.ownedProducts.includes(productId)) {
      return;
    }
    this.write({ ...data, ownedProducts: [...data.ownedProducts, productId] });
  }

  /** Used by "restore purchases" and by dev tooling. */
  static setOwnedProducts(productIds: readonly string[]): void {
    this.write({ ...this.read(), ownedProducts: [...new Set(productIds)] });
  }

  static reset(): void {
    this.write({ ...DEFAULTS, ownedProducts: [] });
  }
}
