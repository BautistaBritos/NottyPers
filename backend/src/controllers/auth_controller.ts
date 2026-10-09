import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRepository } from '../repositories/UserRepository.ts';
import type { IUser, UpdatePaymentSettingsDto, IMpTokens } from '../types/domain.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// AuthController — Capa de Presentación
// Solo maneja HTTP: parsea request, llama al repositorio, responde.
// ============================================================

let _userRepository: UserRepository;

export function setUserRepository(repo: UserRepository) {
  _userRepository = repo;
}

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await _userRepository.findById(username);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const SECRET = process.env.JWT_SECRET;
    if (!SECRET) throw new Error('JWT_SECRET no está definido en el servidor.');

    const token = jwt.sign(
      {
        username: user.username,
        storeId: user.username,
        role: 'TenantAdmin', // Rol por defecto al registrarse
      },
      SECRET,
      { expiresIn: '8h' },
    );

    return res.json({ success: true, token });
  } catch (error) {
    logger.error({ err: error }, 'Error en login');
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const exists = await _userRepository.exists(username);
    if (exists) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser: IUser = {
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      modules: {
        enableLocal: true,
        enableTakeaway: true,
        enableMenu: true,
      },
      paymentSettings: {
        acceptsEfectivo: true,
        acceptsTransferencia: false,
        aliasBancario: '',
      },
    };

    await _userRepository.save(newUser);

    res.status(201).json({ success: true, message: 'Usuario registrado con éxito' });
  } catch (error) {
    logger.error({ err: error }, 'Error en registro');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updatePaymentSettings = async (req: any, res: Response) => {
  try {
    const storeId = req.user.username;
    const patch: UpdatePaymentSettingsDto = req.body;

    const updated = await _userRepository.updatePaymentSettings(storeId, patch);
    if (!updated) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    res.json({ success: true, message: 'Configuración de pagos guardada' });
  } catch (error) {
    logger.error({ err: error }, 'Error al guardar pagos');
    res.status(500).json({ error: 'Error interno al guardar la configuración' });
  }
};

// ============================================================
// MercadoPago OAuth (Marketplace)
// ============================================================

/**
 * GET /auth/mp/connect?token=JWT
 * Genera la URL de autorización de MP y redirige al dueño del local.
 * El token se pasa por query param porque es una navegación directa del browser.
 */
export const getMpConnectUrl = (req: Request, res: Response) => {
  try {
    const tokenParam = req.query.token as string;
    const SECRET = process.env.JWT_SECRET!;
    const payload = jwt.verify(tokenParam, SECRET) as { storeId: string };
    const storeId = payload.storeId;

    const appId = process.env.MP_APP_ID;
    if (!appId) return res.status(500).send('MP_APP_ID no configurado');

    const _backRaw = (process.env.BACKEND_URL || 'http://localhost:3001').trim();
    const backendUrl = _backRaw.startsWith('http') ? _backRaw : `https://${_backRaw}`;
    const callbackUrl = `${backendUrl}/auth/mp/callback`;

    // El state lleva el storeId firmado — previene CSRF
    const state = jwt.sign({ storeId }, SECRET, { expiresIn: '10m' });

    const mpAuthUrl =
      `https://auth.mercadopago.com.ar/authorization` +
      `?client_id=${appId}` +
      `&response_type=code` +
      `&platform_id=mp` +
      `&state=${state}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}`;

    res.redirect(mpAuthUrl);
  } catch (err) {
    logger.error({ err }, 'Error al generar URL de MP — sesión expirada o token inválido');
    // Redirigir al login para que el usuario obtenga un token fresco
    const _frontRaw = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    const frontendUrl = _frontRaw.startsWith('http') ? _frontRaw : `https://${_frontRaw}`;
    res.redirect(`${frontendUrl}/?session=expired`);
  }
};

/**
 * GET /auth/mp/callback?code=XX&state=YY
 * MP redirige aquí luego de que el dueño aprueba.
 * Intercambia el code por tokens y los guarda en Redis.
 */
export const mpCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query as { code: string; state: string };
  const _frontendRaw = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  const frontendUrl = _frontendRaw.startsWith('http') ? _frontendRaw : `https://${_frontendRaw}`;

  try {
    if (!code || !state) throw new Error('Faltan parámetros del callback');

    const SECRET = process.env.JWT_SECRET!;
    const payload = jwt.verify(state, SECRET) as { storeId: string };
    const storeId = payload.storeId;

    const _backendRaw = (process.env.BACKEND_URL || 'http://localhost:3001').trim();
    const backendUrl = _backendRaw.startsWith('http') ? _backendRaw : `https://${_backendRaw}`;

    // Intercambiar code por tokens
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_APP_ID,
        client_secret: process.env.MP_APP_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${backendUrl}/auth/mp/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error({ storeId, status: tokenRes.status, body }, 'Error en intercambio de token MP');
      return res.redirect(`${frontendUrl}/menu-admin?mp=error`);
    }

    const tokenData = await tokenRes.json();

    // Intentar obtener el email de la cuenta MP
    let mpEmail: string | undefined;
    try {
      const userRes = await fetch(`https://api.mercadopago.com/users/${tokenData.user_id}`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        mpEmail = userData.email;
      }
    } catch {
      // No crítico — continuamos sin el email
    }

    // Guardar 1 día antes del vencimiento real para evitar race conditions
    const expiresAt = new Date(Date.now() + (tokenData.expires_in - 86400) * 1000).toISOString();

    const tokens: IMpTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      userId: tokenData.user_id,
      ...(mpEmail ? { email: mpEmail } : {}),
    };

    await _userRepository.saveMpTokens(storeId, tokens);
    logger.info({ storeId, mpEmail }, 'MercadoPago conectado exitosamente');

    res.redirect(`${frontendUrl}/menu-admin?mp=success`);
  } catch (err) {
    logger.error({ err }, 'Error en callback OAuth de MP');
    res.redirect(`${frontendUrl}/menu-admin?mp=error`);
  }
};

/**
 * POST /auth/mp/disconnect
 * Elimina los tokens del tenant.
 */
export const disconnectMp = async (req: any, res: Response) => {
  try {
    const storeId = req.user.storeId;
    await _userRepository.clearMpTokens(storeId);
    logger.info({ storeId }, 'MercadoPago desconectado');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Error al desconectar MP');
    res.status(500).json({ error: 'Error al desconectar MercadoPago' });
  }
};

/**
 * GET /auth/mp/status
 * Devuelve si el tenant tiene MP conectado y los datos de la cuenta.
 */
export const getMpStatus = async (req: any, res: Response) => {
  try {
    const storeId = req.user.storeId;
    const user = await _userRepository.findById(storeId);

    if (!user?.mpAccessToken) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      email: user.mpEmail ?? null,
      expiresAt: user.mpTokenExpiresAt ?? null,
    });
  } catch (err) {
    logger.error({ err }, 'Error al obtener estado de MP');
    res.status(500).json({ error: 'Error interno' });
  }
};

export const getStorePaymentSettings = async (req: Request, res: Response) => {
  try {
    const storeId = req.params.storeId as string;
    const user = await _userRepository.findById(storeId);

    if (!user) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    const settings = user.paymentSettings ?? {};

    res.json({
      acceptsEfectivo: settings.acceptsEfectivo ?? true,
      acceptsTransferencia: settings.acceptsTransferencia ?? false,
      aliasBancario: settings.aliasBancario ?? '',
    });
  } catch (error) {
    logger.error({ err: error }, 'Error al leer pagos');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
