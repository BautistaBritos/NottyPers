// ============================================================
// TIPOS DE DOMINIO — Nottypers SaaS
// Fuente única de verdad para todas las entidades del sistema.
// ============================================================

// --- Roles (RBAC) ---
export type UserRole = 'SuperAdmin' | 'TenantAdmin' | 'Staff' | 'Customer';

// --- Estados de pedido ---
export type OrderStatus =
  | 'preparación'
  | 'terminado'
  | 'pendiente'
  | 'esperando_pago';

// --- Tipo y pago de pedido ---
export type OrderType = 'take-away' | 'delivery';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'mercadopago';

// --- Ítem de pedido ---
export interface IOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

// --- Pedido del beeper (local físico) ---
export interface IBeeperOrder {
  id: string;
  storeId: string;
  orderNumber: string;
  customerName: string;
  whatsappId?: string;
  status: 'preparación' | 'terminado';
  createdAt: string;
  completedAt?: string;
}

// --- Pedido online (Take Away / Delivery) ---
export interface IOnlineOrder {
  id: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  items: IOrderItem[];
  total: number;
  status: OrderStatus;
  type: OrderType;
  address: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

// --- Producto del menú ---
export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  isAvailable: boolean;
}

// --- Módulos habilitados por tenant ---
export interface IStoreModules {
  enableLocal: boolean;
  enableTakeaway: boolean;
  enableMenu: boolean;
}

// --- Configuración de pagos ---
export interface IPaymentSettings {
  acceptsEfectivo: boolean;
  acceptsTransferencia: boolean;
  aliasBancario: string;
}

// --- Tokens de MercadoPago por tenant ---
export interface IMpTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;   // ISO date — 1 día antes del vencimiento real
  userId: number;
  email?: string;
}

// --- Usuario / Tenant ---
export interface IUser {
  username: string;
  password: string;
  createdAt: string;
  modules: IStoreModules;
  paymentSettings: IPaymentSettings;
  // MercadoPago OAuth (por tenant)
  mpAccessToken?: string;
  mpRefreshToken?: string;
  mpTokenExpiresAt?: string;
  mpUserId?: number;
  mpEmail?: string;
}

// --- Payload del JWT ---
export interface JwtPayload {
  username: string;
  storeId: string;
  role: UserRole;
}

// --- DTOs de entrada (Use Cases) ---
export interface CreateBeeperOrderDto {
  orderNumber: string;
  customerName?: string;
}

export interface CreateOnlineOrderDto {
  storeId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ id: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  orderType?: OrderType;
  address?: string;
}

export interface UpdatePaymentSettingsDto {
  acceptsEfectivo?: boolean;
  acceptsTransferencia?: boolean;
  aliasBancario?: string;
}

// --- Pedido histórico (completado, TTL 30 días) ---
export interface IHistoricalOrder extends IOnlineOrder {
  completedAt: string;
  source: 'online' | 'beeper';
}

// --- Métricas de reporte ---
export interface ITopProduct {
  id: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface IHourlyBreakdown {
  hour: number;   // 0-23
  count: number;
}

export interface IReportStats {
  period: { from: string; to: string };
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  topProducts: ITopProduct[];
  peakHour: IHourlyBreakdown;
  byPaymentMethod: Record<string, number>;
  byOrderType: Record<string, number>;
}
