import type { Redis } from '@upstash/redis';
import type { IProduct } from '../types/domain.ts';

// ============================================================
// MenuRepository — Patrón Repository
// Toda operación sobre productos del menú pasa por acá.
// ============================================================

export class MenuRepository {
  private readonly redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  private key(storeId: string) {
    return `menu:${storeId}`;
  }

  private parse(raw: unknown): IProduct {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as IProduct);
  }

  async findAllByStore(storeId: string): Promise<IProduct[]> {
    const hash = await this.redis.hgetall(this.key(storeId));
    if (!hash) return [];
    return Object.values(hash).map((d) => this.parse(d));
  }

  async findById(storeId: string, productId: string): Promise<IProduct | null> {
    const raw = await this.redis.hget<string>(this.key(storeId), productId);
    if (!raw) return null;
    return this.parse(raw);
  }

  async save(storeId: string, product: IProduct): Promise<void> {
    await this.redis.hset(this.key(storeId), { [product.id]: product });
  }

  async update(storeId: string, productId: string, product: IProduct): Promise<void> {
    await this.redis.hset(this.key(storeId), { [productId]: product });
  }

  async delete(storeId: string, productId: string): Promise<void> {
    await this.redis.hdel(this.key(storeId), productId);
  }
}
