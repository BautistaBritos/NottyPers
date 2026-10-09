import rateLimit from 'express-rate-limit';

// ============================================================
// Rate Limiters — granulares por tipo de ruta
// Separar los límites evita que el rate de clientes públicos
// afecte el panel del local, y viceversa.
// ============================================================

/** Panel del local: requests autenticados del dueño/staff */
export const panelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 800,
  message: { error: 'Demasiadas peticiones, intentá de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Endpoints públicos del cliente (menú, crear pedido online) */
export const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 30,
  message: { error: 'Demasiadas peticiones, por favor esperá un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Auth: anti-brute force en login */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Demasiados intentos de acceso. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // solo cuenta los fallidos
});

/** Webhook de MercadoPago: confiamos en su IP pero lo protegemos igual */
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Rate limit excedido en webhook.' },
  standardHeaders: true,
  legacyHeaders: false,
});
