/**
 * Ad boundary.
 *
 * Scenes only ever see this facade, so swapping the stub for a real network
 * (AdMob via `@capacitor-community/admob`, AppLovin, ...) is a single-file
 * change with no gameplay edits.
 *
 * Policy — enforced here, not left to call sites:
 *   - Rewarded ads only, and only when the player explicitly opts in.
 *   - No forced mid-game interstitials. There is deliberately no `showInterstitial`.
 */

import { SaveManager } from '../managers/SaveManager';

export const AdProducts = {
  /** Owning this suppresses every ad placement. */
  RemoveAds: 'remove_ads'
} as const;

export type RewardedPlacement = 'revive' | 'double_coins';

export interface RewardedAdResult {
  /** True only when the ad ran to completion and the reward is owed. */
  completed: boolean;
  placement: RewardedPlacement;
  reason?: 'dismissed' | 'unavailable' | 'error' | 'not_ready';
}

/** Implemented by the stub below and by any real native adapter. */
export interface AdProvider {
  initialize(): Promise<void>;
  isRewardedReady(placement: RewardedPlacement): boolean;
  showRewarded(placement: RewardedPlacement): Promise<RewardedAdResult>;
}

/**
 * Browser/dev provider: resolves after a short delay and always grants the
 * reward, so the full revive flow is testable with `npm run dev`.
 */
class StubAdProvider implements AdProvider {
  private ready = false;

  async initialize(): Promise<void> {
    this.ready = true;
  }

  isRewardedReady(_placement: RewardedPlacement): boolean {
    return this.ready;
  }

  async showRewarded(placement: RewardedPlacement): Promise<RewardedAdResult> {
    if (!this.ready) {
      return { completed: false, placement, reason: 'not_ready' };
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 600));
    return { completed: true, placement };
  }
}

export class AdService {
  private static provider: AdProvider = new StubAdProvider();
  private static initialized = false;

  /** Call once from BootScene. Safe to call repeatedly. */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    try {
      await this.provider.initialize();
    } catch {
      // Never let an SDK failure block the game from booting.
      this.initialized = false;
    }
  }

  /** Swap in a native adapter before `initialize()`. */
  static setProvider(provider: AdProvider): void {
    this.provider = provider;
    this.initialized = false;
  }

  static adsRemoved(): boolean {
    return SaveManager.ownsProduct(AdProducts.RemoveAds);
  }

  /**
   * Whether to offer the placement at all. Callers use this to decide if the
   * "Watch ad" button is even shown, so the player is never offered something
   * that then fails to load.
   */
  static canOffer(placement: RewardedPlacement): boolean {
    if (this.adsRemoved()) {
      return false;
    }
    return this.initialized && this.provider.isRewardedReady(placement);
  }

  /**
   * Must only be called from a user gesture (a button press). Resolves with
   * `completed: false` on dismissal — callers should not grant the reward.
   */
  static async showRewarded(placement: RewardedPlacement): Promise<RewardedAdResult> {
    if (!this.canOffer(placement)) {
      return { completed: false, placement, reason: 'unavailable' };
    }
    try {
      return await this.provider.showRewarded(placement);
    } catch {
      return { completed: false, placement, reason: 'error' };
    }
  }
}
