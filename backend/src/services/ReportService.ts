import type { OrderRepository } from '../repositories/OrderRepository.ts';
import type {
  IHistoricalOrder,
  IReportStats,
  ITopProduct,
  IHourlyBreakdown,
} from '../types/domain.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// ReportService — SRP
// Única responsabilidad: calcular métricas sobre el historial.
// No toca Redis directamente — delega en OrderRepository.
// ============================================================

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export class ReportService {
  private readonly orderRepository: OrderRepository;
  constructor(orderRepository: OrderRepository) {
    this.orderRepository = orderRepository;
  }

  // ==========================
  //  API pública
  // ==========================

  async getStats(storeId: string, period: ReportPeriod, date?: string): Promise<IReportStats> {
    const { from, to } = this.resolveDateRange(period, date);
    const orders = await this.orderRepository.getHistory(storeId, from.getTime(), to.getTime());

    logger.info(
      { storeId, period, from: from.toISOString(), to: to.toISOString(), count: orders.length },
      'Calculando reporte',
    );

    return this.compute(orders, from, to);
  }

  async getHistory(
    storeId: string,
    opts: { fromMs?: number; toMs?: number; limit?: number },
  ): Promise<IHistoricalOrder[]> {
    const toMs = opts.toMs ?? Date.now();
    const fromMs = opts.fromMs ?? toMs - 30 * 24 * 60 * 60 * 1000;
    const limit = opts.limit ?? 50;

    const orders = await this.orderRepository.getHistory(storeId, fromMs, toMs);
    return orders.slice(0, limit);
  }

  // ==========================
  //  Lógica privada de cálculo
  // ==========================

  private compute(
    orders: IHistoricalOrder[],
    from: Date,
    to: Date,
  ): IReportStats {
    const onlineOrders = orders.filter((o) => o.source === 'online');

    const totalRevenue = onlineOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / onlineOrders.length || 0 : 0;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      topProducts: this.computeTopProducts(onlineOrders),
      peakHour: this.computePeakHour(orders),
      byPaymentMethod: this.groupBy(onlineOrders, (o) => o.paymentMethod),
      byOrderType: this.groupBy(onlineOrders, (o) => o.type),
    };
  }

  private computeTopProducts(orders: IHistoricalOrder[]): ITopProduct[] {
    const map = new Map<string, ITopProduct>();

    for (const order of orders) {
      for (const item of order.items ?? []) {
        const existing = map.get(item.id);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalRevenue += item.price * item.quantity;
        } else {
          map.set(item.id, {
            id: item.id,
            name: item.name,
            totalQuantity: item.quantity,
            totalRevenue: item.price * item.quantity,
          });
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10)
      .map((p) => ({ ...p, totalRevenue: Math.round(p.totalRevenue * 100) / 100 }));
  }

  private computePeakHour(orders: IHistoricalOrder[]): IHourlyBreakdown {
    const counts: number[] = new Array(24).fill(0);

    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours();
      counts[hour] = (counts[hour] ?? 0) + 1;
    }

    const maxCount = Math.max(...counts);
    const peakHour = counts.indexOf(maxCount);

    return { hour: peakHour, count: maxCount };
  }

  private groupBy(
    orders: IHistoricalOrder[],
    keyFn: (o: IHistoricalOrder) => string,
  ): Record<string, number> {
    return orders.reduce<Record<string, number>>((acc, order) => {
      const key = keyFn(order);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private resolveDateRange(
    period: ReportPeriod,
    dateStr?: string,
  ): { from: Date; to: Date } {
    const now = new Date();

    if (period === 'daily') {
      const base = dateStr ? new Date(dateStr) : now;
      const from = new Date(base);
      from.setHours(0, 0, 0, 0);
      const to = new Date(base);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }

    if (period === 'weekly') {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }

    // monthly
    const from = new Date(now);
    from.setDate(now.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
}
