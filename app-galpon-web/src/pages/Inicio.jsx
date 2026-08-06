import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sun, Clock, Package, Loader2 } from 'lucide-react';

export default function Inicio() {
  const [hora, setHora] = useState(new Date());
  const [ultimosProductos, setUltimosProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setHora(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar últimos 10 productos
  useEffect(() => {
    const fetchUltimos = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('*')
          .order('id', { ascending: false })
          .limit(10);

        if (error) throw error;
        setUltimosProductos(data || []);
      } catch (err) {
        console.error('Error al cargar últimos ingresos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUltimos();
  }, []);

  const horaFormateada = hora.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const fechaFormateada = hora.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">¡Hola! Bienvenido a Todo Golosina</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen del sistema y últimos movimientos</p>
      </div>

      {/* Widgets Superiores (Reloj y Clima) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Widget Reloj */}
        <div className="bg-indigo-600 text-white rounded-2xl p-6 shadow-md flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider capitalize">{fechaFormateada}</p>
            <p className="text-3xl font-extrabold mt-1 font-mono tracking-tight">{horaFormateada}</p>
          </div>
          <div className="bg-indigo-500/50 p-3.5 rounded-2xl">
            <Clock className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Widget Clima */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Estado del Tiempo</p>
            <p className="text-xl font-bold text-slate-800 mt-1">Aguilares, Tucumán</p>
            <p className="text-sm font-semibold text-amber-600 mt-0.5">22°C | Soleado</p>
          </div>
          <div className="bg-amber-50 p-3.5 rounded-2xl text-amber-500">
            <Sun className="w-7 h-7 animate-spin-slow" />
          </div>
        </div>
      </div>

      {/* Tabla de Últimos 10 Ingresos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Últimos 10 artículos ingresados</h2>
            <p className="text-xs text-slate-400">Nuevos productos registrados en el catálogo</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm text-gray-500">Cargando últimos productos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="px-6 py-3.5">Producto</th>
                  <th className="px-6 py-3.5">Precio Bulto</th>
                  <th className="px-6 py-3.5">Stock Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {ultimosProductos.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                      No hay productos registrados aún.
                    </td>
                  </tr>
                ) : (
                  ultimosProductos.map((prod) => (
                    <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-semibold text-slate-800 capitalize">
                        {prod.nombre}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-indigo-700">
                        ${parseFloat(prod.precioBulto || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`font-semibold text-xs px-2.5 py-1 rounded-md ${prod.stockBultos <= 5 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
                          {prod.stockBultos} bultos
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
