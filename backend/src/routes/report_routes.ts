import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth_middleware.ts';
import { requireRole } from '../middlewares/rbac_middleware.ts';
import { panelLimiter } from '../config/rateLimiters.ts';
import * as ReportController from '../controllers/report_controller.ts';

const router = Router();

// Todas las rutas de reportes son privadas — solo TenantAdmin
router.use(panelLimiter, authenticateToken, requireRole('TenantAdmin'));

/**
 * GET /api/reports/stats?period=daily|weekly|monthly&date=YYYY-MM-DD
 * Retorna métricas agregadas del período.
 */
router.get('/stats', ReportController.getStats);

/**
 * GET /api/reports/history?from=<ms>&to=<ms>&limit=50
 * Retorna el historial paginado de pedidos completados.
 */
router.get('/history', ReportController.getHistory);

export default router;
