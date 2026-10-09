import { Router } from 'express';
import { createProduct, getProducts, deleteProduct, updateProduct } from '../controllers/product_controller.ts';
import { authenticateToken } from '../middlewares/auth_middleware.ts';
import { requireRole } from '../middlewares/rbac_middleware.ts';
import { validate } from '../middlewares/validate_middleware.ts';
import { CreateProductSchema, UpdateProductSchema } from '../schemas/product.schema.ts';
import { panelLimiter, publicLimiter } from '../config/rateLimiters.ts';

const router = Router();

// Público: el cliente ve el menú
router.get('/:storeId', publicLimiter, getProducts);

// Privado: solo el TenantAdmin gestiona el menú
router.post(
  '/',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin'),
  validate(CreateProductSchema),
  createProduct,
);

router.put(
  '/:productId',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin'),
  validate(UpdateProductSchema),
  updateProduct,
);

router.delete(
  '/:productId',
  panelLimiter,
  authenticateToken,
  requireRole('TenantAdmin'),
  deleteProduct,
);

export default router;
