import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Sparkles, 
  Package, 
  TrendingUp, 
  Loader2, 
  Tag 
} from 'lucide-react';

export default function LoNuevo() {
  const [ultimosIngresos, setUltimosIngresos] = useState([]);
  const [comprasSemana, setComprasSemana] = useState([]);
  const [loadingIngresos, setLoadingIngresos] = useState(true);
  const [loadingAumentos, setLoadingAumentos] = useState(true);

  // Obtener rango de fechas para los últimos 7 días en hora local (convertidos a ISO UTC)
  const getRangoUltimos7Dias = () => {
    const ahora = new Date();
    
    // Hoy a las 23:59:59.999 local
    const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
    
    // Hace 7 días a las 00:00:00.000 local
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 7, 0, 0, 0, 0);

    return {
      inicioIso: inicio.toISOString(),
      finIso: fin.toISOString()
    };
  };

  // 1. Cargar Últimos Ingresos (últimos 7 días)
  useEffect(() => {
    const fetchUltimosIngresos = async () => {
      setLoadingIngresos(true);
      try {
        const { inicioIso, finIso } = getRangoUltimos7Dias();

        const { data, error } = await supabase
          .from('historial_compras')
          .select('*')
          .gte('created_at', inicioIso)
          .lte('created_at', finIso)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error al cargar ingresos:', error);
        }

        setUltimosIngresos(data || []);
      } catch (err) {
        console.error('Error al cargar ingresos:', err);
      } finally {
        setLoadingIngresos(false);
      }
    };

    fetchUltimosIngresos();
  }, []);

  // 2. Cargar compras de la semana para variaciones de precio (ordenadas DESC por created_at)
  useEffect(() => {
    const fetchComprasSemana = async () => {
      setLoadingAumentos(true);
      try {
        const { inicioIso, finIso } = getRangoUltimos7Dias();

        const { data, error } = await supabase
          .from('historial_compras')
          .select('*')
          .gte('created_at', inicioIso)
          .lte('created_at', finIso)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setComprasSemana(data || []);
      } catch (err) {
        console.error('Error al cargar compras de la semana:', err);
      } finally {
        setLoadingAumentos(false);
      }
    };

    fetchComprasSemana();
  }, []);

  // Filtro de Ingresos Reales: Excluye registros donde la cantidad sea 0 o nula
  const ingresosReales = useMemo(() => {
    return (ultimosIngresos || []).filter((item) => Number(item.cantidad || 0) > 0);
  }, [ultimosIngresos]);

  // Algoritmo Anti-Duplicados para Variaciones de Precio (Aumentos y Bajas)
  const variacionesUnicas = useMemo(() => {
    const lista = [];
    const productosProcesados = new Set();

    (comprasSemana || []).forEach((item) => {
      const id = item.producto_id || item.id_producto || item.id;
      if (!id) return;

      // Si el producto no ha sido procesado en este bucle, ESTE es su registro más reciente
      if (!productosProcesados.has(id)) {
        const precioNuevo = Number(item.precio_venta || item.precioBulto || item.precioVenta || 0);
        const precioViejo = Number(item.precio_venta_anterior || item.precioBultoAnterior || item.precioVentaAnterior || 0);

        // Evaluamos si hubo cualquier variación de precio (aumento o baja)
        if (precioViejo > 0 && precioNuevo !== precioViejo) {
          const porcentaje = (((precioNuevo - precioViejo) / precioViejo) * 100).toFixed(1);

          lista.push({
            ...item,
            precio_venta: precioNuevo,
            precio_venta_anterior: precioViejo,
            porcentajeAumento: porcentaje
          });
        }

        // Marcamos el producto como procesado para ignorar modificaciones más viejas en la misma semana
        productosProcesados.add(id);
      }
    });

    return lista;
  }, [comprasSemana]);

  return (
    <div className="h-full w-full p-4 md:p-6 lg:p-8 bg-gray-50 overflow-y-auto space-y-4">
      {/* Header General */}
      <div className="flex items-center justify-between bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Lo Nuevo</h1>
            <p className="text-slate-500 text-xs md:text-sm font-medium">
              Novedades, ingresos y variaciones de precios registrados en los últimos 7 días
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        
        {/* LISTA 1: Últimos Ingresos de la Semana */}
        <div className="flex flex-col bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm space-y-4">
          <div className="pb-3 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-extrabold text-slate-800">Últimos Ingresos de la semana</h2>
              <p className="text-xs text-slate-500 font-medium">Mercadería recibida en los últimos 7 días</p>
            </div>
          </div>

          {loadingIngresos ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-gray-500 font-medium">Cargando ingresos recientes...</p>
            </div>
          ) : ingresosReales.length === 0 ? (
            <div className="p-8 text-center text-gray-400 font-medium text-xs">
              No hay ingresos de mercadería recientes.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 no-scrollbar">
              {ingresosReales.map((item, index) => {
                const cantidad = item.cantidad || 0;
                const fechaObj = item.created_at ? new Date(item.created_at) : null;
                const fechaTexto = fechaObj ? fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'Reciente';

                return (
                  <div key={item.id || index} className="py-3 px-2 hover:bg-slate-50/80 rounded-xl transition-colors flex items-center justify-between gap-3 text-xs border-b border-gray-100/60 last:border-b-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs md:text-sm font-bold text-slate-800 capitalize truncate">
                          {item.nombre_producto || item.nombre || item.producto}
                        </p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">Fecha: {fechaTexto}</p>
                      </div>
                    </div>

                    <div className="flex items-center ml-auto flex-shrink-0">
                      <span className="w-[70px] md:w-[80px] text-center px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md shadow-sm">
                        +{cantidad} u.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LISTA 2: Variaciones de Precio (Últimos 7 días) */}
        <div className="flex flex-col bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm space-y-4">
          <div className="pb-3 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-extrabold text-slate-800">Variaciones de Precio (Últimos 7 días)</h2>
              <p className="text-xs text-slate-500 font-medium">Productos con modificación en el precio de venta</p>
            </div>
          </div>

          {loadingAumentos ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
              <p className="text-xs text-gray-500 font-medium">Cargando variaciones de precio...</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 no-scrollbar">
              {variacionesUnicas.length > 0 ? (
                variacionesUnicas.map((item, index) => {
                  const cantidad = parseInt(item.cantidad || 0);
                  const fechaObj = item.created_at ? new Date(item.created_at) : null;
                  const fechaSoloTexto = fechaObj ? fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '';

                  return (
                    <div
                      key={item.id || index}
                      className="py-3 px-2 hover:bg-slate-50/80 rounded-xl transition-colors flex items-center justify-between gap-2 text-xs border-b border-gray-100/60 last:border-b-0"
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-bold text-slate-800 capitalize truncate">
                            {item.nombre_producto || item.nombre || item.producto}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            Anterior: ${item.precio_venta_anterior.toLocaleString('es-AR')}
                            {fechaSoloTexto && ` • ${fechaSoloTexto}`}
                            {cantidad > 0 && ` (+${cantidad} u.)`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 md:gap-2 ml-auto shrink-0">
                        <span className="w-[65px] md:w-[105px] inline-flex justify-center px-1.5 md:px-2.5 py-0.5 md:py-1 text-[11px] md:text-xs font-bold text-indigo-900 bg-indigo-100 rounded-md md:rounded-lg border border-indigo-200">
                          <span className="hidden md:inline me-1">Venta:</span>${item.precio_venta.toLocaleString('es-AR')}
                        </span>
                        
                        {/* Badge de Porcentaje Dinámico */}
                        {(() => {
                          const esAumento = Number(item.porcentajeAumento) > 0;
                          const signo = esAumento ? '+' : ''; 
                          
                          return (
                            <span className={`w-[65px] text-center px-1.5 py-1 text-xs font-black border rounded-md shadow-sm shrink-0 ${
                              esAumento 
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}>
                              {signo}{item.porcentajeAumento}%
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-gray-500 font-medium">No hubo variaciones de precio esta semana.</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
