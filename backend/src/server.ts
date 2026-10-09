import dotenv from 'dotenv';
dotenv.config();

// Fail-Fast: valida env vars antes de arrancar cualquier otra cosa
import { validateEnv } from './config/env.ts';
validateEnv();

import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import helmet from 'helmet';

import { initSocket } from './config/socket.ts';
import { initWhatsApp } from './whatsapp.ts';
import { buildContainer } from './container.ts';
import { logger } from './config/logger.ts';
import { errorHandler } from './handler/errorHandler.ts';

import orderRoutes from './routes/order_routes.ts';
import authRoutes from './routes/auth_routes.ts';
import productRoutes from './routes/product_routes.ts';
import categoryRoutes from './routes/categories_routes.ts';
import adminRoutes from './routes/admin_routes.ts';
import reportRoutes from './routes/report_routes.ts';

import cron from 'node-cron';
import { cleanSessionFiles } from './utils/session_cleaner.ts';
import { superviseAgents } from './whatsapp.ts';

// ============================================================
// App Setup
// ============================================================

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(
  cors({
    origin: ['https://notty-pers.vercel.app', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  }),
);
app.use(express.json());

// Health check (sin rate limit para load balancers)
app.get('/ping', (_req, res) => res.status(200).send('OK'));

// Rutas (cada router tiene su propio rate limiter aplicado por ruta)
app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/categorias', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

// Error handler global (debe ir al final, después de las rutas)
app.use(errorHandler);

// ============================================================
// HTTP Server + Socket.IO
// ============================================================

const httpServer = createServer(app);
initSocket(httpServer);

// Composition Root — construye e inyecta todas las dependencias
buildContainer();

// ============================================================
// Re-conexión de sesiones WhatsApp al arrancar
// ============================================================

(async () => {
  try {
    const sessionsDir = './.sessions';
    if (fs.existsSync(sessionsDir)) {
      const folders = fs.readdirSync(sessionsDir);
      for (const folder of folders) {
        if (folder.startsWith('.auth_')) {
          const storeId = folder.replace('.auth_', '');
          logger.info({ storeId }, 'Re-conectando sesión WhatsApp');
          await initWhatsApp(storeId);
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error re-conectando sesiones existentes');
  }
})();

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'NottyPers corriendo');
});

// ============================================================
// Cron Jobs
// ============================================================

cron.schedule(
  '0 6 * * *',
  () => {
    cleanSessionFiles('./.sessions');
    logger.info('Tarea programada: sesiones limpiadas');
  },
  { timezone: 'America/Argentina/Buenos_Aires' },
);

cron.schedule(
  '*/30 * * * *',
  () => {
    superviseAgents();
  },
  { timezone: 'America/Argentina/Buenos_Aires' },
);
