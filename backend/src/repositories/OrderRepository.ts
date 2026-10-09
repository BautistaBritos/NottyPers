import type { Redis } from '@upstash/redis';
import type { IBeeperOrder, IOnlineOrder, IHistoricalOrder } from '../types/domain.ts';

// ============================================================
// OrderRepository — Patrón Repository
// Toda operación sobre pedidos pasa por acá.
// NUNCA se expone la clave Redis fuera de esta clase.
// ============================================================

export class OrderRepository {
  private readonly redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  // --- Claves (centralizadas, nunca duplicadas en controllers) ---
  private beeperKey(orderNumber: string) {
    return `pending:${orderNumber}`;
  }
  private onlineHashKey(storeId: string) {
    return `orders:${storeId}`;
  }
  private orderListKey(storeId: string) {
    return `orders:list:${storeId}`;
  }
  private storeStatusKey(storeId: string) {
    return `store_status:${storeId}`;
  }
  private lastOrderKey(storeId: string) {
    return `last_order:${storeId}`;
  }
  private usedKey(orderNumber: string) {
    return `usado:${orderNumber}`;
  }

  // ==========================
  //  BEEPER ORDERS
  // ==========================

  async saveBeeperOrder(order: IBeeperOrder, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.beeperKey(order.orderNumber), JSON.stringify(order), {
      ex: ttlSeconds,
    });
  }

  async getBeeperOrder(orderId: string): Promise<IBeeperOrder | null> {
    const raw = await this.redis.get<string>(orderId.trim());
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async updateBeeperOrder(orderId: string, order: IBeeperOrder): Promise<void> {
    await this.redis.set(orderId.trim(), JSON.stringify(order));
  }

  async markOrderAsUsed(orderNumber: string): Promise<void> {
    await this.redis.set(this.usedKey(orderNumber), 'false');
  }

  async getOrderIds(storeId: string): Promise<string[]> {
    return this.redis.smembers(this.orderListKey(storeId));
  }

  async getOrdersByIds(orderIds: string[]): Promise<IBeeperOrder[]> {
    if (orderIds.length === 0) return [];
    const raw = await this.redis.mget(...orderIds);
    return raw
      .filter(Boolean)
      .map((d) => (typeof d === 'string' ? JSON.parse(d) : d));
  }

  // --- Último pedido (para polling del QR) ---
  async saveLastOrder(
    storeId: string,
    data: { orderNumber: string; whatsappLink: string },
  ): Promise<void> {
    await this.redis.set(this.lastOrderKey(storeId), JSON.stringify(data), { ex: 3600 });
  }

  async getLastOrder(
    storeId: string,
  ): Promise<{ orderNumber: string; whatsappLink: string } | null> {
    const raw = await this.redis.get<string>(this.lastOrderKey(storeId));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  // ==========================
  //  ONLINE ORDERS (Take Away)
  // ==========================

  async saveOnlineOrder(storeId: string, order: IOnlineOrder): Promise<void> {
    await this.redis.hset(this.onlineHashKey(storeId), {
      [order.id]: JSON.stringify(order),
    });
  }

  async getOnlineOrder(storeId: string, orderId: string): Promise<IOnlineOrder | null> {
    const raw = await this.redis.hget<string>(this.onlineHashKey(storeId), orderId);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async getAllOnlineOrders(storeId: string): Promise<IOnlineOrder[]> {
    const hash = await this.redis.hgetall(this.onlineHashKey(storeId));
    if (!hash) return [];
    return Object.values(hash).map((d: any) =>
      typeof d === 'string' ? JSON.parse(d) : d,
    );
  }

  async deleteOnlineOrder(storeId: string, orderId: string): Promise<void> {
    await this.redis.hdel(this.onlineHashKey(storeId), orderId);
  }

  /** Elimina TODOS los pedidos online de UN solo tenant. Nunca usa flushdb. */
  async deleteAllOnlineOrders(storeId: string): Promise<void> {
    await this.redis.del(this.onlineHashKey(storeId));
    await this.redis.del(this.lastOrderKey(storeId));
  }

  // ==========================
  //  HISTORIAL (TTL 30 días)
  // ==========================

  private historyKey(storeId: string, orderId: string) {
    return `history:${storeId}:${orderId}`;
  }
  private historyIndexKey(storeId: string) {
    return `history:idx:${storeId}`;
  }

  private HISTORY_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días

  /**
   * Guarda un pedido completado en el historial.
   * - Sorted set indexado por timestamp (para queries por rango de fechas).
   * - String key individual con TTL de 30 días.
   */
  async saveToHistory(storeId: string, order: IHistoricalOrder): Promise<void> {
    const score = new Date(order.completedAt).getTime();
    const orderKey = this.historyKey(storeId, order.id);

    await Promise.all([
      this.redis.set(orderKey, JSON.stringify(order), { ex: this.HISTORY_TTL_SECONDS }),
      this.redis.zadd(this.historyIndexKey(storeId), { score, member: order.id }),
    ]);
  }

  /**
   * Obtiene historial por rango de timestamps (ms).
   * Devuelve los pedidos más recientes primero.
   */
  async getHistory(
    storeId: string,
    fromMs: number,
    toMs: number,
  ): Promise<IHistoricalOrder[]> {
    const orderIds = await this.redis.zrange(
      this.historyIndexKey(storeId),
      fromMs,
      toMs,
      { byScore: true },
    );

    if (!orderIds || orderIds.length === 0) return [];

    const keys = orderIds.map((id: unknown) => this.historyKey(storeId, String(id)));
    const raw = await this.redis.mget<string[]>(...keys);

    return raw
      .filter(Boolean)
      .map((d) => (typeof d === 'string' ? JSON.parse(d) : d))
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
  }

  // ==========================
  //  ESTADO DEL LOCAL
  // ==========================

  async getStoreStatus(storeId: string): Promise<string | null> {
    return this.redis.get<string>(this.storeStatusKey(storeId));
  }

  async setStoreStatus(storeId: string, status: 'open' | 'closed'): Promise<void> {
    await this.redis.set(this.storeStatusKey(storeId), status);
  }
}
