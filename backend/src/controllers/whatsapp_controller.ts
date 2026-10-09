import type { Request, Response } from "express";
import { initWhatsApp, sessions } from "../whatsapp.ts";
import { logger } from "../config/logger.ts";

export const connectWhatsApp = async (req: Request, res: Response) => {
    // Obtenemos el storeId desde el token (inyectado por authenticateToken)
    const storeId = (req as any).user.storeId;

    if (!storeId) return res.status(400).json({ error: "No se encontró ID de local" });
    const session = sessions.get(storeId);
    // Verificamos si ya está conectado
    if (session?.sock?.user) {
        return res.json({ connected: true, message: "WhatsApp ya está conectado" });
    }

    // Iniciamos el proceso (esto generará el QR y lo enviará por Socket)
    // No usamos 'await' aquí para que la respuesta HTTP sea rápida
    initWhatsApp(storeId);

    res.json({ connected: false, message: "Iniciando vinculación..." });
};


export const checkWhatsAppStatus = async (req: Request, res: Response) => {
    try {
        const storeId = (req as any).user.storeId;
        
        // Buscamos si la sesión de este local existe y tiene un usuario logueado
        const session = sessions.get(storeId);
        
        if (session?.sock?.user) {
            return res.json({ connected: true });
        }
        
        return res.json({ connected: false });
    } catch (error) {
        logger.error({ err: error }, "Error al verificar estado de WhatsApp");
        res.status(500).json({ error: "Error al verificar estado" });
    }
};