import QRCode from "react-qr-code";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { API_URL } from "../config/settings";

type LastOrderQR = {
  orderNumber: string;
  whatsappLink: string;
};

export default function LastQr() {
  const navigate = useNavigate();
  const [lastQR, setLastQR] = useState<LastOrderQR | null>(null);

  useEffect(() => {
    const fetchLastQR = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/orders/last`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.status === 204) return;

        const data = await res.json();
        setLastQR(data);
      } catch (err) {
        console.error("Error fetching last QR", err);
      }
    };

    fetchLastQR(); // inmediato
    const interval = setInterval(fetchLastQR, 3000); // polling cada 3s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 text-blue-600 hover:underline"
      >
        ← Volver
      </button>

      {!lastQR ? (
        <p className="text-gray-500">No hay pedidos todavía</p>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-4">
            Pedido #{lastQR.orderNumber}
          </h1>

          <div className="bg-white p-6 rounded-2xl shadow">
            <QRCode value={lastQR.whatsappLink} size={280} />
          </div>
        </>
      )}
    </div>
  );
}