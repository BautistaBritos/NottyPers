import type { Request, Response, NextFunction } from 'express';
import type { ReportService, ReportPeriod } from '../services/ReportService.ts';

// ============================================================
// ReportController — Capa de Presentación
// Solo parsea query params y delega al servicio.
// ============================================================

let _reportService: ReportService;

export function setReportService(service: ReportService) {
  _reportService = service;
}

/** GET /api/reports/stats?period=daily&date=2026-04-15 */
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;
    const period = (req.query.period as ReportPeriod) ?? 'daily';
    const date = req.query.date as string | undefined;

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'period debe ser daily, weekly o monthly' });
    }

    const stats = await _reportService.getStats(storeId, period, date);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

/** GET /api/reports/history?from=<ms>&to=<ms>&limit=50 */
export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = (req as any).user.storeId;

    const fromMs = req.query.from ? Number(req.query.from) : undefined;
    const toMs = req.query.to ? Number(req.query.to) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;

    const history = await _reportService.getHistory(storeId, {
      ...(fromMs !== undefined ? { fromMs } : {}),
      ...(toMs !== undefined ? { toMs } : {}),
      limit,
    });
    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    next(err);
  }
};
