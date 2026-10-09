import { z } from 'zod';

export const CreateBeeperOrderSchema = z.object({
  orderNumber: z.string().min(1, 'El número de pedido es obligatorio').max(20),
  customerName: z.string().max(80).optional(),
});

export const CompleteOrderSchema = z.object({
  orderId: z.string().min(1, 'El ID del pedido es obligatorio'),
});

export const CreateOnlineOrderSchema = z.object({
  storeId: z.string().min(1, 'storeId es obligatorio'),
  customerName: z.string().min(1, 'El nombre del cliente es obligatorio').max(80),
  customerPhone: z
    .string()
    .regex(/^\+?[\d\s\-()]{7,20}$/, 'Teléfono inválido'),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
      }),
    )
    .min(1, 'El pedido debe tener al menos un ítem'),
  paymentMethod: z.enum(['efectivo', 'transferencia', 'mercadopago']),
  orderType: z.enum(['take-away', 'delivery']).optional(),
  address: z.string().max(200).optional(),
});

export const AcceptOnlineOrderSchema = z.object({
  orderId: z.string().min(1),
});
