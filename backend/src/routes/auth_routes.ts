import { Router } from 'express';
import * as AuthController from '../controllers/auth_controller.ts';
import { adminAuth, authenticateToken } from '../middlewares/auth_middleware.ts';
import { validate } from '../middlewares/validate_middleware.ts';
import { LoginSchema, RegisterSchema, UpdatePaymentSettingsSchema } from '../schemas/auth.schema.ts';
import { authLimiter, panelLimiter, publicLimiter } from '../config/rateLimiters.ts';

const router = Router();

// --- Auth ---
router.post('/login', authLimiter, validate(LoginSchema), AuthController.login);
router.post('/register', authLimiter, adminAuth, validate(RegisterSchema), AuthController.register);

// --- Configuración de pagos (efectivo / transferencia) ---
router.put(
  '/payment-settings',
  panelLimiter,
  authenticateToken,
  validate(UpdatePaymentSettingsSchema),
  AuthController.updatePaymentSettings,
);
router.get('/payment-settings/:storeId', publicLimiter, AuthController.getStorePaymentSettings);

// --- MercadoPago OAuth ---
// connect: recibe token por query param porque el browser navega directo
router.get('/mp/connect', AuthController.getMpConnectUrl);
// callback: MP redirige aquí — no requiere auth (viene desde fuera)
router.get('/mp/callback', AuthController.mpCallback);
// estado y desconexión: rutas autenticadas del panel
router.get('/mp/status', panelLimiter, authenticateToken, AuthController.getMpStatus);
router.post('/mp/disconnect', panelLimiter, authenticateToken, AuthController.disconnectMp);

export default router;
