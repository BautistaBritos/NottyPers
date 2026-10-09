import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { cartAtom, cartTotalAtom } from "../../store/cartStore";
import { FiArrowLeft, FiUser, FiShoppingBag, FiDollarSign, FiRepeat, FiCheck, FiMapPin, FiTruck, FiCreditCard, FiShoppingBag as FiBag } from "react-icons/fi";
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import Swal from "sweetalert2";
import "./Checkout.scss";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function Checkout() {
    const { storeId } = useParams<{ storeId: string }>();
    const navigate = useNavigate();
    const [cart, setCart] = useAtom(cartAtom);
    const [total] = useAtom(cartTotalAtom);
    
    const [step, setStep] = useState(1);
    const [paymentConfig, setPaymentConfig] = useState({
        acceptsEfectivo: true,
        acceptsTransferencia: false,
        aliasBancario: ""
    });
    const [loadingConfig, setLoadingConfig] = useState(true);

    const [name, setName] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [orderType, setOrderType] = useState<"take-away" | "delivery">("take-away");
    const [address, setAddress] = useState("");

    const [paymentMethod, setPaymentMethod] = useState(""); 
    const [loading, setLoading] = useState(false);
    
    const isValidPhone = whatsapp.length > 5 ? (parsePhoneNumberFromString(whatsapp, 'AR')?.isValid() ?? false) : true;

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`${API_URL}/auth/payment-settings/${storeId}`);
                if (res.ok) {
                    const data = await res.json();
                    setPaymentConfig(data);
                    if (data.acceptsEfectivo) setPaymentMethod('efectivo');
                    else if (data.acceptsTransferencia) setPaymentMethod('transferencia');
                }
            } catch  {
                console.error("Error cargando métodos de pago");
            } finally {
                setLoadingConfig(false);
            }
        };
        fetchConfig();
    }, [storeId]);

    if (cart.length === 0) {
        return (
            <div className="checkout-page empty-state">
                <div className="empty-card"><h2>Tu carrito está vacío</h2><button onClick={() => navigate(`/tienda/${storeId}`)} className="btn-back-home">Volver a la tienda</button></div>
            </div>
        );
    }

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        const phoneNumber = parsePhoneNumberFromString(whatsapp, 'AR');
        if (!phoneNumber || !phoneNumber.isValid()) {
            Swal.fire("WhatsApp inválido", "Por favor, ingresa un número válido de Argentina.", "error");
            return;
        }
        if (orderType === "delivery" && address.trim().length < 5) {
            Swal.fire("Dirección incompleta", "Por favor ingresá tu calle y número para el envío.", "warning");
            return;
        }
        setStep(2); 
    };

    const handleSubmitOrder = async () => {
        if (!paymentMethod) return Swal.fire("Método de pago", "Seleccioná cómo querés pagar.", "warning");

        setLoading(true);
        const phoneNumber = parsePhoneNumberFromString(whatsapp, 'AR');

        const orderData = { 
            storeId, 
            customerName: name, 
            customerPhone: phoneNumber?.format('E.164') || whatsapp, 
            orderType,
            address: orderType === "delivery" ? address : "",
            items: cart, 
            total,
            paymentMethod 
        };

        try {
            const response = await fetch(`${API_URL}/orders/online`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(orderData)
            });
            const data = await response.json();

            if (!response.ok) {
                Swal.fire("Lo sentimos", data.error || "No se pudo procesar el pedido.", "warning");
                setLoading(false);
                return; 
            }

            // 🌟 ACÁ EMPIEZA LA MAGIA DE WHATSAPP 🌟
            if (paymentMethod === 'transferencia' && data.whatsappNumber) {
                Swal.fire({
                    title: "¡Pedido Recibido!",
                    text: "Por favor, envianos el comprobante de pago por WhatsApp para que empecemos a preparar tu pedido.",
                    icon: "success",
                    showCancelButton: true,
                    confirmButtonText: "Enviar Comprobante 💬",
                    cancelButtonText: "Cerrar",
                    confirmButtonColor: "#10b981", // Verde WhatsApp
                    cancelButtonColor: "#64748b",
                    allowOutsideClick: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        const mensaje = `¡Hola! Acabo de hacer un pedido online a nombre de *${name}*. Te adjunto el comprobante de pago de $${total}.`;
                        const waLink = `https://wa.me/${data.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
                        window.open(waLink, '_blank');
                    }
                    // Limpiamos el carrito y volvemos a la tienda
                    setCart([]); 
                    navigate(`/tienda/${storeId}`);
                });
            } else {
                // Cartel normal (efectivo o si el bot no está conectado)
                Swal.fire({
                    title: "¡Pedido Recibido!",
                    text: "Te contactaremos por WhatsApp para coordinar.",
                    icon: "success",
                    confirmButtonColor: "#0f172a"
                }).then(() => {
                    setCart([]);
                    navigate(`/tienda/${storeId}`);
                });
            }
            
        } catch  {
            Swal.fire("Error", "Problema de conexión", "error");
            setLoading(false);
        }
    };

    if (loadingConfig) return <div className="checkout-page flex justify-center items-center h-screen"><p className="text-xl font-bold animate-pulse text-slate-400">Cargando caja...</p></div>;

    return (
        <div className="checkout-page">
            <div className="checkout-container">
                <header className="checkout-header">
                    <button className="btn-back" onClick={() => step === 1 ? navigate(`/tienda/${storeId}`) : setStep(1)}><FiArrowLeft /></button>
                    <h1>{step === 1 ? 'Tus Datos' : 'Finalizar Pedido'}</h1>
                </header>

                <div className="checkout-card">
                    {step === 1 && (
                        <>
                            <section className="summary-section">
                                <div className="section-title"><FiShoppingBag /><h3>Resumen ({cart.length} ítems)</h3></div>
                                <div className="summary-total" style={{ marginTop: '10px' }}><span>Total a Pagar</span><strong style={{ fontSize: '24px' }}>${total}</strong></div>
                            </section>

                            <form onSubmit={handleNextStep} className="checkout-form">
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                    <div onClick={() => setOrderType('take-away')} style={{ flex: 1, padding: '12px', textAlign: 'center', borderRadius: '12px', border: `2px solid ${orderType === 'take-away' ? '#0f172a' : '#e2e8f0'}`, backgroundColor: orderType === 'take-away' ? '#f8fafc' : 'white', cursor: 'pointer', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}><FiBag size={20} /> Retiro por local</div>
                                    <div onClick={() => setOrderType('delivery')} style={{ flex: 1, padding: '12px', textAlign: 'center', borderRadius: '12px', border: `2px solid ${orderType === 'delivery' ? '#0f172a' : '#e2e8f0'}`, backgroundColor: orderType === 'delivery' ? '#f8fafc' : 'white', cursor: 'pointer', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}><FiTruck size={20} /> Envío (Delivery)</div>
                                </div>

                                <div className="section-title"><FiUser /><h3>Tus datos</h3></div>
                                <div className="form-group">
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" required className="form-input" />
                                </div>
                                <div className="form-group">
                                    <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (Ej: 1122334455)" required className={`form-input ${!isValidPhone && whatsapp.length > 5 ? 'error' : ''}`} />
                                </div>

                                {orderType === "delivery" && (
                                    <div className="form-group" style={{ marginTop: '15px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' }}><FiMapPin style={{display: 'inline', marginRight: '5px'}}/> Dirección de Envío</label>
                                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle y número, Piso, Depto..." required className="form-input" />
                                    </div>
                                )}

                                <button type="submit" disabled={!name || !isValidPhone || whatsapp.length < 8} className="btn-submit">
                                    Continuar al Pago
                                </button>
                            </form>
                        </>
                    )}

                    {step === 2 && (
                        <div className="checkout-form" style={{ marginTop: 0 }}>
                            <div className="section-title"><FiCreditCard /><h3>¿Cómo querés pagar?</h3></div>
                            <div className="payment-options">
                                {paymentConfig.acceptsEfectivo && (
                                    <div className={`payment-card ${paymentMethod === 'efectivo' ? 'active' : ''}`} onClick={() => setPaymentMethod('efectivo')}>
                                        <div className="payment-icon cash"><FiDollarSign /></div><span>Efectivo al recibir</span>{paymentMethod === 'efectivo' && <FiCheck className="check" />}
                                    </div>
                                )}
                                {paymentConfig.acceptsTransferencia && (
                                    <div className={`payment-card ${paymentMethod === 'transferencia' ? 'active' : ''}`} onClick={() => setPaymentMethod('transferencia')}>
                                        <div className="payment-icon trans"><FiRepeat /></div><span>Transferencia Bancaria</span>{paymentMethod === 'transferencia' && <FiCheck className="check" />}
                                    </div>
                                )}
                            </div>

                            {paymentMethod === 'transferencia' && paymentConfig.aliasBancario && (
                                <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '15px', textAlign: 'center' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Transferí <strong>${total}</strong> a este Alias/CBU:</p>
                                    <p style={{ margin: '5px 0 0', fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '1px' }}>{paymentConfig.aliasBancario}</p>
                                    {/* 🌟 AVISO PARA EL CLIENTE */}
                                    <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>⚠️ Al confirmar, te daremos un link para enviar el comprobante.</p>
                                </div>
                            )}

                            {!paymentConfig.acceptsEfectivo && !paymentConfig.acceptsTransferencia && (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444', backgroundColor: '#fef2f2', borderRadius: '12px', marginTop: '10px' }}>
                                    <strong>¡Ups!</strong> Este local no configuró medios de cobro.
                                </div>
                            )}

                            <button onClick={handleSubmitOrder} disabled={loading || !paymentMethod} className="btn-submit" style={{ marginTop: '25px' }}>
                                {loading ? "Procesando..." : "Confirmar Pedido"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}