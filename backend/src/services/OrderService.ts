import { randomUUID } from 'crypto';
import type { OrderRepository } from '../repositories/OrderRepository.ts';
import type { UserRepository } from '../repositories/UserRepository.ts';
import type { MenuRepository } from '../repositories/MenuRepository.ts';
import type { NotificationService } from './NotificationService.ts';
import type { PaymentService } from './PaymentService.ts';
import type {
  IBeeperOrder,
  IOnlineOrder,
  IHistoricalOrder,
  CreateBeeperOrderDto,
  CreateOnlineOrderDto,
} from '../types/domain.ts';
import { AppException } from '../dtos/appException.ts';
import { eventBus } from '../events/EventBus.ts';
import { botPhoneNumbers } from '../whatsapp.ts';
import { getSecondsUntil6AMArgentina } from '../utils/date_utils.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// OrderService — SRP + DIP
// Única responsabilidad: reglas de negocio sobre pedidos.
// Depende de abstracciones (repositorios e interfaces), no de
// implementaciones concretas.
// ============================================================

export interface CreateBeeperOrderResult {
  orderNumber: string;
  whatsappLink: string;
  status: string;
}

export interface CreateOnlineOrderResult {
  saved: true;
  paymentUrl: string | null;
  wppNum: string | null;
}

export interface StoreStatusResult {
  isOpen: boolean;
  modules: { enableLocal: boolean; enableTakeaway: boolean; enableMenu: boolean };
  wpConnected: boolean;
}

export class OrderService {
  private readonly orderRepository: OrderRepository;
  private readonly userRepository: UserRepository;
  private readonly menuRepository: MenuRepository;
  private readonly notificationService: NotificationService;
  private readonly paymentService: PaymentService;

  constructor(
    orderRepository: OrderRepository,
    userRepository: UserRepository,
    menuRepository: MenuRepository,
    notificationService: NotificationService,
    paymentService: PaymentService,
  ) {
    this.orderRepository = orderRepository;
    this.userRepository = userRepository;
    this.menuRepository = menuRepository;
    this.notificationService = notificationService;
    this.paymentService = paymentService;
  }

  // ==========================
  //  BEEPER ORDERS
  // ==========================

  async getAllBeeperOrders(storeId: string): Promise<IBeeperOrder[]> {
    const orderIds = await this.orderRepository.getOrderIds(storeId);
    if (orderIds.length === 0) return [];
    return this.orderRepository.getOrdersByIds(orderIds);
  }

  async createBeeperOrder(
    storeId: string,
    dto: CreateBeeperOrderDto,
  ): Promise<CreateBeeperOrderResult> {
    if (!dto.orderNumber) {
      throw new AppException('Falta número de pedido', 400);
    }

    const currentBotNumber = botPhoneNumbers[storeId];
    if (!currentBotNumber) {
      throw new AppException(
        'El WhatsApp de este local no está vinculado o inicializado.',
        400,
      );
    }

    const ttl = getSecondsUntil6AMArgentina();
    const order: IBeeperOrder = {
      id: `pending:${dto.orderNumber}`,
      storeId,
      orderNumber: dto.orderNumber,
      customerName: dto.customerName || 'Cliente',
      status: 'preparación',
      createdAt: new Date().toISOString(),
    };

    await this.orderRepository.saveBeeperOrder(order, ttl);

    const whatsappLink = `https://wa.me/${currentBotNumber}?text=${encodeURIComponent(
      `Hola! Mi pedido es el número: ${dto.orderNumber}`,
    )}`;

    await this.orderRepository.saveLastOrder(storeId, {
      orderNumber: dto.orderNumber,
      whatsappLink,
    });

    return { orderNumber: dto.orderNumber, whatsappLink, status: 'preparación' };
  }

