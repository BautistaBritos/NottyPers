import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { pingSession } from "../whatsapp.ts";

export let io: SocketServer;

export const initSocket = (httpServer: HttpServer) => {
    io = new SocketServer(httpServer, {
        cors: {
            // Asegurate de que process.env.FRONTEND_URL esté bien configurado
            origin: process.env.FRONTEND_URL || "*", 
            methods: ["GET", "POST"],
        },
    });

    // 🛡️ MIDDLEWARE DE AUTENTICACIÓN
    io.use((socket, next) => {
        // Buscamos el token que nos manda el frontend en el handshake
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Autenticación denegada: Token no proveído"));
        }
        const SECRET = process.env.JWT_SECRET;

        if (!SECRET) {
            console.error("❌ FATAL: JWT_SECRET no está definido en el .env (Socket)");
            return next(new Error("Error interno del servidor al verificar la conexión"));
        }
        try {
            // Verificamos el token (igual que en tu auth_middleware)
            const decoded = jwt.verify(token, SECRET) as { storeId: string, username: string };
            
            // Inyectamos el storeId en el socket para usarlo más adelante
            (socket as any).storeId = decoded.storeId;
            next(); // Todo ok, dejamos pasar la conexión
        } catch (err) {
            return next(new Error("Autenticación denegada: Token inválido o expirado"));
        }
    });

    io.on("connection", (socket) => {
        // Recuperamos el storeId que guardamos en el middleware
        const storeId = (socket as any).storeId;
        console.log(`💻 Cliente conectado: ${socket.id} - Local: ${storeId}`);

        // 🔥 EL BACKEND DECIDE LA SALA (Cero confianza en el cliente)
        socket.join(storeId);
        console.log(`🏠 Cliente ${socket.id} unido de forma segura a la sala: ${storeId}`);

        pingSession(storeId);
        // Opcional: Confirmación
        socket.emit("confirmacion-sala", { msg: `Te uniste de forma segura a ${storeId}` });

        // Borramos el socket.on("join-store") que tenías antes. Ya no hace falta.

        socket.on("disconnect", () => {
            console.log(`❌ Cliente desconectado: ${socket.id} - Local: ${storeId}`);
        });
    });

    return io;
};