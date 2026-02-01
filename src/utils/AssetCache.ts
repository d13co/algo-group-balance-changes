// Asset cache for storing asset info to avoid repeated indexer calls
export interface AssetInfo {
  decimals: number;
  unitName: string;
}
export class AssetCache {
  private cache = new Map<number, AssetInfo>();

  get(assetId: number): AssetInfo | undefined {
    return this.cache.get(assetId);
  }

  set(assetId: number, info: AssetInfo): void {
    this.cache.set(assetId, info);
  }

  has(assetId: number): boolean {
    return this.cache.has(assetId);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
