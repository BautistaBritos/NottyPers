export interface IOrder {
  orderNumber: string;
  customerName: string;
  storeId: String;
  whatsappId: string;
  status: 'preparación' | 'terminado';
  createdAt: string;
  completedAt?: string; 
}

export interface CreateOrderRequest {
  orderNumber: string;
  customerName: string;
}

export interface CompleteOrderRequest {
  orderId: string;
}

export interface IPendingOrder {
  storeId: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  status: 'preparación';
}