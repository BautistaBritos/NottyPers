import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth_middleware.ts';
import { requireRole } from '../middlewares/rbac_middleware.ts';
import { validate } from '../middlewares/validate_middleware.ts';
import {
  CreateBeeperOrderSchema,
  CompleteOrderSchema,
  CreateOnlineOrderSchema,
  AcceptOnlineOrderSchema,
} from '../schemas/order.schema.ts';
import { panelLimiter, publicLimiter, webhookLimiter } from '../config/rateLimiters.ts';
import * as OrderController from '../controllers/order_controller.ts';
import { connectWhatsApp, checkWhatsAppStatus } from '../controllers/whatsapp_controller.ts';

const router = Router();

// ============================================================
// RUTAS DEL LOCAL FÍSICO (Beeper)
// ============================================================

router.get('/', panelLimiter, authenticateToken, OrderController.getAllOrders);

router.post(
  '/',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin', 'Staff'),
  validate(CreateBeeperOrderSchema),
  OrderController.createOrder,
);

router.post(
  '/complete',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin', 'Staff'),
  validate(CompleteOrderSchema),
  OrderController.completeOrder,
);

router.get('/last', panelLimiter, authenticateToken, OrderController.getLastQR);

router.delete(
  '/',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin'),
  OrderController.deleteAllOrders,
);

router.post('/connect-whatsapp', panelLimiter, authenticateToken, connectWhatsApp);
router.get('/whatsapp-status', panelLimiter, authenticateToken, checkWhatsAppStatus);
router.post('/disconnect-whatsapp', panelLimiter, authenticateToken, OrderController.disconnectWhatsApp);

// ============================================================
// RUTAS DE TAKE AWAY (Online)
// ============================================================

router.get(
  '/takeaway',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin', 'Staff'),
  OrderController.getOnlineOrders,
);

router.post(
  '/online/accept',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin', 'Staff'),
  validate(AcceptOnlineOrderSchema),
  OrderController.acceptOnlineOrder,
);

router.post(
  '/takeaway/complete',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin', 'Staff'),
  validate(AcceptOnlineOrderSchema),
  OrderController.completeOnlineOrder,
);

router.post(
  '/status/toggle',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin'),
  OrderController.toggleStoreStatus,
);

// ============================================================
// RUTAS PÚBLICAS
// ============================================================

router.post('/online', publicLimiter, validate(CreateOnlineOrderSchema), OrderController.createOnlineOrder);
router.post('/webhook', webhookLimiter, OrderController.receiveWebhook);
router.get('/status/:storeId', publicLimiter, OrderController.getStoreStatus);

export default router;
