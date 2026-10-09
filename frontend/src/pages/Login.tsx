import { useState } from "react";
import Swal from "sweetalert2";
import { API_URL } from "../config/settings";
import { FiUser, FiLock, FiArrowRight, FiZap } from "react-icons/fi";

type Props = {
  onLogin: () => void;
};

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const sessionExpired = new URLSearchParams(window.location.search).get("session") === "expired";

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username || !password) {
      return Swal.fire({ icon: "warning", title: "Completá todos los campos", toast: true, position: "top-end", showConfirmButton: false, timer: 2500 });
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        onLogin();
      } else {
        Swal.fire({ icon: "error", title: "Acceso denegado", text: data.error || "Credenciales incorrectas", confirmButtonColor: "#0f172a" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Sin conexión", text: "No se pudo conectar con el servidor" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Panel izquierdo — branding */}
      <div className="login-brand-panel">
        <div className="login-brand-inner">
          <div className="login-logo">
            <FiZap />
          </div>
          <h1 className="login-brand-name">NottyPers</h1>
          <p className="login-brand-tagline">
            Gestioná tu local, pedidos y menú desde un solo lugar.
          </p>
          <ul className="login-feature-list">
            <li><span className="feat-dot" />Beeper digital en tiempo real</li>
            <li><span className="feat-dot" />Take Away y Delivery online</li>
            <li><span className="feat-dot" />Catálogo digital para clientes</li>
          </ul>
        </div>
        <p className="login-brand-footer">© 2026 NottyPers</p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-form-panel">
        <div className="login-form-inner">
          <div className="login-form-header">
            <h2>Bienvenido de vuelta</h2>
            <p>Ingresá a tu panel de gestión</p>
          </div>

          {sessionExpired && (
            <div className="login-session-banner">
              Tu sesión expiró. Iniciá sesión de nuevo para conectar MercadoPago.
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="username">Usuario</label>
              <div className="login-input-wrap">
                <FiUser className="login-input-icon" />
                <input
                  id="username"
                  type="text"
                  placeholder="nombre_de_tu_local"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password">Contraseña</label>
              <div className="login-input-wrap">
                <FiLock className="login-input-icon" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className={`login-submit ${loading ? "is-loading" : ""}`}
              disabled={loading}
            >
              {loading ? (
                <span className="login-spinner" />
              ) : (
                <>
                  Ingresar al panel
                  <FiArrowRight />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* ─── Brand panel ─────────────────────────────── */
        .login-brand-panel {
          width: 420px;
          flex-shrink: 0;
          background: #0f172a;
          background-image:
            radial-gradient(at 20% 30%, rgba(99, 102, 241, 0.35) 0, transparent 55%),
            radial-gradient(at 80% 80%, rgba(16, 185, 129, 0.2) 0, transparent 50%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem;
          color: white;
        }

        .login-brand-inner { display: flex; flex-direction: column; }

        .login-logo {
          width: 52px;
          height: 52px;
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: #818cf8;
          margin-bottom: 2rem;
        }

        .login-brand-name {
          font-size: 2.25rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          margin: 0 0 0.75rem;
        }

        .login-brand-tagline {
          color: rgba(255,255,255,0.55);
          font-size: 1rem;
          line-height: 1.6;
          margin: 0 0 2.5rem;
        }

        .login-feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .login-feature-list li {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: rgba(255,255,255,0.7);
          font-size: 0.9rem;
          font-weight: 500;
        }

        .feat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6366f1;
          flex-shrink: 0;
        }

        .login-brand-footer {
          color: rgba(255,255,255,0.2);
          font-size: 0.75rem;
          margin: 0;
        }

        /* ─── Form panel ──────────────────────────────── */
        .login-form-panel {
          flex: 1;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .login-form-inner {
          width: 100%;
          max-width: 380px;
        }

        .login-form-header {
          margin-bottom: 2.5rem;
        }

        .login-form-header h2 {
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.03em;
          margin: 0 0 0.4rem;
        }

        .login-form-header p {
          color: #64748b;
          font-size: 0.95rem;
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .login-field label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .login-input-wrap {
          position: relative;
        }

        .login-input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 1rem;
          pointer-events: none;
        }

        .login-input-wrap input {
          width: 100%;
          padding: 0.875rem 1rem 0.875rem 2.75rem;
          background: white;
          border: 1.5px solid #e2e8f0;
          border-radius: 0.75rem;
          font-size: 0.975rem;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }

        .login-input-wrap input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        .login-input-wrap input::placeholder { color: #cbd5e1; }

        .login-submit {
          margin-top: 0.5rem;
          width: 100%;
          padding: 0.95rem 1.5rem;
          background: #0f172a;
          color: white;
          border: none;
          border-radius: 0.75rem;
          font-size: 0.975rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
        }

        .login-submit:hover:not(:disabled) {
          background: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.3);
        }

        .login-submit:active:not(:disabled) { transform: scale(0.98); }
        .login-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-submit.is-loading { pointer-events: none; }

        .login-spinner {
          width: 20px;
          height: 20px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .login-session-banner {
          background: #fef3c7;
          border: 1.5px solid #f59e0b;
          color: #92400e;
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 1.5rem;
        }

        /* ─── Responsive ─────────────────────────────── */
        @media (max-width: 768px) {
          .login-root { flex-direction: column; }
          .login-brand-panel {
            width: 100%;
            padding: 2rem 1.5rem;
            min-height: auto;
          }
          .login-feature-list { display: none; }
          .login-brand-tagline { display: none; }
          .login-brand-footer { display: none; }
          .login-logo { margin-bottom: 1rem; }
          .login-brand-name { font-size: 1.75rem; margin-bottom: 0; }
          .login-form-panel { padding: 2rem 1.5rem; }
          .login-form-header { margin-bottom: 2rem; }
        }
      `}</style>
    </div>
  );
}