  async completeBeeperOrder(orderId: string, requestingStoreId: string): Promise<void> {
    const order = await this.orderRepository.getBeeperOrder(orderId);

    if (!order) {
      throw new AppException(`Pedido no encontrado: ${orderId}`, 404);
    }

    // Verificación de ownership — CRÍTICO para multi-tenancy
    if (order.storeId !== requestingStoreId) {
      throw new AppException('No tienes permiso para modificar este pedido', 403);
    }

    const completedAt = new Date().toISOString();
    order.status = 'terminado';
    order.completedAt = completedAt;

    await this.orderRepository.updateBeeperOrder(orderId, order);
    await this.orderRepository.markOrderAsUsed(order.orderNumber);

    // Archivar en historial
    const historical: IHistoricalOrder = {
      id: order.id,
      storeId: order.storeId,
      customerName: order.customerName,
      customerPhone: order.whatsappId ?? '',
      items: [],
      total: 0,
      status: 'terminado',
      type: 'take-away',
      address: '',
      paymentMethod: 'efectivo',
      createdAt: order.createdAt,
      completedAt,
      source: 'beeper',
    };
    await this.orderRepository.saveToHistory(order.storeId, historical);

    eventBus.emit('order.completed', { storeId: order.storeId, order });
    eventBus.emit('order.archived', { storeId: order.storeId, order: historical });
    logger.info({ storeId: order.storeId, orderNumber: order.orderNumber }, 'Pedido beeper completado');
  }

  async getLastOrder(storeId: string) {
    return this.orderRepository.getLastOrder(storeId);
  }

  // ==========================
  //  ONLINE ORDERS
  // ==========================

