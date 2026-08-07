import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  FileText, 
  Calendar, 
  Clock, 
  Package, 
  Loader2, 
  AlertCircle, 
  TrendingUp,
  Search,
  ChevronRight,
  ShoppingCart,
  DollarSign,
  Tag,
  ArrowLeft
} from 'lucide-react';

export default function HistorialCompras() {
  const [historialRaw, setHistorialRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const getFechaLocalHoy = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [fechaSeleccionada, setFechaSeleccionada] = useState(getFechaLocalHoy);
  const [searchTerm, setSearchTerm] = useState('');
  const [loteSeleccionadoId, setLoteSeleccionadoId] = useState(null);

  // Cargar registros desde Supabase
  const fetchHistorial = async () => {
    setLoading(true);
    setError(null);
    try {
      const [year, month, day] = fechaSeleccionada.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

      const { data, error } = await supabase
        .from('historial_compras')
        .select('*')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: consulta general por si no hay filtro de timezone ISO
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('historial_compras')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(150);

        if (fallbackError) throw fallbackError;

        const filtradosLocal = (fallbackData || []).filter((item) => {
          if (!item.created_at) return false;
          const itemDate = new Date(item.created_at);
          return itemDate >= startOfDay && itemDate <= endOfDay;
        });

        setHistorialRaw(filtradosLocal);
      } else {
        setHistorialRaw(data || []);
      }
    } catch (err) {
      console.error('Error al cargar historial de compras:', err);
      setError('No se pudo cargar el historial de compras.');
      toast.error('Error al consultar el historial de ingresos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, [fechaSeleccionada]);

  // Agrupar registros por Lote (compras realizadas en la misma ventana de tiempo de 2 minutos)
  const lotesAgrupados = useMemo(() => {
    if (!historialRaw || historialRaw.length === 0) return [];

    const term = searchTerm.toLowerCase().trim();
    const filtrados = historialRaw.filter((item) => {
      if (!term) return true;
      const nombre = (item.nombre_producto || item.nombre || '').toLowerCase();
      return nombre.includes(term);
    });

    const grupos = [];

    filtrados.forEach((item) => {
      const fechaObj = new Date(item.created_at || Date.now());
      const timeMs = fechaObj.getTime();

      let loteExistente = grupos.find(
        (g) => Math.abs(g.timestampMs - timeMs) <= 120000
      );

      const costo = parseFloat(item.precio_costo || item.precioCompra || 0);
      const cantidad = parseInt(item.cantidad || 0);
      const subtotal = cantidad * costo;

      const itemFormateado = {
        ...item,
        costo,
        venta: parseFloat(item.precio_venta || item.precioBulto || 0),
        cantidad,
        subtotal
      };

      if (loteExistente) {
        loteExistente.items.push(itemFormateado);
        loteExistente.cantTotal += cantidad;
        loteExistente.totalMonto += subtotal;
      } else {
        const id_lote = item.id || `lote-${timeMs}`;
        grupos.push({
          id_lote,
          timestampMs: timeMs,
          created_at: item.created_at,
          hora: fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          fecha: fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          items: [itemFormateado],
          cantTotal: cantidad,
          totalMonto: subtotal
        });
      }
    });

    return grupos;
  }, [historialRaw, searchTerm]);

  // Seleccionar el primer lote por defecto solo en escritorio si no hay selección
  useEffect(() => {
    if (window.innerWidth >= 1024 && lotesAgrupados.length > 0 && !loteSeleccionadoId) {
      setLoteSeleccionadoId(lotesAgrupados[0].id_lote);
    } else if (lotesAgrupados.length === 0) {
      setLoteSeleccionadoId(null);
    }
  }, [lotesAgrupados]);

  // Lote seleccionado actualmente
  const loteSeleccionado = useMemo(() => {
    return lotesAgrupados.find((l) => l.id_lote === loteSeleccionadoId) || null;
  }, [lotesAgrupados, loteSeleccionadoId]);

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3.5rem)] overflow-hidden max-w-full overflow-x-hidden gap-3 md:gap-4 p-2 md:p-0">
      {/* Header General */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 md:p-5 rounded-2xl shadow-sm border border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200 shrink-0">
            <FileText className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight">Historial de Compras</h1>
            <p className="text-slate-500 text-[11px] md:text-sm font-medium">Inspección de lotes de ingreso y variación de precios</p>
          </div>
        </div>

        {/* Filtros: Fecha y Buscador */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-bold uppercase text-slate-600">Fecha:</span>
            <input
              type="date"
              value={fechaSeleccionada}
              onChange={(e) => {
                setFechaSeleccionada(e.target.value);
                setLoteSeleccionadoId(null);
              }}
              className="bg-white border border-gray-200 text-slate-800 text-xs font-bold px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            />
          </div>

          <div className="relative flex-1 sm:flex-none min-w-[160px] md:min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filtrar por golosina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Estado Carga / Error */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-gray-100">
          <Loader2 className="w-9 h-9 text-indigo-600 animate-spin" />
          <p className="text-gray-500 font-medium text-xs md:text-sm">Cargando compras de la fecha...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs md:text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        /* LAYOUT DE 2 COLUMNAS / VISTA APILADA RESPONSIVA EN CELULARES */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden items-stretch">
          
          {/* COLUMNA IZQUIERDA: Lista de Lotes de Compra (Visible en desktop o en mobile si NO hay lote seleccionado) */}
          <div className={`lg:col-span-5 bg-white p-3.5 md:p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full min-h-0 overflow-hidden ${loteSeleccionadoId ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Lotes de Ingreso ({lotesAgrupados.length})
              </span>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                {new Date(`${fechaSeleccionada}T00:00:00`).toLocaleDateString('es-AR')}
              </span>
            </div>

            {lotesAgrupados.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-400 gap-3 border-2 border-dashed border-gray-100 rounded-xl">
                <ShoppingCart className="w-8 h-8 text-gray-300" />
                <p className="text-xs font-semibold text-center max-w-xs">
                  No hay compras registradas para esta fecha.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5 pr-1">
                {lotesAgrupados.map((lote) => {
                  const isSelected = lote.id_lote === loteSeleccionadoId;

                  return (
                    <div
                      key={lote.id_lote}
                      onClick={() => setLoteSeleccionadoId(lote.id_lote)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-600 shadow-sm ring-1 ring-indigo-600/30'
                          : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`} />
                          <span className="font-mono text-xs font-extrabold text-slate-800">{lote.hora} hs</span>
                        </div>

                        <span className="text-[10px] md:text-[11px] font-bold text-slate-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {lote.items.length} {lote.items.length === 1 ? 'producto' : 'productos'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100/60">
                        <span className="text-gray-500 font-medium text-[11px]">Cant: <strong>{lote.cantTotal} u.</strong></span>
                        <div className="flex items-center gap-1">
                          <span className="font-black text-indigo-700 text-xs md:text-sm">
                            ${lote.totalMonto.toLocaleString('es-AR')}
                          </span>
                          <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-gray-300'}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: Detalle de Artículos del Lote (Visible en desktop o en mobile SI hay lote seleccionado) */}
          <div className={`lg:col-span-7 bg-white p-3.5 md:p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full min-h-0 overflow-hidden ${!loteSeleccionadoId ? 'hidden lg:flex' : 'flex'}`}>
            {!loteSeleccionado ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-400 gap-3 border-2 border-dashed border-gray-100 rounded-xl min-h-0">
                <Package className="w-12 h-12 text-gray-300" />
                <p className="text-sm font-semibold text-slate-600">Selecciona un lote de la izquierda</p>
                <p className="text-xs text-gray-400 text-center max-w-xs">
                  Haz clic sobre cualquier tarjeta de compra para desplegar la lista completa de artículos y la variación de precios.
                </p>
              </div>
            ) : (
              <>
                {/* Botón Volver (Solo Móvil < lg) */}
                <button
                  onClick={() => setLoteSeleccionadoId(null)}
                  className="lg:hidden flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors mb-3 shrink-0 self-start"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>← Volver a la lista de Lotes</span>
                </button>

                {/* Header del Lote Seleccionado */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
                      <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
                        Detalle del Lote
                        <span className="text-xs font-semibold text-gray-500 font-mono">({loteSeleccionado.hora} hs)</span>
                      </h2>
                      <p className="text-[11px] md:text-xs text-slate-500 font-medium">
                        {loteSeleccionado.items.length} ítems en este registro
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total del Lote</span>
                    <span className="text-base md:text-xl font-black text-indigo-700">
                      ${loteSeleccionado.totalMonto.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                {/* RENDERIZADO HÍBRIDO (Tabla en Desktop/Tablet - List Group en Celulares) */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                  {/* Vista Desktop / Tablet (hidden md:block) */}
                  <div className="hidden md:block border border-gray-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[11px] uppercase tracking-wider text-slate-500 font-bold sticky top-0 z-10">
                          <th className="px-4 py-3">Producto</th>
                          <th className="px-4 py-3 text-center">Cantidad</th>
                          <th className="px-4 py-3 text-right">P. Costo</th>
                          <th className="px-4 py-3 text-right">P. Venta</th>
                          <th className="px-4 py-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {loteSeleccionado.items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-800 capitalize">
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>{item.nombre_producto || item.nombre || 'Producto'}</span>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded-lg text-xs border border-emerald-200">
                                +{item.cantidad} u.
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-extrabold border border-amber-200 px-2 py-0.5 rounded-lg text-xs">
                                <Tag className="w-3 h-3 text-amber-600" />
                                ${item.costo.toLocaleString('es-AR')}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-200 px-2 py-0.5 rounded-lg text-xs">
                                <DollarSign className="w-3 h-3 text-indigo-600" />
                                ${item.venta.toLocaleString('es-AR')}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right font-black text-slate-800">
                              ${item.subtotal.toLocaleString('es-AR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista Celulares (block md:hidden) - Tarjetas tipo List Group */}
                  <div className="block md:hidden space-y-2.5">
                    {loteSeleccionado.items.map((item, idx) => (
                      <div key={item.id || idx} className="p-3 bg-gray-50/80 border border-gray-200/80 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-800 capitalize text-xs truncate">
                            {item.nombre_producto || item.nombre || 'Producto'}
                          </p>
                          <span className="font-black text-indigo-700 text-xs shrink-0">
                            ${item.subtotal.toLocaleString('es-AR')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 text-[11px] flex-wrap pt-1.5 border-t border-gray-200/60">
                          <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded-md border border-emerald-200">
                            +{item.cantidad} u.
                          </span>

                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-extrabold border border-amber-200 px-2 py-0.5 rounded-md">
                            Costo: ${item.costo.toLocaleString('es-AR')}
                          </span>

                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-200 px-2 py-0.5 rounded-md">
                            Venta: ${item.venta.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pie del Detalle */}
                <div className="pt-2.5 mt-2.5 border-t border-gray-100 flex items-center justify-between text-xs shrink-0">
                  <span className="text-gray-500 font-medium text-[11px]">
                    Total Unidades: <strong>{loteSeleccionado.cantTotal} u.</strong>
                  </span>
                  <span className="text-slate-700 font-bold text-[11px]">
                    Supabase Guardado
                  </span>
                </div>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
