import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAtom } from "jotai";
import { cartAtom, cartTotalAtom } from "../../store/cartStore";
import Swal from "sweetalert2";
import "./Tienda.scss";
import { FiShoppingBag, FiInfo, FiPlus } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    category: string;
    isAvailable: boolean;
}

export default function Tienda() {
    const { storeId } = useParams<{ storeId: string }>(); 
    const navigate = useNavigate(); 
    
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [cart, setCart] = useAtom(cartAtom);
    const [total] = useAtom(cartTotalAtom);
    const [searchParams, setSearchParams] = useSearchParams();
    
    const [isStoreOpen, setIsStoreOpen] = useState(true);

    // 🌟 NUEVO: Estados para los módulos de tu modelo de negocio
    const [hasMenuModule, setHasMenuModule] = useState(true); 
    const [hasTakeawayModule, setHasTakeawayModule] = useState(true); 
    
    useEffect(() => {
        const estadoPago = searchParams.get("pago");
        
        if (estadoPago === "exito") {
            Swal.fire({
                icon: 'success',
                title: '¡Pago Exitoso! 🎉',
                text: 'Tu pedido ya entró a la cocina. Te avisamos por WhatsApp cuando esté listo.',
                confirmButtonColor: '#10b981'
            });
            setCart([]);
            setSearchParams({});
        } else if (estadoPago === "error") {
            Swal.fire({
                icon: 'error',
                title: 'Pago rechazado',
                text: 'Hubo un problema con el pago. Por favor, intentá de nuevo.',
                confirmButtonColor: '#ef4444'
            });
            setSearchParams({});
        }
    }, [searchParams, setCart, setSearchParams]);

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const response = await fetch(`${API_URL}/api/productos/${storeId}`);
                if (!response.ok) throw new Error("No se pudo cargar el menú");
                
                const data = await response.json();
                setProducts(data);
            } catch (err) {
                setError("Ocurrió un error al cargar el menú.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        const fetchStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/orders/status/${storeId}`);
                const data = await res.json();
                setIsStoreOpen(data.isOpen);
                
                // 🌟 NUEVO: Leemos exactamente qué plan nos compró este cliente
                if (data.modules) {
                    setHasMenuModule(data.modules.enableMenu);
                    setHasTakeawayModule(data.modules.enableTakeaway);
                }
            } catch (err) {
                console.error("Error al obtener estado de la tienda", err);
            }
        };

        if (storeId) {
            fetchMenu();
            fetchStatus();
        }
    }, [storeId]);

    const handleAddToCart = (product: Product) => {
        if (!isStoreOpen) {
            Swal.fire({ icon: 'error', title: 'Cerrado', text: 'El local no está recibiendo pedidos ahora.' });
            return;
        }

        setCart((prevCart) => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item => 
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prevCart, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
        });
    };

    if (loading) return <div style={{textAlign: 'center', padding: '50px', fontWeight: 'bold'}}>Cargando menú... 🍔</div>;
    if (error) return <div style={{textAlign: 'center', padding: '50px', color: 'red'}}>{error}</div>;

    // 🌟 BLOQUEO N°1: Si NO pagó el módulo Catálogo, le mostramos una pantalla muerta.
    if (!hasMenuModule) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
                <div className="text-6xl mb-6">🔒</div>
                <h1 className="text-3xl font-black text-slate-800 mb-4">Catálogo no disponible</h1>
                <p className="text-slate-500 font-bold max-w-md">
                    El menú digital de {storeId?.replace("-", " ").toUpperCase()} no se encuentra activo en este momento.
                </p>
                <div className="mt-12 text-xs text-slate-400 font-bold tracking-widest uppercase">
                    Powered by NottyPers
                </div>
            </div>
        );
    }

    const groupedProducts = products.reduce((acc, product) => {
        const cat = product.category || "Otros"; 
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    const orderPriority = ["Hamburguesas", "Papas Fritas", "Bebidas", "Postres", "Otros"];
    
    const existingCategories = Object.keys(groupedProducts).sort((a, b) => {
        const indexA = orderPriority.indexOf(a);
        const indexB = orderPriority.indexOf(b);
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });

    return (
        <div className="tienda-page">
            <div className="tienda-container">
                
                <div className="brand-tag">NottyPers</div>

                <header className="store-header">
                    <div className="store-info">
                        <h1>{storeId?.replace("-", " ")}</h1>
                        {/* 🌟 Solo mostramos si está Abierto o Cerrado si tiene Take Away */}
                        {hasTakeawayModule && (
                            <div className="store-status-pill">
                                <span className={`dot ${isStoreOpen ? 'online' : 'offline'}`}></span>
                                {isStoreOpen ? 'Abierto ahora' : 'Cerrado'}
                            </div>
                        )}
                    </div>
                    <p className="store-subtitle">Explorá nuestro menú y conocé nuestros productos.</p>
                </header>

                {/* 🌟 BLOQUEO N°2: Si SÍ tiene Catálogo pero NO tiene Take Away */}
                {!hasTakeawayModule ? (
                    <div className="alert-info bg-indigo-50 text-indigo-700 p-4 rounded-xl flex items-center gap-3 mb-8 font-bold border border-indigo-100 shadow-sm">
                        <FiInfo size={24} className="flex-shrink-0" />
                        <span>Modo Catálogo: Podés ver nuestros productos acá, pero los pedidos se realizan en la caja del local.</span>
                    </div>
                ) : !isStoreOpen ? (
                    <div className="alert-closed bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 mb-8 font-bold border border-red-100 shadow-sm">
                        <FiInfo size={24} className="flex-shrink-0" />
                        <span>El local no está recibiendo pedidos online en este momento.</span>
                    </div>
                ) : null}
                
                {products.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🍔</div>
                        <p>El menú está siendo preparado...</p>
                    </div>
                ) : (
                    <div className="menu-list">
                        {existingCategories.map((category) => (
                            <section key={category} className="category-section">
                                <h2 className="category-title">{category}</h2>

                                <div className="products-grid">
                                    {groupedProducts[category].map((product) => (
                                        <div key={product.id} className={`product-card ${!isStoreOpen && hasTakeawayModule ? 'is-closed' : ''}`}>
                                            
                                            <div className="product-img-wrapper">
                                                {product.imageUrl ? (
                                                    <img src={product.imageUrl} alt={product.name} className="product-img" />
                                                ) : (
                                                    <div className="product-img-placeholder">🍔</div>
                                                )}
                                                {/* 🌟 SOLO mostramos el botón de '+' si tiene Take Away y está abierto */}
                                                {isStoreOpen && hasTakeawayModule && (
                                                    <button 
                                                        onClick={() => handleAddToCart(product)}
                                                        className="btn-add-floating"
                                                    >
                                                        <FiPlus />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="product-info">
                                                <h3>{product.name}</h3>
                                                <p className="description">{product.description}</p>
                                                <p className="price">${product.price}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}

                {/* 🌟 BARRA FLOTANTE DEL CARRITO: Solo aparece si hay carrito activo (y como el botón de '+' está bloqueado, el carrito siempre va a estar vacío si no pagó el módulo, así que se oculta sola) */}
                {cart.length > 0 && hasTakeawayModule && (
                    <div className="floating-cart-container">
                        <button 
                            className="floating-cart-bar"
                            onClick={() => navigate(`/checkout/${storeId}`)}
                            disabled={!isStoreOpen}
                        >
                            <div className="cart-left">
                                <div className="cart-icon-box">
                                    <FiShoppingBag />
                                    <span className="badge">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
                                </div>
                                <span className="view-cart-text">Ver mi pedido</span>
                            </div>
                            <div className="cart-right">
                                <span className="total-amount">${total}</span>
                            </div>
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}