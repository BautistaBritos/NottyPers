import { Router } from 'express';
import { getCategories, createCategory, deleteCategory } from '../controllers/category_controller.ts';
import { authenticateToken } from '../middlewares/auth_middleware.ts';
import { requireRole } from '../middlewares/rbac_middleware.ts';
import { panelLimiter, publicLimiter } from '../config/rateLimiters.ts';

const router = Router();

// Público
router.get('/:storeId', publicLimiter, getCategories);

// Privado: solo TenantAdmin gestiona categorías
router.post('/', panelLimiter, authenticateToken, requireRole('TenantAdmin'), createCategory);
router.delete('/:storeId/:categoryName', panelLimiter, authenticateToken, requireRole('TenantAdmin'), deleteCategory);

export default router;
