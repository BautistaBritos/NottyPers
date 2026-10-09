import { eventBus } from './EventBus.ts';
import type { NotificationService } from '../services/NotificationService.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// Handlers del Event Bus para pedidos
// Se registran una sola vez desde el container.
// OrderService no sabe nada de notificaciones — solo emite.
// ============================================================

export function registerOrderEventHandlers(
  notificationService: NotificationService,
): void {

  // Pedido beeper completado → notificar por WhatsApp
  eventBus.on('order.completed', async ({ storeId, order }) => {
    if (!order.whatsappId) return;
    logger.info({ storeId, orderNumber: order.orderNumber }, 'Notificando pedido completado');
    await notificationService.sendWhatsApp(
      storeId,
      order.whatsappId,
      `¡Tu pedido ${order.orderNumber} está listo!`,
    );
  });

  // Nuevo pedido online (efectivo/transferencia) → emitir al panel
  eventBus.on('order.online.new', ({ storeId, order }) => {
    logger.info({ storeId, orderId: order.id }, 'Nuevo pedido online recibido');
    notificationService.emitNewOrder(storeId, order);
  });

  // Pedido confirmado → enviar resumen al cliente por WhatsApp
  eventBus.on('order.online.confirmed', async ({ storeId, order }) => {
    if (!order.customerPhone) return;
    const jid = `${order.customerPhone}@s.whatsapp.net`;
    const mensaje = notificationService.buildConfirmationMessage(order);
    logger.info({ storeId, orderId: order.id }, 'Enviando confirmación WA al cliente');
    await notificationService.sendWhatsApp(storeId, jid, mensaje);
  });

  // Pedido online listo → notificar cliente por WhatsApp
  eventBus.on('order.online.ready', async ({ storeId, order }) => {
    const jid = `${order.customerPhone}@s.whatsapp.net`;
    const mensaje = notificationService.buildCompletionMessage(
      order.customerName,
      order.type,
      order.address,
    );
    logger.info({ storeId, orderId: order.id }, 'Notificando pedido online listo');
    await notificationService.sendWhatsApp(storeId, jid, mensaje);
  });

  // Pedido archivado → log (extensible a analytics futuros)
  eventBus.on('order.archived', ({ storeId, order }) => {
    logger.info(
      { storeId, orderId: order.id, source: order.source, total: order.total },
      'Pedido archivado en historial',
    );
  });
}
