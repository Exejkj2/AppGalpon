import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Sun, 
  Clock, 
  Package, 
  TrendingUp, 
  Loader2, 
  Tag, 
  DollarSign, 
  AlertCircle,
  Calendar,
  Layers
} from 'lucide-react';

export default function Inicio() {
  const [hora, setHora] = useState(new Date());
  const [ultimosIngresos, setUltimosIngresos] = useState([]);
  const [ultimosAumentos, setUltimosAumentos] = useState([]);
  const [loadingProds, setLoadingProds] = useState(true);
  const [loadingHist, setLoadingHist] = useState(true);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setHora(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Cargar Últimos Ingresos (Historial de Compras)
  useEffect(() => {
    const fetchUltimosIngresos = async () => {
      setLoadingProds(true);
      try {
        const { data: ultimosIngresosData, error } = await supabase
          .from('historial_compras')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error(error);
        }

        setUltimosIngresos(ultimosIngresosData || []);
      } catch (err) {
        console.error('Error al cargar últimos ingresos:', err);
      } finally {
        setLoadingProds(false);
      }
    };

    fetchUltimosIngresos();
  }, []);

  // 2. Cargar Últimas Variaciones y Aumentos de Precios (Historial de Compras)
  useEffect(() => {
    const fetchUltimosAumentos = async () => {
      setLoadingHist(true);
      try {
        const { data, error } = await supabase
          .from('historial_compras')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setUltimosAumentos(data || []);
      } catch (err) {
        console.error('Error al cargar variaciones de precios:', err);
      } finally {
        setLoadingHist(false);
      }
    };

    fetchUltimosAumentos();
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
    <div className="flex flex-col h-[calc(100vh-1rem)] lg:h-[calc(100vh-2rem)] overflow-y-auto lg:overflow-hidden p-2 md:p-3 lg:p-4 space-y-3">
      {/* Saludo Principal (Fijo) */}
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
        <div className="flex items-center justify-between bg-indigo-600 text-white px-4 py-2 md:py-3 rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-indigo-200 capitalize">{fechaFormateada}</p>
            <p className="text-xl md:text-2xl font-bold tracking-tight">{horaFormateada}</p>
          </div>
          <div className="p-2 bg-white/10 rounded-lg">
            <Clock className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
        </div>

        {/* Clima Compacto */}
        <div className="flex items-center justify-between bg-white border border-gray-100 px-4 py-2 md:py-3 rounded-xl shadow-sm">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Aguilares, Tucumán</p>
            <p className="text-sm md:text-base font-bold text-gray-800">22°C | Soleado</p>
          </div>
          <div className="p-2 bg-orange-50 text-orange-500 rounded-lg">
            <Sun className="w-5 h-5 md:w-6 md:h-6 animate-spin-slow" />
          </div>
        </div>
      </div>

      {/* SECCIÓN PRINCIPAL: GRID DE 2 COLUMNAS RESPONSIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 flex-1 min-h-0">
        
        {/* COLUMNA 1: 📦 Últimos Ingresos de Stock */}
        <div className="flex flex-col h-full bg-white rounded-xl border p-3 md:p-4 shadow-sm overflow-hidden">
          <div className="flex-shrink-0 pb-3 border-b border-gray-100 flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs md:text-sm font-extrabold text-slate-800">Últimos Ingresos de Stock</h2>
              <p className="text-[11px] md:text-xs text-slate-500 font-medium">Mercadería recibida recientemente</p>
            </div>
          </div>

          {loadingProds ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 min-h-0">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-gray-500 font-medium">Cargando ingresos recientes...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-3 custom-scrollbar">
              {ultimosIngresos.length === 0 ? (
                <div className="p-8 text-center text-gray-400 font-medium text-xs">
                  No hay ingresos recientes
                </div>
              ) : (
                ultimosIngresos.map((item) => {
                  const cantidad = item.cantidad || 0;
                  const precioCosto = parseFloat(item.precio_costo || item.precioCompra || 0);
                  const fechaObj = item.created_at ? new Date(item.created_at) : null;
                  const fechaTexto = fechaObj ? fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'Reciente';

                  return (
                    <div key={item.id} className="py-3 px-1 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs md:text-sm font-bold text-slate-800 capitalize truncate">{item.nombre_producto || item.nombre}</p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">Fecha: {fechaTexto}</p>
                        </div>
                      </div>

                      <div className="flex items-center ml-auto flex-shrink-0">
                        <span className="w-[70px] md:w-[80px] text-center px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md shadow-sm">
                          +{item.cantidad} u.
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* COLUMNA 2: 📈 Últimas Variaciones y Aumentos de Precios */}
        <div className="flex flex-col h-full bg-white rounded-xl border p-3 md:p-4 shadow-sm overflow-hidden">
          <div className="flex-shrink-0 pb-3 border-b border-gray-100 flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs md:text-sm font-extrabold text-slate-800">Últimas Variaciones y Costos</h2>
              <p className="text-[11px] md:text-xs text-slate-500 font-medium">Control de ingresos de mercadería y precios actualizados</p>
            </div>
          </div>

          {loadingHist ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 min-h-0">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
              <p className="text-xs text-gray-500 font-medium">Cargando variaciones de precios...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-3 custom-scrollbar">
              {ultimosAumentos.length === 0 ? (
                <div className="p-8 text-center text-gray-400 font-medium text-xs">
                  No hay registros de compras recientes
                </div>
              ) : (
                ultimosAumentos.map((item, idx) => {
                  // Precio de venta cargado en la compra actual
                  const pVentaActual = Number(item.precio_venta || item.precioBulto || 0);

                  // Precio de venta que tenía el producto ANTES de esta compra
                  const pVentaAnterior = Number(item.precio_venta_anterior || item.precioBultoAnterior || 0);

                  // Calcular porcentaje. Si no hay precio anterior válido, la variación es 0.
                  const porcentajeCalc = pVentaAnterior > 0 && pVentaActual !== pVentaAnterior
                    ? (((pVentaActual - pVentaAnterior) / pVentaAnterior) * 100).toFixed(1)
                    : 0;

                  const cantidad = parseInt(item.cantidad || 0);
                  const fechaObj = item.created_at ? new Date(item.created_at) : null;
                  const fechaSoloTexto = fechaObj ? fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'Ingreso';
                  const horaTexto = fechaObj ? fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

                  return (
                    <div key={item.id || idx} className="py-3 px-1 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-bold text-slate-800 capitalize truncate">{item.nombre_producto || item.nombre}</p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            {fechaSoloTexto}
                            <span className="hidden md:inline"> {horaTexto} hs</span> (+{cantidad} u.)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 md:gap-2 ml-auto shrink-0">
                        <span className="w-[65px] md:w-[105px] inline-flex justify-center px-1.5 md:px-2.5 py-0.5 md:py-1 text-[11px] md:text-xs font-bold text-indigo-900 bg-indigo-100 rounded-md md:rounded-lg border border-indigo-200">
                          <span className="hidden md:inline me-1">Venta:</span>${pVentaActual.toLocaleString('es-AR')}
                        </span>

                        <div className="w-[60px] md:w-[75px] flex justify-end shrink-0">
                          <span className={`inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] md:text-xs font-bold tracking-tight ${
                            porcentajeCalc > 0 ? 'text-emerald-500' : 
                            porcentajeCalc < 0 ? 'text-rose-500' : 
                            'text-gray-400'
                          }`}>
                            {porcentajeCalc > 0 ? `+${porcentajeCalc}% ⬆` : 
                             porcentajeCalc < 0 ? `${porcentajeCalc}% ⬇` : 
                             '0% -'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
