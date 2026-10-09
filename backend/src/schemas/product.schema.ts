import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  description: z.string().max(300).optional(),
  price: z.number({ message: 'El precio debe ser un número' }).positive('El precio debe ser mayor a 0'),
  imageUrl: z.string().url('URL de imagen inválida').optional().or(z.literal('')),
  category: z.string().max(50).optional(),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional(),
  price: z.number().positive().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  category: z.string().max(50).optional(),
});
