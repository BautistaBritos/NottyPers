import { useState, useEffect, useRef, useCallback } from "react";
import Swal from "sweetalert2";
import { io } from "socket.io-client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  FiZap, FiPackage, FiShoppingBag, FiVolume2, FiVolumeX,
  FiToggleLeft, FiToggleRight, FiMessageSquare, FiWifiOff,
  FiLogOut, FiPlus, FiCheck, FiTruck, FiClock, FiPhone,
  FiExternalLink,
} from "react-icons/fi";
import { API_URL } from "../../config/settings";
import type { Order } from "../../App";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import "./Orders.scss";

interface CustomJwtPayload { storeId: string; username: string; }

export interface OnlineOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
  paymentMethod?: string;
  type?: string;
  address?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

const socket = io(API_URL, { transports: ["websocket"], autoConnect: false });
const AUDIO_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: "Mercado Pago",
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " hs";
};

const elapsed = (dateStr?: string) =>
  dateStr ? formatDistanceToNow(new Date(dateStr), { locale: es }).toUpperCase() : "POCO";

export default function Orders({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [viewMode, setViewMode] = useState<"local" | "online">("local");
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [, setTick] = useState(0);
  const [activeModules, setActiveModules] = useState({ local: true, online: true, menu: true });
  const [isStatusLoaded, setIsStatusLoaded] = useState(false);

  const isConnectingRef = useRef(false);
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { notifAudioRef.current = new Audio(AUDIO_URL); }, []);

  const playNotification = useCallback(() => {
    if (!isMuted && notifAudioRef.current) {
      notifAudioRef.current.currentTime = 0;
      notifAudioRef.current.play().catch(() => {});
    }
  }, [isMuted]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { onLogout(); return; }
    try {
      const decoded = jwtDecode<CustomJwtPayload>(token);
      setCurrentStoreId(decoded.storeId);
    } catch { onLogout(); }
  }, [onLogout]);

  useEffect(() => {
    if (!currentStoreId) return;
    fetch(`${API_URL}/orders/status/${currentStoreId}`)
      .then((r) => r.json())
      .then((data) => {
        setIsStoreOpen(data.isOpen);
        if (data.modules) {
          setActiveModules({ local: data.modules.enableLocal, online: data.modules.enableTakeaway, menu: data.modules.enableMenu });
          if (!data.modules.enableLocal && data.modules.enableTakeaway) setViewMode("online");
        }
        if (data.wpConnected) setWsConnected(true);
        setIsStatusLoaded(true);
      })
      .catch(() => setIsStatusLoaded(true));
  }, [currentStoreId]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const [resLocal, resOnline] = await Promise.allSettled([
          fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/orders/takeaway`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (resLocal.status === "fulfilled") {
          if (resLocal.value.status === 401 || resLocal.value.status === 403) { onLogout(); return; }
          if (resLocal.value.ok) setOrders((await resLocal.value.json()).data || []);
        }
        if (resOnline.status === "fulfilled" && resOnline.value.ok)
          setOnlineOrders((await resOnline.value.json()).data || []);
      } finally { setLoading(false); }
    };
    fetchAll();
  }, [onLogout]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    socket.auth = { token };
    socket.connect();

    socket.on("pedido-vinculado", (p: Order) => {
      setOrders((prev) => prev.some((o) => o.orderId === p.orderId) ? prev : [...prev, p]);
      playNotification();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: `Pedido #${p.orderNumber} vinculado`, timer: 2000, showConfirmButton: false });
    });

    socket.on("nuevo-pedido", (p: OnlineOrder) => {
      setOnlineOrders((prev) => [p, ...prev]);
      playNotification();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: "¡Nuevo pedido!", timer: 3000, showConfirmButton: false });
    });

    socket.on("whatsapp-qr", ({ qr }) => {
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
      if (!isConnectingRef.current) return;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qr)}`;
      Swal.fire({
        title: "Vinculá tu WhatsApp",
        html: `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px">
          <img src="${qrUrl}" alt="QR" style="border-radius:12px"/>
          <p style="font-size:12px;color:#64748b;margin:0">Escanealo rápido, se actualiza cada 20 seg.</p></div>`,
        showConfirmButton: false, showCloseButton: true, allowOutsideClick: false,
      }).then((r) => { if (r.isDismissed) isConnectingRef.current = false; });
    });

    socket.on("whatsapp-ready", () => {
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
      setWsConnected(true);
      if (isConnectingRef.current) {
        isConnectingRef.current = false;
        Swal.close();
        Swal.fire({ icon: "success", title: "WhatsApp activo", timer: 1500, showConfirmButton: false });
      }
    });

    return () => { socket.disconnect(); socket.off(); };
  }, [playNotification]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleToggleStore = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/orders/status/toggle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setIsStoreOpen(data.isOpen);
      Swal.fire({ toast: true, position: "top-end", icon: data.isOpen ? "success" : "warning", title: data.isOpen ? "Local abierto" : "Local cerrado", timer: 2000, showConfirmButton: false });
    } catch {}
  };

  const handleWhatsAppAction = async () => {
    const token = localStorage.getItem("token");
    if (wsConnected) {
      const confirm = await Swal.fire({
        title: "¿Desconectar WhatsApp?",
        text: "El bot dejará de enviar mensajes.",
        icon: "warning", showCancelButton: true,
        confirmButtonColor: "#ef4444", cancelButtonColor: "#64748b",
        confirmButtonText: "Sí, desconectar",
      });
      if (confirm.isConfirmed) {
        const res = await fetch(`${API_URL}/orders/disconnect-whatsapp`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          setWsConnected(false);
          Swal.fire({ icon: "success", title: "Desconectado", timer: 1500, showConfirmButton: false });
        }
      }
    } else {
      isConnectingRef.current = true;
      Swal.fire({ title: "Iniciando WhatsApp…", text: "Aguardá un momento…", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      fetch(`${API_URL}/orders/connect-whatsapp`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const data = await res.json();
          if (data.connected || data.alreadyConnected) {
            setWsConnected(true); isConnectingRef.current = false;
            if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
            Swal.fire({ icon: "success", title: "¡Ya estaba conectado!", timer: 1500, showConfirmButton: false });
          }
        })
        .catch(() => { isConnectingRef.current = false; Swal.fire({ icon: "error", title: "Error al conectar" }); });
      qrTimeoutRef.current = setTimeout(() => {
        if (isConnectingRef.current) {
          isConnectingRef.current = false; setWsConnected(false);
          Swal.fire({ icon: "warning", title: "Demora en WhatsApp", text: "El QR está tardando. Verificá que el backend esté corriendo.", confirmButtonColor: "#0f172a" });
        }
      }, 15000);
    }
  };

  const createOrder = async () => {
    const trimmed = orderNumber.trim();
    if (!/^\d+$/.test(trimmed)) { Swal.fire({ icon: "error", title: "Solo números", toast: true, position: "top-end", timer: 2000, showConfirmButton: false }); return; }
    if (orders.some((o) => o.orderNumber === trimmed)) {
      Swal.fire({ icon: "warning", title: "Pedido duplicado", text: `El #${trimmed} ya está en curso.` }); return;
    }
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderNumber: trimmed, customerName }),
      });
      const data = await res.json();
      Swal.fire({
        title: `Pedido #${trimmed}`,
        html: `<div style="display:flex;justify-content:center"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.whatsappLink)}" style="border-radius:12px"/></div>`,
        showCloseButton: true, showConfirmButton: false,
      });
      setOrderNumber(""); setCustomerName("");
    } catch { Swal.fire({ icon: "error", title: "Error al crear pedido" }); }
  };

  const completeOrder = async (orderId: string) => {
    const confirm = await Swal.fire({ title: "¿Finalizar pedido?", icon: "warning", showCancelButton: true, confirmButtonColor: "#0f172a" });
    if (!confirm.isConfirmed) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/orders/complete`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId }),
    });
    if (res.ok) setOrders((prev) => prev.map((o) => o.orderId === orderId ? { ...o, status: "terminado", completedAt: new Date().toISOString() } : o));
  };

  const acceptOnlineOrder = async (orderId: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/orders/online/accept`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId }),
    });
    if (res.ok) setOnlineOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "preparación" } : o));
  };

  const completeTakeAwayOrder = async (orderId: string, name: string) => {
    const confirm = await Swal.fire({
      title: `¿Despachar pedido de ${name}?`, text: "Se borrará de la lista.",
      icon: "question", showCancelButton: true,
      confirmButtonColor: "#10b981", confirmButtonText: "Despachar",
    });
    if (!confirm.isConfirmed) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/orders/takeaway/complete`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId }),
    });
    if (res.ok) {
      setOnlineOrders((prev) => prev.filter((o) => o.id !== orderId));
      Swal.fire({ icon: "success", title: "¡Despachado!", timer: 1500, showConfirmButton: false });
    }
  };

  const ordersByStatus = orders.reduce<Record<string, Order[]>>((acc, o) => {
    if (!acc[o.status]) acc[o.status] = [];
    acc[o.status].push(o);
    return acc;
  }, {});

  // ─── Render ────────────────────────────────────────────────
  if (!isStatusLoaded) {
    return (
      <div className="orders-splash">
        <div className="orders-splash-icon"><FiZap /></div>
        <p className="orders-loading">
          Cargando panel
          <span className="loading-dot">.</span>
          <span className="loading-dot">.</span>
          <span className="loading-dot">.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <div className="orders-inner">

        {/* ── Header ─────────────────────────────────── */}
        <header className="panel-header" role="banner">
          <div className="panel-brand">
            <div className="panel-brand-icon"><FiZap /></div>
            <h1>NottyPers</h1>
          </div>

          <div className="panel-actions">
            {/* Gestionar menú — siempre visible para el dueño */}
            <button className="hbtn hbtn--menu" onClick={() => navigate("/menu-admin")}>
              <FiPackage /> Menú
            </button>

            {/* Ver carta pública — abre la tienda en nueva pestaña */}
            {currentStoreId && (
              <a
                className="hbtn hbtn--store"
                href={`/tienda/${currentStoreId}`}
                target="_blank"
                rel="noreferrer"
                title="Ver tu carta pública"
              >
                <FiExternalLink /> Mi carta
              </a>
            )}

            <button
              className={`hbtn ${isMuted ? "hbtn--sound-off" : "hbtn--sound"}`}
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "Activar sonido" : "Silenciar"}
            >
              {isMuted ? <FiVolumeX /> : <FiVolume2 />}
            </button>

            {activeModules.online && (
              <button
                className={`hbtn ${isStoreOpen ? "hbtn--open" : "hbtn--closed"}`}
                onClick={handleToggleStore}
              >
                {isStoreOpen ? <FiToggleRight /> : <FiToggleLeft />}
                {isStoreOpen ? "Abierto" : "Cerrado"}
              </button>
            )}

            <button
              className={`hbtn ${wsConnected ? "hbtn--wa-on" : "hbtn--wa-off"}`}
              onClick={handleWhatsAppAction}
              title={wsConnected ? "Desconectar WhatsApp" : "Conectar WhatsApp"}
            >
              {wsConnected ? <FiMessageSquare /> : <FiWifiOff />}
              {wsConnected ? "WA Activo" : "WA Inactivo"}
            </button>

            <button className="hbtn hbtn--logout" onClick={onLogout} title="Cerrar sesión">
              <FiLogOut />
            </button>
          </div>
        </header>

        {/* ── Tabs ───────────────────────────────────── */}
        {activeModules.local && activeModules.online && (
          <div className="panel-tabs">
            <button
              className={`tab-btn ${viewMode === "local" ? "is-active-local" : ""}`}
              onClick={() => setViewMode("local")}
            >
              <FiPackage /> Local
            </button>
            <button
              className={`tab-btn ${viewMode === "online" ? "is-active-online" : ""}`}
              onClick={() => setViewMode("online")}
            >
              <FiShoppingBag /> Online
            </button>
          </div>
        )}

        {/* ── Vista Local (Beeper) ───────────────────── */}
        {viewMode === "local" && activeModules.local && (
          <>
            <div className="order-input-bar">
              <input
                placeholder="N° de pedido"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createOrder()}
              />
              <input
                placeholder="Nombre del cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createOrder()}
              />
              <button className="btn-create" onClick={createOrder}>
                <FiPlus /> Crear
              </button>
            </div>

            {loading ? (
              <div className="orders-loading">
                Cargando pedidos
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
              </div>
            ) : (
              ["preparación", "terminado"].map((status) =>
                ordersByStatus[status] && (
                  <div key={status} className="status-section">
                    <div className="status-heading">
                      <span className={`status-dot status-dot--${status === "preparación" ? "prep" : "done"}`} />
                      <h2>{status}</h2>
                      <span className="count-badge">{ordersByStatus[status].length}</span>
                    </div>
                    <div className="orders-grid">
                      {ordersByStatus[status].map((o) => (
                        <div key={o.orderId} className="order-card">
                          <div>
                            <p className="order-number">#{o.orderNumber}</p>
                            <p className="order-customer">{o.customerName || "Cliente local"}</p>
                          </div>
                          <div className="order-meta">
                            <span>Entrada: {formatTime(o.createdAt)}</span>
                            {o.status === "preparación" && (
                              <span className="meta-elapsed">
                                <FiClock size={12} /> Hace {elapsed(o.createdAt)}
                              </span>
                            )}
                          </div>
                          {o.status !== "terminado" ? (
                            <button className="btn-deliver" onClick={() => completeOrder(o.orderId)}>
                              Entregar pedido
                            </button>
                          ) : (
                            <div className="status-done-pill">
                              <FiCheck /> Finalizado
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )
            )}
          </>
        )}

        {/* ── Vista Online (Take Away) ───────────────── */}
        {viewMode === "online" && activeModules.online && (
          <>
            {loading ? (
              <div className="orders-loading">
                Buscando pedidos
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
              </div>
            ) : onlineOrders.length === 0 ? (
              <div className="orders-empty">
                <div className="orders-empty-icon"><FiShoppingBag /></div>
                <p>Sin pedidos pendientes por ahora</p>
              </div>
            ) : (
              <div className="online-orders-grid">
                {onlineOrders.map((o) => (
                  <div
                    key={o.id}
                    className={`online-card ${o.status === "preparación" ? "online-card--in-progress" : ""}`}
                  >
                    {/* Cabecera */}
                    <div className="oc-header">
                      <div className="oc-client">
                        <p className="oc-name">{o.customerName}</p>
                        <p className="oc-phone">
                          <FiPhone size={12} /> {o.customerPhone}
                        </p>
                      </div>
                      <div className="oc-total">${o.total}</div>
                    </div>

                    {/* Badges */}
                    <div className="oc-badges">
                      {o.type === "delivery" && (
                        <span className="oc-badge oc-badge--delivery">
                          <FiTruck size={11} /> Delivery — {o.address}
                        </span>
                      )}
                      {o.type === "take-away" && (
                        <span className="oc-badge oc-badge--takeaway">
                          <FiShoppingBag size={11} /> Retira en local
                        </span>
                      )}
                      {o.paymentMethod && (
                        <span className={`oc-badge oc-badge--${o.paymentMethod}`}>
                          {PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod}
                        </span>
                      )}
                    </div>

                    {/* Items */}
                    <div className="oc-items">
                      <div className="oc-items-header">
                        <span>Productos</span>
                        <span className="oc-items-elapsed">
                          <FiClock size={11} /> Hace {elapsed(o.createdAt)}
                        </span>
                      </div>
                      <ul>
                        {o.items.map((item, i) => (
                          <li key={i}>
                            <span className="oc-qty">{item.quantity}</span>
                            {item.name}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Acciones */}
                    <div className="oc-actions">
                      {o.status === "pendiente" || o.status === "esperando_pago" ? (
                        <button className="btn-accept" onClick={() => acceptOnlineOrder(o.id)}>
                          <FiCheck /> Aceptar pedido
                        </button>
                      ) : (
                        <button className="btn-dispatch" onClick={() => completeTakeAwayOrder(o.id, o.customerName)}>
                          {o.type === "delivery" ? <><FiTruck /> Enviar</> : <><FiShoppingBag /> Entregar</>}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
