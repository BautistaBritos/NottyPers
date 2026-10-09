import type { Redis } from '@upstash/redis';
import type { IUser, IStoreModules, IPaymentSettings, IMpTokens } from '../types/domain.ts';

// ============================================================
// UserRepository — Patrón Repository
// Toda operación sobre tenants/usuarios pasa por acá.
// ============================================================

export class UserRepository {
  private readonly redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  private key(storeId: string) {
    return `user:${storeId}`;
  }

  private parse(raw: unknown): IUser {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as IUser);
  }

  async findById(storeId: string): Promise<IUser | null> {
    const raw = await this.redis.get<string>(this.key(storeId));
    if (!raw) return null;
    return this.parse(raw);
  }

  async exists(storeId: string): Promise<boolean> {
    const raw = await this.redis.get(this.key(storeId));
    return raw !== null;
  }

  async save(user: IUser): Promise<void> {
    await this.redis.set(this.key(user.username), JSON.stringify(user));
  }

  async findAll(): Promise<IUser[]> {
    const keys = await this.redis.keys('user:*');
    if (!keys || keys.length === 0) return [];
    const raw = await this.redis.mget(...keys);
    return raw
      .filter(Boolean)
      .map((d) => this.parse(d));
  }

  async updateModules(storeId: string, modules: IStoreModules): Promise<IUser | null> {
    const user = await this.findById(storeId);
    if (!user) return null;
    user.modules = modules;
    await this.save(user);
    return user;
  }

  async saveMpTokens(storeId: string, tokens: IMpTokens): Promise<void> {
    const user = await this.findById(storeId);
    if (!user) return;
    user.mpAccessToken = tokens.accessToken;
    user.mpRefreshToken = tokens.refreshToken;
    user.mpTokenExpiresAt = tokens.expiresAt;
    user.mpUserId = tokens.userId;
    if (tokens.email) user.mpEmail = tokens.email;
    await this.save(user);
  }

  async clearMpTokens(storeId: string): Promise<void> {
    const user = await this.findById(storeId);
    if (!user) return;
    delete user.mpAccessToken;
    delete user.mpRefreshToken;
    delete user.mpTokenExpiresAt;
    delete user.mpUserId;
    delete user.mpEmail;
    await this.save(user);
  }

  async updatePaymentSettings(
    storeId: string,
    patch: Partial<IPaymentSettings>,
  ): Promise<IUser | null> {
    const user = await this.findById(storeId);
    if (!user) return null;

    if (!user.paymentSettings) {
      user.paymentSettings = {
        acceptsEfectivo: true,
        acceptsTransferencia: false,
        aliasBancario: '',
      };
    }

    if (patch.acceptsEfectivo !== undefined)
      user.paymentSettings.acceptsEfectivo = patch.acceptsEfectivo;
    if (patch.acceptsTransferencia !== undefined)
      user.paymentSettings.acceptsTransferencia = patch.acceptsTransferencia;
    if (patch.aliasBancario !== undefined)
      user.paymentSettings.aliasBancario = patch.aliasBancario;

    // Eliminar campo legacy si existe
    delete user.mpAccessToken;

    await this.save(user);
    return user;
  }
}
