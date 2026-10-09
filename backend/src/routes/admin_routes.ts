import { Router } from "express";
import { getAllStores, updateStoreModules } from "../controllers/admin_controller.ts";
import { adminAuth } from "../middlewares/auth_middleware.ts";
const router = Router();

// Como el prefijo será /api/admin, acá solo ponemos /stores
router.get("/stores", adminAuth, getAllStores);
router.put("/stores/:storeId/modules", adminAuth, updateStoreModules);

export default router;