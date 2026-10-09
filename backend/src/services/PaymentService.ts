import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import type { UserRepository } from '../repositories/UserRepository.ts';
import type { IOnlineOrder, IMpTokens } from '../types/domain.ts';
import { AppException } from '../dtos/appException.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// PaymentService — SRP + Strategy
// Maneja la integración con MercadoPago Marketplace.
// Cada tenant tiene su propio access_token vía OAuth.
// ============================================================

export interface WebhookResult {
  storeId: string;
  orderId: string;
  amountPaid: number;
}

export class PaymentService {
  private readonly userRepository: UserRepository;
  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  // ==========================
  //  Token management
  // ==========================

  /**
   * Refresca el access_token usando el refresh_token.
   * Guarda los nuevos tokens en Redis y devuelve el nuevo access_token.
   */
  private async refreshMpTokens(storeId: string, refreshToken: string): Promise<string> {
    const appId = process.env.MP_APP_ID;
    const appSecret = process.env.MP_APP_SECRET;

    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ storeId, status: res.status, body }, 'Error al refrescar token de MP');
      throw new AppException('No se pudo renovar la conexión con MercadoPago.', 500);
    }

    const data = await res.json();

    // Guardar 1 día antes del vencimiento real para evitar race conditions
    const expiresAt = new Date(Date.now() + (data.expires_in - 86400) * 1000).toISOString();

    const tokens: IMpTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      userId: data.user_id,
    };

    await this.userRepository.saveMpTokens(storeId, tokens);
    logger.info({ storeId }, 'Token de MP refrescado exitosamente');

    return data.access_token;
  }

  /**
   * Devuelve un access_token válido para el tenant.
   * Si el token está por vencer (< 7 días), lo refresca automáticamente.
   */
  private async getAccessToken(storeId: string): Promise<string> {
    const user = await this.userRepository.findById(storeId);

    if (!user?.mpAccessToken) {
      throw new AppException(
        'Este local no tiene MercadoPago configurado. Conectá tu cuenta desde el panel.',
        400,
      );
    }

    // Refresh lazy: si vence en menos de 7 días, renovar ahora
    if (user.mpTokenExpiresAt && user.mpRefreshToken) {
      const expiresAt = new Date(user.mpTokenExpiresAt);
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (expiresAt < sevenDaysFromNow) {
        return this.refreshMpTokens(storeId, user.mpRefreshToken);
      }
    }

    return user.mpAccessToken;
  }

  // ==========================
  //  Pagos
  // ==========================

  async createPreference(
    storeId: string,
    order: IOnlineOrder,
    frontendUrl: string,
    backendUrl: string,
  ): Promise<string> {
    const accessToken = await this.getAccessToken(storeId);
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: order.items.map((item) => ({
          id: String(item.id),
          title: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          currency_id: 'ARS',
        })),
        back_urls: {
          success: `${frontendUrl}/tienda/${storeId}?pago=exito`,
          failure: `${frontendUrl}/tienda/${storeId}?pago=error`,
          pending: `${frontendUrl}/tienda/${storeId}?pago=pendiente`,
        },
        auto_return: 'approved',
        external_reference: `${storeId}|${order.id}`,
        notification_url: `${backendUrl}/orders/webhook?store=${storeId}`,
      },
    });

    if (!result.init_point) {
      throw new AppException('Error al crear preferencia de pago', 500);
    }

    return result.init_point;
  }

  async processWebhook(
    storeId: string,
    paymentId: string | number,
    expectedAmount: number,
  ): Promise<WebhookResult | null> {
    const accessToken = await this.getAccessToken(storeId);
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: String(paymentId) });

    if (paymentInfo.status !== 'approved') return null;

    const externalReference = paymentInfo.external_reference;
    if (!externalReference?.includes('|')) return null;

    const [refStoreId, orderId] = externalReference.split('|');
    if (refStoreId !== storeId || !orderId) return null;

    const amountPaid = paymentInfo.transaction_amount || 0;
    if (amountPaid < expectedAmount) return null;

    return { storeId, orderId, amountPaid };
  }
}
