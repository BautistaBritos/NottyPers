import type { Server } from 'socket.io';
import type { IOnlineOrder } from '../types/domain.ts';
import { sendWhatsAppMessage } from '../whatsapp.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// NotificationService — SRP
// Única responsabilidad: enviar notificaciones (WS, WhatsApp).
// Desacoplado de la lógica de pedidos mediante DIP.
// ============================================================

export class NotificationService {
  private readonly io: Server;
  constructor(io: Server) {
    this.io = io;
  }

  /** Emite un nuevo pedido al panel del local vía WebSocket. */
  emitNewOrder(storeId: string, order: IOnlineOrder): void {
    try {
      this.io.to(storeId).emit('nuevo-pedido', order);
    } catch {
      logger.warn({ storeId }, 'Socket no disponible al emitir nuevo pedido');
    }
  }

  /** Envía un mensaje de WhatsApp al cliente. Falla silenciosamente si el bot no está activo. */
  async sendWhatsApp(storeId: string, jid: string, message: string): Promise<void> {
    try {
      await sendWhatsAppMessage(storeId, jid, message);
    } catch (err) {
      logger.error({ err, storeId }, 'Error al enviar mensaje WhatsApp');
    }
  }

  /** Construye el mensaje de confirmación al recibir un nuevo pedido. */
  buildConfirmationMessage(order: IOnlineOrder): string {
    const PAYMENT_LABELS: Record<string, string> = {
      efectivo: 'Efectivo 💵',
      transferencia: 'Transferencia 🏦',
      mercadopago: 'Mercado Pago 💳',
    };
    const TYPE_LABELS: Record<string, string> = {
      'take-away': 'Take Away 🛍️',
      delivery: 'Delivery 🛵',
    };

    const itemLines = order.items
      .map((i) => `  • ${i.name} x${i.quantity} — $${i.price * i.quantity}`)
      .join('\n');

    return [
      `¡Gracias ${order.customerName}! 🎉`,
      '',
      `Tu pedido fue recibido con éxito.`,
      '',
      `📋 *Detalle:*`,
      itemLines,
      '',
      `💰 *Total:* $${order.total}`,
      `💳 *Pago:* ${PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}`,
      `📦 *Modalidad:* ${TYPE_LABELS[order.type] ?? order.type}`,
      '',
      `Te avisaremos cuando esté listo. ¡Gracias por tu pedido! 🙌`,
    ].join('\n');
  }

  /** Construye el mensaje de completado según el tipo de pedido. */
  buildCompletionMessage(
    customerName: string,
    orderType: 'take-away' | 'delivery',
    address?: string,
  ): string {
    if (orderType === 'delivery') {
      return `¡Hola ${customerName}! 👋\n\nTu pedido ya está en camino 🛵 a ${address}.`;
    }
    return `¡Hola ${customerName}! 👋\n\nTu pedido de *Take Away* ya está listo. 🛍️\n\n¡Te esperamos!`;
  }
}
