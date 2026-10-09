import type { Request, Response } from 'express';
import type { MenuRepository } from '../repositories/MenuRepository.ts';
import type { IProduct } from '../types/domain.ts';
import { logger } from '../config/logger.ts';

// ============================================================
// ProductController — Capa de Presentación
// Solo maneja HTTP. Toda lógica de datos va al repositorio.
// ============================================================

let _menuRepository: MenuRepository;

export function setMenuRepository(repo: MenuRepository) {
  _menuRepository = repo;
}

export const createProduct = async (req: Request, res: Response) => {
  try {
    const storeId = (req as any).user.storeId;
    const { name, description, price, imageUrl, category } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'El nombre y el precio son obligatorios' });
    }

    const newProduct: IProduct = {
      id: `prod_${Date.now()}`,
      name,
      description: description || '',
      price: Number(price),
      imageUrl: imageUrl || '',
      category: category || 'Otros',
      isAvailable: true,
    };

    await _menuRepository.save(storeId, newProduct);

    res.status(201).json({ message: 'Producto guardado', product: newProduct });
  } catch (error) {
    logger.error({ err: error }, 'Error al crear producto');
    res.status(500).json({ error: 'Error interno al guardar' });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const storeId = req.params.storeId as string;
    const products = await _menuRepository.findAllByStore(storeId);
    res.json(products);
  } catch (error) {
    logger.error({ err: error }, 'Error al obtener menú');
    res.status(500).json({ error: 'Error al cargar el menú' });
  }
};

export const deleteProduct = async (req: Request<{ productId: string }>, res: Response) => {
  try {
    const storeId = (req as any).user.storeId;
    const { productId } = req.params;
    await _menuRepository.delete(storeId, productId);
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al borrar el producto' });
  }
};

export const updateProduct = async (req: Request<{ productId: string }>, res: Response) => {
  try {
    const storeId = (req as any).user.storeId;
    const { productId } = req.params;
    const { name, description, price, imageUrl, category } = req.body;

    const existing = await _menuRepository.findById(storeId, productId);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const updatedProduct: IProduct = {
      ...existing,
      name: name || existing.name,
      description: description !== undefined ? description : existing.description,
      price: price ? Number(price) : existing.price,
      imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
      category: category || existing.category,
    };

    await _menuRepository.update(storeId, productId, updatedProduct);

    res.json({ message: 'Producto actualizado', product: updatedProduct });
  } catch (error) {
    logger.error({ err: error }, 'Error al editar producto');
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
};
