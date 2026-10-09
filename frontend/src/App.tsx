import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Orders from "./pages/Orders/Orders";
import LastQr from "./pages/LastQr";
import MenuAdmin from "./pages/MenuAdmin/MenuAdmin";
import Tienda from "./pages/Tienda/Tienda";
import Checkout from "./pages/Checkout/Checkout";
import SuperAdmin from "./pages/SuperAdmin";
export type LastOrderQR = {
  orderNumber: string;
  whatsappLink: string;
};

export type Order = {
  orderId: string;
  orderNumber: string;
  storeId: string;
  customerName?: string;
  whatsappLink: string;
  status: string;
  createdAt?: string;    
  completedAt?: string; 
};

function App() {
  // 🔥 Leemos el token al instante. Si hay, arranca logueado.
  const [logged, setLogged] = useState(!!localStorage.getItem("token"));

  // 🧹 La función maestra de deslogueo
  const handleLogout = () => {
    localStorage.removeItem("token"); // Borramos la llave vieja/vencida
    setLogged(false); // Le decimos a React que cierre el panel
  };
  
  return (
    <Routes>
      {/* 🌍 RUTAS PÚBLICAS: Cualquiera puede entrar desde su celular */}
      <Route path="/tienda/:storeId" element={<Tienda />} />
      <Route path="/checkout/:storeId" element={<Checkout />} />

      {/* 🔒 RUTAS PRIVADAS: Panel de control del local */}
      {!logged ? (
        // Si NO está logueado, cualquier cosa que escriba lo manda al Login
        <Route path="*" element={<Login onLogin={() => setLogged(true)} />} />
      ) : (
        // Si SÍ está logueado, habilitamos todo el dashboard
        <>
          <Route path="/" element={<Orders onLogout={handleLogout} />} />
          <Route path="/last-qr" element={<LastQr />} />
          <Route path="/menu-admin" element={<MenuAdmin />} />
          <Route path="/ceo-dashboard" element={<SuperAdmin />} />

          {/* Catch-all: redirige al panel principal */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}

export default App;