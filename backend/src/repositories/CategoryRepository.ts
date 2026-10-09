import type { Redis } from '@upstash/redis';

// ============================================================
// CategoryRepository — Patrón Repository
// Toda operación sobre categorías pasa por acá.
// ============================================================

const DEFAULT_CATEGORIES = ['Hamburguesas', 'Bebidas', 'Papas Fritas'];

export class CategoryRepository {
  private readonly redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  private key(storeId: string) {
    return `categorias:${storeId}`;
  }

  async findAllByStore(storeId: string): Promise<string[]> {
    let categories = await this.redis.smembers(this.key(storeId));

    if (categories.length === 0) {
      await this.redis.sadd(
        this.key(storeId),
        ...(DEFAULT_CATEGORIES as [string, ...string[]]),
      );
      categories = DEFAULT_CATEGORIES;
    }

    return categories;
  }

  async add(storeId: string, name: string): Promise<void> {
    await this.redis.sadd(this.key(storeId), name);
  }

  async remove(storeId: string, name: string): Promise<void> {
    await this.redis.srem(this.key(storeId), name);
  }
}
