import type { Request, Response, NextFunction } from 'express';
import type { OrderService } from '../services/OrderService.ts';
import type { CreateOnlineOrderDto } from '../types/domain.ts';
import path from 'path';
import fs from 'fs';
import { botPhoneNumbers } from '../whatsapp.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// OrderController — Capa de Presentación
// Solo maneja HTTP: parsea request, llama al servicio, responde.
// Cero lógica de negocio acá.
// ============================================================

// El servicio se inyecta desde el router (DIP)
let _orderService: OrderService;

export function setOrderService(service: OrderService) {
  _orderService = service;
}

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    const orders = await _orderService.getAllBeeperOrders(storeId);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    const result = await _orderService.createBeeperOrder(storeId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const completeOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestingStoreId = (req as any).user.storeId;
    const { orderId } = req.body;
    await _orderService.completeBeeperOrder(orderId, requestingStoreId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const getLastQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    const data = await _orderService.getLastOrder(storeId);
    if (!data) return res.status(204).send();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const deleteAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    await _orderService.deleteAllOrders(storeId);
    res.json({ success: true, message: 'Pedidos del local eliminados' });
  } catch (err) {
    next(err);
  }
};

export const createOnlineOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto: CreateOnlineOrderDto = req.body;
    const frontendUrl = process.env.FRONTEND_URL || 'https://notty-pers.vercel.app';
    const backendUrl = process.env.BACKEND_URL || '';
    const result = await _orderService.createOnlineOrder(dto, frontendUrl, backendUrl);

    if (result.paymentUrl) {
      return res.status(201).json({ message: 'Redirigiendo a Mercado Pago...', url: result.paymentUrl });
    }
    res.status(201).json({ message: 'Pedido guardado con éxito.', url: null, wppNum: result.wppNum });
  } catch (err) {
    next(err);
  }
};

export const getOnlineOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    const orders = await _orderService.getOnlineOrders(storeId);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

export const acceptOnlineOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    const { orderId } = req.body;
    const order = await _orderService.acceptOnlineOrder(storeId, orderId);
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

export const completeOnlineOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    const { orderId } = req.body;
    await _orderService.completeOnlineOrder(storeId, orderId);
    res.json({ success: true, message: 'Pedido completado y notificado', orderId });
  } catch (err) {
    next(err);
  }
};

export const receiveWebhook = async (req: Request, res: Response) => {
  // Responder a MercadoPago inmediatamente (requisito de su API)
  res.status(200).send('OK');

  try {
    const paymentId = req.query.id || req.body?.data?.id;
    const type = req.query.type || req.body?.type;
    const storeId = req.query.store as string;

    if (type === 'payment' && paymentId && storeId) {
      await _orderService.processPaymentWebhook(storeId, paymentId as string);
    }
  } catch (error) {
    logger.error({ err: error }, '[Webhook] Error procesando pago');
  }
};

export const getStoreStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.params.storeId as string;
    if (!storeId) return res.status(400).json({ error: 'Falta el ID del local' });
    const result = await _orderService.getStoreStatus(storeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const toggleStoreStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    const isOpen = await _orderService.toggleStoreStatus(storeId);
    res.json({ isOpen });
  } catch (err) {
    next(err);
  }
};

export const disconnectWhatsApp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;

    delete botPhoneNumbers[storeId];

    const sessionPath = path.join(process.cwd(), 'auth_info_baileys', storeId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    res.json({ success: true, message: 'WhatsApp desconectado correctamente' });
  } catch (err) {
    next(err);
  }
};
