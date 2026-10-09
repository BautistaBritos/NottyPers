import { EventEmitter } from 'events';
import type { IBeeperOrder, IOnlineOrder, IHistoricalOrder } from '../types/domain.ts';

// ============================================================
// EventBus — Patrón Observer / Pub-Sub
// Desacopla los servicios: OrderService emite, los listeners
// reaccionan sin que OrderService sepa quién escucha.
//
// Eventos disponibles:
//   'order.completed'     → pedido beeper marcado como listo
//   'order.online.new'    → nuevo pedido online recibido
//   'order.online.ready'  → pedido online marcado como listo
// ============================================================

export interface OrderCompletedPayload {
  storeId: string;
  order: IBeeperOrder;
}

export interface OnlineOrderNewPayload {
  storeId: string;
  order: IOnlineOrder;
}

export interface OnlineOrderReadyPayload {
  storeId: string;
  order: IOnlineOrder;
}

export interface OnlineOrderConfirmedPayload {
  storeId: string;
  order: IOnlineOrder;
}

export interface OrderArchivedPayload {
  storeId: string;
  order: IHistoricalOrder;
}

// Tipado estricto de eventos
interface NottyEvents {
  'order.completed': (payload: OrderCompletedPayload) => void;
  'order.online.new': (payload: OnlineOrderNewPayload) => void;
  'order.online.ready': (payload: OnlineOrderReadyPayload) => void;
  /** Dispara inmediatamente al crear un pedido — confirma al cliente por WA */
  'order.online.confirmed': (payload: OnlineOrderConfirmedPayload) => void;
  /** Dispara cuando un pedido se archiva en el historial */
  'order.archived': (payload: OrderArchivedPayload) => void;
}

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof NottyEvents>(
    event: K,
    payload: Parameters<NottyEvents[K]>[0],
  ): boolean {
    return super.emit(event as string, payload);
  }

  on<K extends keyof NottyEvents>(event: K, listener: NottyEvents[K]): this {
    return super.on(event as string, listener);
  }

  off<K extends keyof NottyEvents>(event: K, listener: NottyEvents[K]): this {
    return super.off(event as string, listener);
  }
}

// Singleton — un único bus para toda la app
export const eventBus = new TypedEventEmitter();
