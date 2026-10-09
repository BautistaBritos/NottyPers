import { useState, useEffect, useCallback } from "react";import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface Store {
    storeId: string;
    modules: {
        enableMenu: boolean;
        enableLocal: boolean;
        enableTakeaway: boolean;
    };
    createdAt?: string;
}

export default function SuperAdmin() {
    const navigate = useNavigate();
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminKey, setAdminKey] = useState("");

    const fetchStores = useCallback(async (key: string) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/stores`, {
                headers: { "x-admin-key": key }
            });

            if (res.status === 403) {
                Swal.fire("Acceso Denegado", "Clave de CEO incorrecta", "error");
                navigate("/");
                return;
            }

            const data = await res.json();
            if (data.success) {
                setStores(data.data);
            }
        } catch {
            Swal.fire("Error", "No se pudieron cargar los locales", "error");
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        const pass = prompt("Acceso Restringido. Ingrese clave de CEO:");
        if (!pass) { 
            navigate("/");
            return;
        }
        setAdminKey(pass);
        fetchStores(pass);
    }, [navigate, fetchStores]);

    const toggleModule = async (storeId: string, moduleType: keyof Store['modules'], currentValue: boolean) => {
        const store = stores.find(s => s.storeId === storeId);
        if (!store) return;

        const updatedModules = {
            ...store.modules,
            [moduleType]: !currentValue
        };

        // Cambiamos en pantalla al instante (Optimistic UI)
        setStores(prev => prev.map(s => s.storeId === storeId ? { ...s, modules: updatedModules } : s));

        try {
            const res = await fetch(`${API_URL}/api/admin/stores/${storeId}/modules`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    // 🌟 NUEVO: Mandamos la llave para que nos dejen editar
                    "x-admin-key": adminKey 
                },
                body: JSON.stringify(updatedModules)
            });

            if (!res.ok) throw new Error("Fallo en servidor");
            
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Licencias de ${storeId} actualizadas`, timer: 1500, showConfirmButton: false });
        } catch  {
            // Si algo falla, recargamos la data real
            fetchStores(adminKey);
            Swal.fire("Error", "No se pudo actualizar el permiso en la base de datos", "error");
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-900 flex justify-center items-center text-white font-bold text-2xl">Verificando credenciales...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight">NottyPers <span className="text-blue-500">CEO</span></h1>
                        <p className="text-slate-400 mt-2">Gestión global de licencias y módulos</p>
                    </div>
                    <div className="bg-slate-800 px-4 py-2 rounded-xl text-blue-400 font-bold border border-slate-700">
                        {stores.length} Locales Activos
                    </div>
                </header>

                <div className="grid gap-4">
                    {stores.map((store) => (
                        <div key={store.storeId} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col lg:flex-row justify-between items-center gap-6 hover:border-slate-600 transition-colors">
                            
                            <div className="flex-1 w-full text-center lg:text-left">
                                <h2 className="text-2xl font-black text-white capitalize">{store.storeId}</h2>
                                <p className="text-xs text-slate-400 mt-1 font-mono">
                                    Registrado: {store.createdAt ? new Date(store.createdAt).toLocaleDateString() : 'Antiguo'}
                                </p>
                            </div>

                            <div className="flex flex-wrap justify-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 w-full lg:w-auto">
                                
                                {/* Switch Catálogo */}
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <span className={`font-bold text-sm w-24 text-right ${store.modules.enableMenu ? 'text-amber-400' : 'text-slate-500'}`}>🍔 Catálogo</span>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${store.modules.enableMenu ? 'bg-amber-500' : 'bg-slate-700'}`}>
                                        <div onClick={() => toggleModule(store.storeId, 'enableMenu', store.modules.enableMenu)} 
                                             className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${store.modules.enableMenu ? 'translate-x-6' : 'translate-x-0'}`}>
                                        </div>
                                    </div>
                                </label>

                                <div className="hidden lg:block w-px bg-slate-700"></div>

                                {/* Switch Local (QR) */}
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <span className={`font-bold text-sm w-24 text-right ${store.modules.enableLocal ? 'text-emerald-400' : 'text-slate-500'}`}>🏪 Beeper QR</span>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${store.modules.enableLocal ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                        <div onClick={() => toggleModule(store.storeId, 'enableLocal', store.modules.enableLocal)} 
                                             className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${store.modules.enableLocal ? 'translate-x-6' : 'translate-x-0'}`}>
                                        </div>
                                    </div>
                                </label>

                                <div className="hidden lg:block w-px bg-slate-700"></div>

                                {/* Switch Take Away */}
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <span className={`font-bold text-sm w-24 text-right ${store.modules.enableTakeaway ? 'text-blue-400' : 'text-slate-500'}`}>🛵 Take Away</span>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${store.modules.enableTakeaway ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                        <div onClick={() => toggleModule(store.storeId, 'enableTakeaway', store.modules.enableTakeaway)} 
                                             className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${store.modules.enableTakeaway ? 'translate-x-6' : 'translate-x-0'}`}>
                                        </div>
                                    </div>
                                </label>

                            </div>
                            
                            <a href={`/tienda/${store.storeId}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm text-center w-full lg:w-auto">
                                Ver Tienda ↗
                            </a>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}