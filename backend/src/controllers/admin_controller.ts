import type { Request, Response } from 'express';
import type { UserRepository } from '../repositories/UserRepository.ts';
import type { IStoreModules } from '../types/domain.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// AdminController — Capa de Presentación
// Solo maneja HTTP. Operaciones sobre todos los tenants.
// ============================================================

let _userRepository: UserRepository;

export function setUserRepository(repo: UserRepository) {
  _userRepository = repo;
}

export const getAllStores = async (_req: Request, res: Response) => {
  try {
    const users = await _userRepository.findAll();

    const stores = users.map((user) => ({
      storeId: user.username,
      modules: user.modules ?? { enableMenu: true, enableLocal: true, enableTakeaway: true },
      createdAt: user.createdAt,
    }));

    res.json({ success: true, data: stores });
  } catch (error) {
    logger.error({ err: error }, 'Error en getAllStores');
    res.status(500).json({ error: 'Error al obtener la lista de locales' });
  }
};

export const updateStoreModules = async (req: Request, res: Response) => {
  try {
    const storeId = req.params.storeId as string;
    const { enableMenu, enableLocal, enableTakeaway } = req.body;

    const modules: IStoreModules = {
      enableMenu: !!enableMenu,
      enableLocal: !!enableLocal,
      enableTakeaway: !!enableTakeaway,
    };

    const updated = await _userRepository.updateModules(storeId, modules);
    if (!updated) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    res.json({ success: true, message: 'Permisos actualizados', modules });
  } catch (error) {
    logger.error({ err: error }, 'Error en updateStoreModules');
    res.status(500).json({ error: 'Error al actualizar permisos' });
  }
};
