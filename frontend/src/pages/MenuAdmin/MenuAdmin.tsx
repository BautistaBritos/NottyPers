import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiExternalLink,
  FiImage,
  FiFolderPlus,
  FiSettings,
  FiZap,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiLink,
  FiMinusCircle,
} from "react-icons/fi";
import "./MenuAdmin.scss";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface CustomJwtPayload { storeId: string; username: string; }
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string; 
}

export default function MenuAdmin() {
  const navigate = useNavigate();
  
  // Estados de Formulario
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  
  // Estados de Datos de la DB
  const [categorias, setCategorias] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeId, setStoreId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // MercadoPago OAuth
  const [mpConnected, setMpConnected] = useState(false);
  const [mpEmail, setMpEmail] = useState<string | null>(null);
  const [mpExpiresAt, setMpExpiresAt] = useState<string | null>(null);
  const [mpLoading, setMpLoading] = useState(false);

  // 1. Cargar datos iniciales
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode<CustomJwtPayload>(token);
        setStoreId(decoded.storeId);
        fetchMenu(decoded.storeId);
        fetchCategorias(decoded.storeId);
        fetchMpStatus(token);
      } catch (error) {
        console.error("Token inválido", error);
        navigate("/login");
      }
    } else {
      navigate("/login");
    }

    // Detectar retorno del OAuth de MP
    const params = new URLSearchParams(window.location.search);
    const mpResult = params.get("mp");
    if (mpResult === "success") {
      Swal.fire({ icon: "success", title: "¡MercadoPago conectado!", text: "Ya podés recibir pagos online.", timer: 3000, showConfirmButton: false });
      window.history.replaceState({}, "", "/menu-admin");
    } else if (mpResult === "error") {
      Swal.fire({ icon: "error", title: "Error al conectar MP", text: "Intentá de nuevo o verificá que la app de MP esté configurada." });
      window.history.replaceState({}, "", "/menu-admin");
    }
  }, [navigate]);

  const fetchMenu = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/productos/${id}`);
      if (res.ok) setProducts(await res.json());
    } catch (error) { console.error("Error productos:", error); }
  };

  const fetchCategorias = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/categorias/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCategorias(data);
        if (data.length > 0) setCategory(data[0]);
      }
    } catch (error) { console.error("Error categorías:", error); }
  };

  const fetchMpStatus = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/mp/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMpConnected(data.connected);
        setMpEmail(data.email ?? null);
        setMpExpiresAt(data.expiresAt ?? null);
      }
    } catch {
      // silencioso — no bloquear la carga del panel
    }
  };

  const handleConnectMp = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    // Redirige al backend que genera la URL de MP y hace el redirect
    window.location.href = `${API_URL}/auth/mp/connect?token=${encodeURIComponent(token)}`;
  };

  const handleDisconnectMp = async () => {
    const confirm = await Swal.fire({
      title: "¿Desconectar MercadoPago?",
      text: "Los clientes ya no podrán pagar online con MP hasta que vuelvas a conectarlo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, desconectar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    setMpLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/auth/mp/disconnect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMpConnected(false);
        setMpEmail(null);
        setMpExpiresAt(null);
        Swal.fire({ icon: "success", title: "Desconectado", timer: 1500, showConfirmButton: false });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al desconectar" });
    } finally {
      setMpLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
  if (!category || categorias.length <= 1) return;

  const result = await Swal.fire({
    title: `¿Eliminar "${category}"?`,
    text: "Los productos que tengan esta categoría dejarán de estar agrupados.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  });

  if (result.isConfirmed) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/categorias/${storeId}/${encodeURIComponent(category)}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const nuevasCats = categorias.filter(c => c !== category);
        setCategorias(nuevasCats);
        setCategory(nuevasCats[0] || ""); 
        Swal.fire({ icon: 'success', title: 'Categoría eliminada', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
      } else {
        Swal.fire("Error", "No se pudo eliminar de la base de datos", "error");
      }
    } catch  {
      Swal.fire("Error", "Error de conexión", "error");
    }
  }
  
};

  // 2. Lógica de Categorías (DB)
  const handleAddCategory = async () => {
    const { value: newCat } = await Swal.fire({
      title: 'Nueva Categoría',
      input: 'text',
      inputPlaceholder: 'Ej: Pizzas, Postres...',
      showCancelButton: true,
      confirmButtonColor: "#6366f1",
      inputValidator: (value) => !value ? 'Escribe un nombre' : null
    });

    if (newCat) {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${API_URL}/api/categorias`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ storeId, name: newCat })
        });
        if (res.ok) {
          setCategorias(prev => [...prev, newCat]);
          setCategory(newCat);
          Swal.fire({ icon: 'success', title: 'Guardada', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        }
      } catch (error) { console.error(error); }
    }
  };

  // 3. CRUD de Productos
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem("token");
    const method = editingId ? "PUT" : "POST";
    const endpoint = editingId ? `${API_URL}/api/productos/${editingId}` : `${API_URL}/api/productos`;

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name, description, price: Number(price), imageUrl, category, storeId })
      });

      if (response.ok) {
        Swal.fire({ title: editingId ? "¡Actualizado!" : "¡Creado!", icon: "success", timer: 1500, showConfirmButton: false });
        cancelEdit(); 
        fetchMenu(storeId);
      }
    } catch {
      Swal.fire("Error", "No se pudo conectar con el servidor", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string, productName: string) => {
    const confirm = await Swal.fire({
      title: `¿Borrar ${productName}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Sí, borrar"
    });
    if (confirm.isConfirmed) {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/productos/${productId}`, {
        method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  // =========================================================================
  // 🌟 ESTA ES LA FUNCIÓN NUEVA QUE REEMPLAZA AL VIEJO MERCADO PAGO 
  // =========================================================================
  const handlePaymentSettings = async () => {
    try {
      // 1. Buscamos cómo está configurado ahora
      const resConfig = await fetch(`${API_URL}/auth/payment-settings/${storeId}`);
      const currentConfig = await resConfig.json();

      // 2. Abrimos el modal con checkboxes
      const { value: formValues } = await Swal.fire({
        title: '⚙️ Métodos de Cobro',
        html: `
          <div style="text-align: left; display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="swal-efectivo" ${currentConfig.acceptsEfectivo ? 'checked' : ''} style="width: 20px; height: 20px;" />
              <strong style="font-size: 16px;">💵 Aceptar Efectivo en local</strong>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="swal-transfer" ${currentConfig.acceptsTransferencia ? 'checked' : ''} style="width: 20px; height: 20px;" />
              <strong style="font-size: 16px;">🏦 Aceptar Transferencia</strong>
            </label>
            <input id="swal-alias" class="swal2-input" placeholder="Tu Alias o CBU (Obligatorio si aceptás transferencias)" value="${currentConfig.aliasBancario || ''}" style="margin-top: 0; font-size: 14px;" />
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#0f172a',
        confirmButtonText: 'Guardar Cambios',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const acceptsEfectivo = (document.getElementById('swal-efectivo') as HTMLInputElement).checked;
          const acceptsTransferencia = (document.getElementById('swal-transfer') as HTMLInputElement).checked;
          const aliasBancario = (document.getElementById('swal-alias') as HTMLInputElement).value;

          if (acceptsTransferencia && !aliasBancario) {
            Swal.showValidationMessage('Si aceptás transferencias, tenés que escribir tu Alias o CBU');
            return false;
          }

          return { acceptsEfectivo, acceptsTransferencia, aliasBancario };
        }
      });

      if (formValues) {
        const token = localStorage.getItem("token");
        const payload = { ...formValues };

        const res = await fetch(`${API_URL}/auth/payment-settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) Swal.fire("¡Guardado!", "Tus métodos de cobro fueron actualizados.", "success");
        else Swal.fire("Error", data.error, "error");
      }
    } catch {
      Swal.fire("Error", "No se pudo cargar la configuración", "error");
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description || "");
    setPrice(p.price.toString());
    setImageUrl(p.imageUrl || "");
    setCategory(p.category);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName(""); setDescription(""); setPrice(""); setImageUrl("");
  };

  return (
    <div className="admin-container">
      <div className="admin-content">
        <header className="admin-header-box">
          <div className="header-brand">
            <FiZap className="header-brand-icon" />
            NottyPers
          </div>
          <div className="header-flex">
            <div className="header-text">
              <h1>Gestión de Menú</h1>
              <p>Personalizá tus productos y categorías</p>
            </div>
            <div className="header-actions">
              <button onClick={handlePaymentSettings} className="btn-header btn-header--settings">
                <FiSettings /> Cobros
              </button>
              <button onClick={() => navigate("/")} className="btn-header btn-header--exit">
                <FiArrowLeft /> Salir
              </button>
            </div>
          </div>
        </header>

        <div className="admin-grid">
          <aside className="form-sidebar">
            <div className={`form-card ${editingId ? 'is-editing' : ''}`}>
              <div className="form-header">
                <h2>{editingId ? "Editar Ítem" : "Nuevo Ítem"}</h2>
                {editingId && <button onClick={cancelEdit} className="btn-close-edit"><FiX /></button>}
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Categoría</label>
                  <div className="category-input-group">
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-input">
                      {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button type="button" onClick={handleAddCategory} className="btn-add-cat" title="Nueva Categoría"><FiFolderPlus /></button>
                    <button type="button" onClick={handleDeleteCategory} className="btn-del-cat" title="Borrar Categoría" disabled={categorias.length <= 1}><FiTrash2 /></button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Nombre del Producto</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="form-input" placeholder="Ej: Bacon Burger" />
                </div>
                
                <div className="form-group">
                  <label>Precio ($)</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required className="form-input" placeholder="0.00" />
                </div>

                <div className="form-group">
                  <label>Descripción (Opcional)</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="form-input" placeholder="Ingredientes, tamaño..." />
                </div>
                
                <div className="form-group">
                  <label>URL de Imagen</label>
                  <div className="input-with-icon">
                    <FiImage className="input-icon" />
                    <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="form-input" placeholder="https://mi-imagen.jpg" />
                  </div>
                </div>
                
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading ? "Procesando..." : (editingId ? "Guardar Cambios" : "Agregar al Menú")}
                </button>
              </form>
            </div>
          </aside>

          <main className="catalog-section">
            <div className="catalog-header">
              <div className="catalog-info">
                <h2>Catálogo Activo</h2>
                <span className="badge">{products.length} Productos</span>
              </div>
              <a href={`/tienda/${storeId}`} target="_blank" rel="noreferrer" className="link-store">
                Ver Tienda <FiExternalLink />
              </a>
            </div>
            
            <div className="product-grid">
              {products.length === 0 ? (
                <div className="empty-catalog">Todavía no tienes productos. ¡Crea el primero!</div>
              ) : (
                products.map((p) => (
                  <div key={p.id} className={`product-card-item ${editingId === p.id ? 'active-edit' : ''}`}>
                    <div className="img-container">
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <div className="placeholder"><FiImage /></div>}
                      <span className="cat-tag">{p.category}</span>
                    </div>
                    <div className="info">
                      <div className="main-info">
                        <h3>{p.name}</h3>
                        <span className="price">${p.price}</span>
                      </div>
                      <div className="actions">
                        <button onClick={() => startEdit(p)} className="btn-edit-small"><FiEdit2 /> Editar</button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="btn-delete-small"><FiTrash2 /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
        </div>

        {/* ── Sección MercadoPago ─────────────────────── */}
        <section className="mp-section">
          <div className="mp-section-header">
            <div className="mp-section-title">
              <div className="mp-logo-icon">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
                  <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4z" fill="#009EE3"/>
                  <path d="M32.5 18.5c0 4.694-3.806 8.5-8.5 8.5s-8.5-3.806-8.5-8.5S19.306 10 24 10s8.5 3.806 8.5 8.5z" fill="#fff"/>
                </svg>
              </div>
              <div>
                <h3>MercadoPago</h3>
                <p>Recibí pagos online directamente en tu cuenta</p>
              </div>
            </div>

            {mpConnected ? (
              <div className="mp-connected-badge">
                <FiCheckCircle /> Conectado
              </div>
            ) : (
              <div className="mp-disconnected-badge">
                <FiAlertCircle /> No conectado
              </div>
            )}
          </div>

          {mpConnected ? (
            <div className="mp-account-info">
              <div className="mp-account-details">
                <span className="mp-account-label">Cuenta vinculada</span>
                <span className="mp-account-email">{mpEmail ?? "Cuenta de MercadoPago"}</span>
                {mpExpiresAt && (
                  <span className="mp-account-expiry">
                    Token válido hasta: {new Date(mpExpiresAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
              <button
                className="mp-btn mp-btn--disconnect"
                onClick={handleDisconnectMp}
                disabled={mpLoading}
              >
                <FiMinusCircle /> Desconectar
              </button>
            </div>
          ) : (
            <div className="mp-connect-prompt">
              <p>Conectá tu cuenta de MercadoPago para que los clientes puedan pagarte online al hacer pedidos. El dinero va directo a tu cuenta.</p>
              <button className="mp-btn mp-btn--connect" onClick={handleConnectMp}>
                <FiLink /> Conectar MercadoPago
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}