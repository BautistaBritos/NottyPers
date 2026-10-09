import type { Response, NextFunction } from 'express';
import type { UserRole } from '../types/domain.ts';

// ============================================================
// RBAC Middleware — Role-Based Access Control
// Uso: router.post("/ruta", authenticateToken, requireRole("TenantAdmin"), handler)
// Compatible con tokens legacy (sin campo 'role') usando fallback a TenantAdmin.
// ============================================================

export const requireRole = (...roles: UserRole[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }

    // Tokens legacy generados antes del RBAC no tienen 'role'.
    // Se asumen TenantAdmin como capa de compatibilidad.
    const userRole: UserRole = req.user.role ?? 'TenantAdmin';

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere uno de los roles: ${roles.join(', ')}.`,
      });
    }

    next();
  };
};
