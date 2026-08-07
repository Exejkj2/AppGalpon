import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sun, Clock, Loader2 } from 'lucide-react';

export default function Inicio() {
  const [hora, setHora] = useState(new Date());
  
  // Estados de Métricas
  const [totalArticulos, setTotalArticulos] = useState(0);
  const [stockValorizado, setStockValorizado] = useState(0);
  const [ventasSemana, setVentasSemana] = useState(0);
  const [stockBajo, setStockBajo] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setHora(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Paso 1: Cargar datos desde Supabase
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Obtener productos para count total, stock valorizado y alerta de stock bajo
        const { data: productosData, count, error: errProds } = await supabase
          .from('productos')
          .select('*', { count: 'exact' });

        if (!errProds && productosData) {
          // Total de artículos
          setTotalArticulos(count || productosData.length);

          // Stock Valorizado (precio_venta * stock)
          const totalVal = productosData.reduce((acc, p) => {
            const precio = Number(p.precio_venta || p.precioBulto || p.precio || 0);
            const stock = Number(p.stock !== undefined ? p.stock : (p.stockBultos !== undefined ? p.stockBultos : 0));
            return acc + (precio * stock);
          }, 0);
          setStockValorizado(totalVal);

          // Stock Bajo (stock > 0, ordenado ascendente, limit 5)
          const itemsStockBajo = productosData
            .map((p) => ({
              id: p.id,
              nombre: p.nombre || p.descripcion || 'Sin Nombre',
              codigo: p.codigoBarras || p.codigo || 'S/C',
              stock: p.stock !== undefined ? p.stock : (p.stockBultos !== undefined ? p.stockBultos : 0)
            }))
            .filter((p) => p.stock > 0)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 5);

          setStockBajo(itemsStockBajo);
        }

        // 2. Obtener Ventas de los últimos 7 días (ventasSemana)
        const ahora = new Date();
        const hace7dias = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 7, 0, 0, 0, 0);

        const { data: ventasData, error: errVentas } = await supabase
          .from('ventas')
          .select('total, created_at')
          .gte('created_at', hace7dias.toISOString());

        if (!errVentas && ventasData) {
          const suma = ventasData.reduce((acc, v) => acc + Number(v.total || 0), 0);
          setVentasSemana(suma);
        } else {
          setVentasSemana(0);
        }
      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
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
    <div className="flex flex-col h-[calc(100vh-1rem)] lg:h-[calc(100vh-2rem)] overflow-y-auto lg:overflow-hidden p-2 md:p-3 lg:p-4 space-y-3 md:space-y-4 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-purple-50/40 rounded-2xl">
      {/* Saludo Principal */}
      <div className="flex-shrink-0 px-1 transition-all duration-300 hover:translate-x-1">
        <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-indigo-700 via-purple-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
          ¡Hola! Bienvenido a Todo Golosina
        </h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
          Resumen general del negocio y control de mercadería
        </p>
      </div>

      {/* Widgets Superiores (Reloj y Clima - Compactos) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0">
        {/* Reloj Compacto */}
        <div className="flex items-center justify-between bg-indigo-600 text-white px-4 py-2.5 md:py-3 rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-indigo-200 capitalize">{fechaFormateada}</p>
            <p className="text-xl md:text-2xl font-bold tracking-tight">{horaFormateada}</p>
          </div>
          <div className="p-2 bg-white/10 rounded-lg">
            <Clock className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
        </div>

        {/* Clima Compacto */}
        <div className="flex items-center justify-between bg-white/70 backdrop-blur-md border border-white/50 px-4 py-2.5 md:py-3 rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Aguilares, Tucumán</p>
            <p className="text-sm md:text-base font-bold text-gray-800">22°C | Soleado</p>
          </div>
          <div className="p-2 bg-orange-50 text-orange-500 rounded-lg">
            <Sun className="w-5 h-5 md:w-6 md:h-6 animate-spin-slow" />
          </div>
        </div>
      </div>

      {/* Paso 2: Tarjetas de Métricas (KPIs con Glassmorphism) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 flex-shrink-0">
        {/* Tarjeta 1: Total Artículos */}
        <div className="bg-white/60 backdrop-blur-md border border-white/50 shadow-lg rounded-xl p-4 flex flex-col justify-between">
          <p className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-wider">Total en Catálogo</p>
          <p className="text-2xl md:text-3xl font-extrabold text-indigo-900 mt-2">
            {totalArticulos} <span className="text-sm md:text-base font-semibold text-gray-400">ítems</span>
          </p>
        </div>
        
        {/* Tarjeta 2: Stock Valorizado */}
        <div className="bg-white/60 backdrop-blur-md border border-white/50 shadow-lg rounded-xl p-4 flex flex-col justify-between">
          <p className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-wider">Capital Valorizado</p>
          <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 mt-2">
            ${stockValorizado.toLocaleString('es-AR')}
          </p>
        </div>

        {/* Tarjeta 3: Ventas de la Semana */}
        <div className="bg-white/60 backdrop-blur-md border border-white/50 shadow-lg rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <p className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-wider">Ventas (7 Días)</p>
          <p className="text-2xl md:text-3xl font-extrabold text-purple-700 mt-2">
            ${ventasSemana.toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      {/* Paso 3: Panel Inferior (Gráfico + Stock Bajo con Glassmorphism) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 flex-1 min-h-0">
        
        {/* Gráfico de Torta (Ocupa 2/3 del espacio) */}
        <div className="lg:col-span-2 bg-white/60 backdrop-blur-md border border-white/50 shadow-lg rounded-xl p-4 flex flex-col h-full">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex-shrink-0">Distribución de Inventario</h3>
          <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
             <div className="w-40 h-40 rounded-full bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-indigo-500 via-purple-500 to-emerald-400 border-4 border-white shadow-inner flex items-center justify-center">
                <div className="w-24 h-24 bg-white/80 rounded-full backdrop-blur-sm flex items-center justify-center">
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-tight text-center px-1">
                    Inventario
                  </span>
                </div>
             </div>
             <p className="text-xs font-medium text-gray-400 mt-3">Implementar librería de gráficos</p>
          </div>
        </div>

        {/* Alerta de Stock Bajo (Ocupa 1/3 del espacio) */}
        <div className="lg:col-span-1 bg-white/60 backdrop-blur-md border border-white/50 shadow-lg rounded-xl p-4 flex flex-col h-full min-h-[300px]">
          <h3 className="text-sm font-bold pl-1 text-rose-600 uppercase tracking-wider mb-3 flex-shrink-0 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            Reponer Stock
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                <p className="text-xs text-gray-400 font-medium">Verificando stock...</p>
              </div>
            ) : stockBajo.length > 0 ? (
              stockBajo.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-2 md:p-3 bg-white/70 rounded-lg border border-rose-100 shadow-sm hover:bg-white/90 transition-colors">
                  <div className="truncate pr-2">
                    <p className="text-xs md:text-sm font-bold text-gray-800 truncate">{item.nombre}</p>
                    <p className="text-[10px] md:text-xs text-gray-500">Cód: {item.codigo}</p>
                  </div>
                  <div className="flex-shrink-0 px-2 py-1 bg-rose-100 text-rose-700 font-bold text-xs rounded-md">
                    {item.stock} u.
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center mt-10">Stock saludable</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
