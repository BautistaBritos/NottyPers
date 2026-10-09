import type { Request, Response } from 'express';
import type { CategoryRepository } from '../repositories/CategoryRepository.ts';

// ============================================================
// CategoryController — Capa de Presentación
// Corregido: ya no instancia su propia conexión a Redis.
// Usa el repositorio inyectado (DIP).
// ============================================================

let _categoryRepository: CategoryRepository;

export function setCategoryRepository(repo: CategoryRepository) {
  _categoryRepository = repo;
}

export const getCategories = async (req: Request, res: Response) => {
  try {
    const storeId = req.params.storeId as string;
    const categories = await _categoryRepository.findAllByStore(storeId);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { storeId, name } = req.body;

    if (!name || !storeId) {
      return res.status(400).json({ error: 'Nombre y storeId son requeridos' });
    }

    await _categoryRepository.add(storeId, name);
    res.status(201).json({ message: 'Categoría creada con éxito', name });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar la categoría' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const storeId = req.params.storeId as string;
    const categoryName = req.params.categoryName as string;
    const decodedCategory = decodeURIComponent(categoryName);
    await _categoryRepository.remove(storeId, decodedCategory);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo eliminar' });
  }
};
