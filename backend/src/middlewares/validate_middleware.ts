import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';

// ============================================================
// Middleware genérico de validación con Zod
// Uso: router.post('/ruta', validate(MiSchema), handler)
// Valida req.body y retorna 400 con errores legibles si falla.
// ============================================================

export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      res.status(400).json({ error: 'Datos inválidos', details: errors });
      return;
    }

    // Reemplaza el body con el dato ya parseado y coercionado por Zod
    req.body = result.data;
    next();
  };