  async getOnlineOrders(storeId: string): Promise<IOnlineOrder[]> {
    const orders = await this.orderRepository.getAllOnlineOrders(storeId);
    return orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async createOnlineOrder(
    dto: CreateOnlineOrderDto,
    frontendUrl: string,
    backendUrl: string,
  ): Promise<CreateOnlineOrderResult> {
    if (!dto.storeId || !dto.items || dto.items.length === 0) {
      throw new AppException('Faltan datos en el pedido', 400);
    }

    const storeStatus = await this.orderRepository.getStoreStatus(dto.storeId);
    if (storeStatus === 'closed') {
      throw new AppException(
        '¡Ups! El local acaba de cerrar y ya no estamos tomando pedidos por hoy.',
        400,
      );
    }

    // Validar y recalcular precios desde la base de datos (nunca confiar en el cliente)
    const dbProducts = await this.menuRepository.findAllByStore(dto.storeId);
    if (!dbProducts.length) {
      throw new AppException('Error interno: Menú no encontrado', 400);
    }

    const secureItems = [];
    let realTotal = 0;

    for (const requestedItem of dto.items) {
      const realProduct = dbProducts.find((p) => p.id === requestedItem.id);
      if (!realProduct) {
        throw new AppException('Producto no encontrado', 400);
      }
      const itemPrice = Number(realProduct.price);
      secureItems.push({
        id: realProduct.id,
        name: realProduct.name,
        price: itemPrice,
        quantity: requestedItem.quantity,
      });
      realTotal += itemPrice * requestedItem.quantity;
    }

    const cleanPhone = this.sanitizePhoneNumber(dto.customerPhone);
    const orderId = `ord_${randomUUID()}`;

    const newOrder: IOnlineOrder = {
      id: orderId,
      storeId: dto.storeId,
      customerName: dto.customerName,
      customerPhone: cleanPhone,
      items: secureItems,
      total: realTotal,
      status: dto.paymentMethod === 'mercadopago' ? 'esperando_pago' : 'pendiente',
      type: dto.orderType || 'take-away',
      address: dto.address || '',
      paymentMethod: dto.paymentMethod,
      createdAt: new Date().toISOString(),
    };

    await this.orderRepository.saveOnlineOrder(dto.storeId, newOrder);

    if (dto.paymentMethod === 'efectivo' || dto.paymentMethod === 'transferencia') {
      eventBus.emit('order.online.new', { storeId: dto.storeId, order: newOrder });
      // Confirmación al cliente por WA (si tiene número)
      if (dto.customerPhone) {
        eventBus.emit('order.online.confirmed', { storeId: dto.storeId, order: newOrder });
      }
      const wppNum = botPhoneNumbers[dto.storeId]
        ? ((botPhoneNumbers[dto.storeId] as string).split('@')[0] ?? null)
        : null;
      return { saved: true, paymentUrl: null, wppNum };
    }

    const paymentUrl = await this.paymentService.createPreference(
      dto.storeId,
      newOrder,
      frontendUrl,
      backendUrl,
    );

    return { saved: true, paymentUrl, wppNum: null };
  }

  async acceptOnlineOrder(storeId: string, orderId: string): Promise<IOnlineOrder> {
    const order = await this.orderRepository.getOnlineOrder(storeId, orderId);
    if (!order) throw new AppException('Pedido no encontrado', 404);

    order.status = 'preparación';
    await this.orderRepository.saveOnlineOrder(storeId, order);
    return order;
  }

  async completeOnlineOrder(storeId: string, orderId: string): Promise<void> {
    const order = await this.orderRepository.getOnlineOrder(storeId, orderId);
    if (!order) throw new AppException('Pedido no encontrado', 404);

    const completedAt = new Date().toISOString();
    await this.orderRepository.deleteOnlineOrder(storeId, orderId);

    // Archivar en historial antes de emitir eventos
    const historical: IHistoricalOrder = {
      ...order,
      completedAt,
      source: 'online',
    };
    await this.orderRepository.saveToHistory(storeId, historical);

    eventBus.emit('order.online.ready', { storeId, order });
    eventBus.emit('order.archived', { storeId, order: historical });
    logger.info({ storeId, orderId }, 'Pedido online completado y archivado');
  }

  /** Elimina todos los pedidos online de UN solo tenant. Nunca borra datos de otros. */
  async deleteAllOrders(storeId: string): Promise<void> {
    await this.orderRepository.deleteAllOnlineOrders(storeId);
  }

  // ==========================
  //  ESTADO DEL LOCAL
  // ==========================

  async getStoreStatus(storeId: string): Promise<StoreStatusResult> {
    const [status, user] = await Promise.all([
      this.orderRepository.getStoreStatus(storeId),
      this.userRepository.findById(storeId),
    ]);

    const modules = user?.modules ?? { enableLocal: true, enableTakeaway: true, enableMenu: true };
    const wpConnected = !!botPhoneNumbers[storeId];

    return {
      isOpen: status !== 'closed',
      modules: {
        enableLocal: modules.enableLocal ?? true,
        enableTakeaway: modules.enableTakeaway ?? true,
        enableMenu: modules.enableMenu ?? true,
      },
      wpConnected,
    };
  }

  async toggleStoreStatus(storeId: string): Promise<boolean> {
    const current = await this.orderRepository.getStoreStatus(storeId);
    const next = current === 'closed' ? 'open' : 'closed';
    await this.orderRepository.setStoreStatus(storeId, next);
    return next === 'open';
  }

  // ==========================
  //  WEBHOOK
  // ==========================

  async processPaymentWebhook(
    storeId: string,
    paymentId: string | number,
  ): Promise<void> {
    const order = await this.orderRepository
      .getAllOnlineOrders(storeId)
      .then((orders) => orders.find((o) => o.status === 'esperando_pago'));

    if (!order) return;

    const result = await this.paymentService.processWebhook(
      storeId,
      paymentId,
      order.total,
    );

    if (!result) return;

    const updatedOrder = await this.orderRepository.getOnlineOrder(
      result.storeId,
      result.orderId,
    );
    if (!updatedOrder) return;

    updatedOrder.status = 'pendiente';
    await this.orderRepository.saveOnlineOrder(result.storeId, updatedOrder);
    eventBus.emit('order.online.new', { storeId: result.storeId, order: updatedOrder });
    eventBus.emit('order.online.confirmed', { storeId: result.storeId, order: updatedOrder });
    logger.info({ storeId: result.storeId, orderId: result.orderId }, 'Pago aprobado, pedido activado');
  }

  // ==========================
  //  HELPERS PRIVADOS
  // ==========================

  private sanitizePhoneNumber(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    clean = clean.replace(/^15/, '11');
    if (clean.length === 10) clean = `549${clean}`;
    return clean;
  }
}
