/**
 * In-app purchase boundary.
 *
 * Same shape as AdService: scenes talk to this facade only, so wiring a real
 * store (`@capacitor-community/in-app-purchases`, RevenueCat, ...) means
 * replacing the provider, not editing gameplay code. Entitlements are mirrored
 * into SaveManager so the rest of the game can ask a synchronous question.
 */

import { SaveManager } from '../managers/SaveManager';
import { AdProducts } from './AdService';

export type ProductType = 'non_consumable' | 'consumable';

export interface Product {
  id: string;
  type: ProductType;
  title: string;
  description: string;
  /** Display price only; the store is the authority on the real price. */
  price: string;
  /** Coins granted on purchase, for consumables. */
  coins?: number;
}

export const PRODUCTS: readonly Product[] = [
  {
    id: AdProducts.RemoveAds,
    type: 'non_consumable',
    title: 'Remove Ads',
    description: 'Hides every ad placement. Rewarded revives stay free.',
    price: '$2.99'
  },
  {
    id: 'skin_neon',
    type: 'non_consumable',
    title: 'Neon Skin',
    description: 'A cosmetic glow for your ship.',
    price: '$0.99'
  },
  {
    id: 'coins_small',
    type: 'consumable',
    title: '500 Coins',
    description: 'A handful of coins.',
    price: '$0.99',
    coins: 500
  }
] as const;

export interface PurchaseResult {
  productId: string;
  status: 'purchased' | 'cancelled' | 'unavailable' | 'error';
}

export interface IAPProvider {
  initialize(): Promise<void>;
  getOwnedProductIds(): Promise<string[]>;
  purchase(productId: string): Promise<PurchaseResult>;
}

/** Dev provider: succeeds instantly so purchase flows are testable in-browser. */
class StubIAPProvider implements IAPProvider {
  async initialize(): Promise<void> {
    // No store to reach in the browser.
  }

  async getOwnedProductIds(): Promise<string[]> {
    // The stub's only record of past purchases is the local save.
    return SaveManager.getAll().ownedProducts;
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 400));
    return { productId, status: 'purchased' };
  }
}

export class IAPService {
  private static provider: IAPProvider = new StubIAPProvider();
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    try {
      await this.provider.initialize();
      await this.restore();
    } catch {
      this.initialized = false;
    }
  }

  static setProvider(provider: IAPProvider): void {
    this.provider = provider;
    this.initialized = false;
  }

  static getProducts(): readonly Product[] {
    return PRODUCTS;
  }

  static findProduct(productId: string): Product | undefined {
    return PRODUCTS.find((product) => product.id === productId);
  }

  /** Synchronous entitlement check for UI. */
  static owns(productId: string): boolean {
    return SaveManager.ownsProduct(productId);
  }

  static async purchase(productId: string): Promise<PurchaseResult> {
    const product = this.findProduct(productId);
    if (!product) {
      return { productId, status: 'unavailable' };
    }
    if (product.type === 'non_consumable' && this.owns(productId)) {
      return { productId, status: 'purchased' };
    }

    try {
      const result = await this.provider.purchase(productId);
      if (result.status === 'purchased') {
        this.grant(product);
      }
      return result;
    } catch {
      return { productId, status: 'error' };
    }
  }

  /** Re-syncs entitlements from the store; required on iOS. */
  static async restore(): Promise<string[]> {
    try {
      const owned = await this.provider.getOwnedProductIds();
      // Consumables are spent, not owned — only mirror non-consumables.
      const nonConsumables = owned.filter((id) => {
        const product = this.findProduct(id);
        return product?.type === 'non_consumable';
      });
      SaveManager.setOwnedProducts(nonConsumables);
      return nonConsumables;
    } catch {
      return SaveManager.getAll().ownedProducts;
    }
  }

  private static grant(product: Product): void {
    if (product.type === 'consumable') {
      if (product.coins) {
        SaveManager.addCoins(product.coins);
      }
      return;
    }
    SaveManager.grantProduct(product.id);
  }
}
