import pino from 'pino';

// ============================================================
// Logger estructurado con Pino
// - En desarrollo: salida legible con pino-pretty
// - En producción: JSON puro (compatible con Datadog/Logtail/Axiom)
// Uso: logger.info({ storeId }, 'mensaje')
//      logger.error({ err, storeId }, 'fallo en servicio')
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  // En producción se serializa err automáticamente
  serializers: {
    err: pino.stdSerializers.err,
  },
});
