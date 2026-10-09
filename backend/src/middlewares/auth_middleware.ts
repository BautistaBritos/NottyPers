import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Acceso denegado." });

    // 1. Buscamos el secreto acá adentro
    const SECRET = process.env.JWT_SECRET;
    
    if (!SECRET) {
        console.error("❌ FATAL: JWT_SECRET no definido en el .env");
        return res.status(500).json({ error: "Error de configuración del servidor." });
    }

    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (err) {
        res.status(403).json({ error: "Token inválido." });
    }
};

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    const adminKey = req.headers["x-admin-key"]; 

    // Buscamos la clave del admin acá adentro también
    const requiredKey = process.env.ADMIN_REGISTRATION_KEY;

    if (!adminKey || adminKey !== requiredKey) {
        return res.status(403).json({ 
            error: "Acceso denegado. Se requiere una credencial válida para registrar locales." 
        });
    }

    next(); 
};