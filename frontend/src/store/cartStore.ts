import { atom } from "jotai";

// Definimos qué datos guardamos en el carrito
export interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

// Este es nuestro carrito global (arranca vacío)
export const cartAtom = atom<CartItem[]>([]);

// Este es un "átomo derivado" mágico: calcula el total automáticamente
export const cartTotalAtom = atom((get) => {
    const cart = get(cartAtom);
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
});