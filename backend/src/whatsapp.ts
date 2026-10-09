import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import P from 'pino';
import fs from "fs";
import  redis  from "./config/redis.ts";      
import { io } from "./config/socket.ts";    
import type { IPendingOrder } from "../src/dtos/types.ts";          
import { getSecondsUntil6AMArgentina } from "./utils/date_utils.ts";
import path from "path";

export let sock: any = null;
export let ready = false;
export const botPhoneNumbers: Record<string, string> = {};
export const sessions = new Map<string, { sock: any; lastActive: number }>();

export const initWhatsApp = async (storeId: string) => {
  if (sessions.has(storeId)) {
    try {
      // Obtenemos la sesión y apagamos el socket viejo si existe
      sessions.get(storeId)?.sock?.end(undefined);
      sessions.delete(storeId);
    } catch (err) {
      console.error(`Error cerrando sesión previa de ${storeId}:`, err);
    }
  }

  // 2. Ruta de auth única por local
  const AUTH_PATH = path.join("./.sessions", `.auth_${storeId}`);
  if (!fs.existsSync("./.sessions")) fs.mkdirSync("./.sessions");

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
  const { version } = await fetchLatestBaileysVersion();

  // Creamos el socket local
  const sock = makeWASocket({
    version,
    logger: P({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }) as any),
    },
    printQRInTerminal: false,
    browser: ["NottyPers", "Chrome", "1.0.0"],
  });

  // Guardamos la instancia en el Map
  sessions.set(storeId, { sock, lastActive: Date.now() });

  sock.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Emitimos el QR solo al local que le corresponde por Socket.io
      io.to(storeId).emit("whatsapp-qr", { qr });
      console.log(`📲 QR Generado para el local: ${storeId}`);
      // Opcional: seguir mostrándolo en terminal para debug
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      console.log(`🔌 Conexión cerrada [${storeId}]. Código:`, statusCode);
      io.to(storeId).emit("whatsapp-ready", { 
        status: false, 
        botNumber: null 
      });

      if (statusCode === 401) {
        console.log(`❌ Sesión expirada para ${storeId}. Borrando auth...`);
        fs.rmSync(AUTH_PATH, { recursive: true, force: true });
        delete botPhoneNumbers[storeId];
        sessions.delete(storeId);
        // No reconectamos automáticamente en 401 para evitar bucles infinitos
        return;
      }

      console.log(`🔁 Reconectando local: ${storeId}...`);
      setTimeout(() => initWhatsApp(storeId), 5000);
    }

  if (connection === "open") {
      const user = sock.authState.creds.me;
      if (user) {
        // Usamos optional chaining y fallback para evitar el error de "undefined"
        const rawId = user.id || "";
        if (rawId !== "") {

          const number = (rawId.split(":")[0] as string).split("@")[0] as string;
          botPhoneNumbers[storeId] = number;
          console.log(`✅ WhatsApp conectado para [${storeId}]. Número: ${number}`);
          
          io.to(storeId).emit("whatsapp-ready", { 
            status: true, 
            botNumber: number 
          });
        }
      }
    }
  }
);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m: any) => {
  for (const msg of m.messages) {
    // Envolvemos el procesamiento de CADA mensaje en su propio try/catch
    try {
      if (!msg.message) continue;

      const from = msg.key.remoteJid;
      if (!from) continue;

      const rawText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
      const match = rawText.match(/(\d+)$/); // Buscamos el número al final
      
      console.log(`[${storeId}] Mensaje entrante: ${rawText}`);

      if (match) {
        const orderNumber = match[0];
        
        // A partir de acá empiezan las llamadas asíncronas peligrosas
        const data = await redis.get(`pending:${orderNumber}`);

        if (data) {
          const pendingOrder: IPendingOrder = typeof data === 'string' ? JSON.parse(data) : data;

          // SEGURIDAD: Solo procesar si el pedido pertenece a este storeId
          if (pendingOrder.storeId !== storeId) {
            console.warn(`[⚠️ Alerta - ${storeId}] Intento de vincular pedido #${orderNumber} ajeno al local.`);
            continue;
          }

          const orderId = `${storeId}:NP:${orderNumber}`;
          const ttl = getSecondsUntil6AMArgentina();
          const finalOrder = { ...pendingOrder, orderId, whatsappId: from };

          // Transacciones a Redis
          await redis.set(orderId, JSON.stringify(finalOrder), { ex: ttl });
          const setKey = `orders:list:${storeId}`;
          await redis.sadd(setKey, orderId);
          await redis.expire(setKey, ttl);
          await redis.del(`pending:${orderNumber}`);

          console.log(`[✅ Éxito - ${storeId}] Pedido #${orderNumber} guardado y vinculado.`);

          // Emitimos por WebSockets al Dashboard del local
          const clients = io.sockets.adapter.rooms.get(storeId);
          console.log(`[${storeId}] Clientes activos en sala:`, clients ? clients.size : 0);
          io.to(storeId).emit("pedido-vinculado", finalOrder);

          // Confirmación por WhatsApp al cliente
          await sock.sendMessage(from, {
            text: `¡Hola ${pendingOrder.customerName}! Tu pedido #${orderNumber} en el local ha sido vinculado correctamente.`
          });
        }
      }
    } catch (error) {
      // Si algo falla, el servidor NO se cae. Capturamos el error con buen contexto.
      // Esto es ideal si luego envías estos logs a un sistema de telemetría estructurado.
      console.error(JSON.stringify({
        level: "ERROR",
        storeId: storeId,
        event: "messages.upsert",
        message: "Fallo al procesar mensaje de WhatsApp o Redis",
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }
});
};

export const sendWhatsAppMessage = async (storeId: string, to: string, message: string) => {
    const session = sessions.get(storeId);
    if (!session || !session.sock) {
        console.error(`No hay sesión activa para el local: ${storeId}`);
        return;
    }
    await session.sock.sendMessage(to, { text: message });
};

export const pingSession = (storeId: string) => {
    const session = sessions.get(storeId);
    if (session) {
        session.lastActive = Date.now();
    }
};

export const superviseAgents = () => {
    const NOW = Date.now();
    const MAX_IDLE_TIME = 2 * 60 * 60 * 1000; // 2 horas de inactividad máxima permitida

    sessions.forEach((session, storeId) => {
        const idleTime = NOW - session.lastActive;

        if (idleTime > MAX_IDLE_TIME) {
            try {
                // 1. Apagamos la conexión de Baileys elegantemente
                session.sock.end(undefined); 
                
                // 2. Lo borramos de la RAM
                sessions.delete(storeId);
                
                // Log estructurado del evento del ciclo de vida del agente
                console.log(JSON.stringify({
                    level: "INFO",
                    event: "agent_terminated",
                    storeId: storeId,
                    idleHours: (idleTime / 1000 / 60 / 60).toFixed(2),
                    message: "Agente desconectado de la RAM por inactividad."
                }));

            } catch (error) {
                console.error(`❌ Error al limpiar la sesión inactiva de ${storeId}:`, error);
            }
        }
    });
};