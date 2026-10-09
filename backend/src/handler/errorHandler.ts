import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppException } from '../dtos/appException.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// Error Handler Global — última línea de defensa
// Captura todos los errores que lleguen por next(err).
// Reglas:
//   - AppException → statusCode + mensaje del dominio
//   - ZodError     → 400 con detalle de campos (si Zod llegó acá)
//   - Error genérico → 500 sin exponer internals al cliente
// ============================================================

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppException) {
    logger.warn({ statusCode: err.statusCode, path: req.path }, err.message);
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Error inesperado — logear con stack completo, no exponer al cliente
  logger.error({ err, path: req.path, method: req.method }, 'Error no controlado');
  res.status(500).json({ error: 'Error interno del servidor' });
};
