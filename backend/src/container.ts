import redis from './config/redis.ts';
import { io } from './config/socket.ts';

// Repositorios
import { OrderRepository } from './repositories/OrderRepository.ts';
import { UserRepository } from './repositories/UserRepository.ts';
import { MenuRepository } from './repositories/MenuRepository.ts';
import { CategoryRepository } from './repositories/CategoryRepository.ts';

// Servicios
import { NotificationService } from './services/NotificationService.ts';
import { PaymentService } from './services/PaymentService.ts';
import { OrderService } from './services/OrderService.ts';
import { ReportService } from './services/ReportService.ts';

// Event Bus
import { registerOrderEventHandlers } from './events/orderEventHandlers.ts';

// Inyección en controllers
import { setOrderService } from './controllers/order_controller.ts';
import { setUserRepository as setAuthUserRepo } from './controllers/auth_controller.ts';
import { setUserRepository as setAdminUserRepo } from './controllers/admin_controller.ts';
import { setMenuRepository } from './controllers/product_controller.ts';
import { setCategoryRepository } from './controllers/category_controller.ts';
import { setReportService } from './controllers/report_controller.ts';

// ============================================================
// Composition Root — único lugar donde se construye el grafo
// de dependencias. Facilita reemplazar implementaciones en tests.
// ============================================================

export function buildContainer(): void {
  // --- Repositorios ---
  const orderRepository = new OrderRepository(redis);
  const userRepository = new UserRepository(redis);
  const menuRepository = new MenuRepository(redis);
  const categoryRepository = new CategoryRepository(redis);

  // --- Servicios ---
  const notificationService = new NotificationService(io);
  const paymentService = new PaymentService(userRepository);
  const orderService = new OrderService(
    orderRepository,
    userRepository,
    menuRepository,
    notificationService,
    paymentService,
  );
  const reportService = new ReportService(orderRepository);

  // --- Registrar handlers del Event Bus (Observer) ---
  registerOrderEventHandlers(notificationService);

  // --- Inyectar en controllers ---
  setOrderService(orderService);
  setAuthUserRepo(userRepository);
  setAdminUserRepo(userRepository);
  setMenuRepository(menuRepository);
  setCategoryRepository(categoryRepository);
  setReportService(reportService);
}
