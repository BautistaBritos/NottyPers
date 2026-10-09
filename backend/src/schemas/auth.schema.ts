import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio').max(50),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Solo letras, números, guiones y guiones bajos'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const UpdatePaymentSettingsSchema = z.object({
  acceptsEfectivo: z.boolean().optional(),
  acceptsTransferencia: z.boolean().optional(),
  aliasBancario: z.string().max(100).optional(),
});
