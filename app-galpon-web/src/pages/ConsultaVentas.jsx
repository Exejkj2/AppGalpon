import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import emailjs from '@emailjs/browser';
import { 
  FileText, 
  Eye, 
  X, 
  Loader2, 
  Calendar, 
  User, 
  DollarSign, 
  ShoppingBag, 
  Search,
  Printer,
  Send,
  Ban,
  Receipt
} from 'lucide-react';

export default function ConsultaVentas() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Venta Seleccionada y Detalle
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [detallesVenta, setDetallesVenta] = useState([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [accionModal, setAccionModal] = useState(null); // 'cancelar' | 'imprimir' | 'reenviar' | null

  // Cargar lista de ventas desde Supabase
  const fetchVentas = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*, clientes(nombreCompleto, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVentas(data || []);
    } catch (err) {
      console.error('Error al cargar ventas:', err);
      setError('No se pudieron cargar las ventas.');
      toast.error('Error al cargar el historial de ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentas();
  }, []);

  // Obtener un número correlativo limpio (#1, #2, #3...)
  const getNumeroCorrelativo = (ventaObj) => {
    if (!ventaObj) return '';
    if (typeof ventaObj.id === 'number' || (!isNaN(ventaObj.id) && !String(ventaObj.id).includes('-'))) {
      return ventaObj.id;
    }
    const indexInVentas = ventas.findIndex((v) => v.id === ventaObj.id);
    if (indexInVentas !== -1) {
      return ventas.length - indexInVentas;
    }
    return 1;
  };

  // Cargar detalles de una venta al hacer clic en la tarjeta
  const handleVerDetalle = async (venta) => {
    setVentaSeleccionada(venta);
    setLoadingDetalles(true);
    setDetallesVenta([]);

    try {
      const { data, error } = await supabase
        .from('venta_detalles')
        .select('*')
        .eq('venta_id', venta.id);

      if (error) throw error;
      setDetallesVenta(data || []);
    } catch (err) {
      console.error('Error cargando detalles de venta:', err);
      toast.error('No se pudo cargar el detalle de la venta');
    } finally {
      setLoadingDetalles(false);
    }
  };

  // Paso 2: Centralizar la Confirmación del Modal Dinámico
  const handleConfirmarAccion = () => {
    if (accionModal === 'cancelar') {
      ejecutarCancelacionVenta();
    } else if (accionModal === 'imprimir') {
      handleImprimirTicketModal();
      setAccionModal(null);
    } else if (accionModal === 'reenviar') {
      handleReenviarMailModal();
      setAccionModal(null);
    }
  };

  // Abrir Modal de Confirmación
  const handleCancelarVenta = () => {
    if (!ventaSeleccionada) return;
    setAccionModal('cancelar');
  };

  // Ejecutar Cancelación de Venta y Devolución de Stock en Supabase
  const ejecutarCancelacionVenta = async () => {
    if (!ventaSeleccionada) return;

    setCargando(true);
    try {
      // 1. Obtenemos los productos de la venta para devolver el stock
      let itemsVendidos = detallesVenta;
      if (!itemsVendidos || itemsVendidos.length === 0) {
        const { data: dData, error: dErr } = await supabase
          .from('venta_detalles')
          .select('*')
          .eq('venta_id', ventaSeleccionada.id);

        if (!dErr && dData) {
          itemsVendidos = dData;
        }
      }

      for (const item of (itemsVendidos || [])) {
        const prodId = item.producto_id || item.productoId || item.id;
        if (!prodId) continue;

        // Obtenemos el stock actual del producto
        const { data: productoActual } = await supabase
          .from('productos')
          .select('stockBultos, stock')
          .eq('id', prodId)
          .single();

        if (productoActual) {
          const stockActualNum = Number(productoActual.stockBultos !== undefined ? productoActual.stockBultos : (productoActual.stock || 0));
          const nuevoStock = stockActualNum + Number(item.cantidad || 0);

          // Sumamos la cantidad vendida de vuelta al stock
          await supabase.from('productos')
            .update({ stockBultos: nuevoStock })
            .eq('id', prodId);
        }
      }

      // 2. Marcar la venta como 'Cancelada' en la base de datos
      const { error: errUpdateVenta } = await supabase
        .from('ventas')
        .update({ estado: 'Cancelada' })
        .eq('id', ventaSeleccionada.id);

      if (errUpdateVenta) throw errUpdateVenta;

      toast.success('Venta cancelada exitosamente y stock restaurado.');

      // 3. Actualizar la interfaz en tiempo real
      const ventaActualizada = { ...ventaSeleccionada, estado: 'Cancelada' };
      setVentaSeleccionada(ventaActualizada);
      setVentas(ventas.map((v) => v.id === ventaSeleccionada.id ? { ...v, estado: 'Cancelada' } : v));
    } catch (error) {
      console.error('Error al cancelar venta:', error);
      toast.error('Hubo un error al cancelar la venta.');
    } finally {
      setCargando(false);
      setAccionModal(null);
    }
  };

  // Imprimir Ticket térmico de 80mm
  const handleImprimirTicketModal = () => {
    if (!ventaSeleccionada) return;
    toast.success('Generando ticket térmico...', { id: 'modal-print-toast' });
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Reenviar por EmailJS
  const handleReenviarMailModal = async () => {
    if (!ventaSeleccionada) return;

    const emailEncargado = 'todogolosinas36@gmail.com';
    const emailCliente = ventaSeleccionada.clientes?.email || '';
    const destinatariosArray = [emailEncargado, emailCliente].filter(Boolean);

    const numCorrelativo = getNumeroCorrelativo(ventaSeleccionada);
    const nombreCliente = ventaSeleccionada.clientes?.nombreCompleto || ventaSeleccionada.clientes?.nombre_completo || 'Consumidor Final';
    const fechaHora = new Date(ventaSeleccionada.created_at).toLocaleString('es-AR');

    let mensajeCompleto = `=================================\n`;
    mensajeCompleto += `     TODO GOLOSINAS - VENTA      \n`;
    mensajeCompleto += `=================================\n`;
    mensajeCompleto += `Ticket N°: ${numCorrelativo}\n`;
    mensajeCompleto += `Fecha y Hora: ${fechaHora}\n`;
    mensajeCompleto += `Cliente: ${nombreCliente}\n`;
    mensajeCompleto += `-------------------------------------------------\n`;

    detallesVenta.forEach((item) => {
      const nombreProd = item.producto_nombre || item.nombre || 'Producto';
      const precioUnit = parseFloat(item.precio_unitario || item.precio || 0);
      mensajeCompleto += `${nombreProd}\n`;
      mensajeCompleto += `Cantidad: ${item.cantidad} un. | P. Unitario: $${precioUnit.toLocaleString('es-AR')} | Subtotal: $${item.subtotal?.toLocaleString('es-AR')}\n`;
    });

    const subtotal = ventaSeleccionada.subtotal || 0;
    const descPorcentaje = ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento || 0;
    const montoDesc = (subtotal * descPorcentaje) / 100;
    const total = ventaSeleccionada.total || 0;

    mensajeCompleto += `-------------------------------------------------\n`;
    mensajeCompleto += `Subtotal General: $${subtotal.toLocaleString('es-AR')}\n`;
    mensajeCompleto += `Descuento Aplicado: ${descPorcentaje}% (-$${montoDesc.toLocaleString('es-AR')})\n`;
    mensajeCompleto += `=================================\n`;
    mensajeCompleto += `TOTAL A PAGAR: $${total.toLocaleString('es-AR')}\n`;
    mensajeCompleto += `=================================\n`;

    const templateParams = {
      to_email: destinatariosArray.join(', '),
      order_id: numCorrelativo,
      ticket_number: numCorrelativo,
      message: mensajeCompleto
    };

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    const isConfigured = serviceId && templateId && publicKey && serviceId !== 'tu_service_id';

    if (isConfigured) {
      toast.loading('Reenviando comprobante por email...', { id: 'modal-email-toast' });
      try {
        const emailPromise = emailjs.send(serviceId, templateId, templateParams, publicKey);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout EmailJS')), 4500)
        );

        await Promise.race([emailPromise, timeoutPromise]);
        toast.success(`Comprobante reenviado a: ${destinatariosArray.join(', ')}`, { id: 'modal-email-toast' });
      } catch (err) {
        console.warn('Error reenviando email:', err);
        toast.error('No se pudo reenviar el comprobante por correo.', { id: 'modal-email-toast' });
      }
    } else {
      toast.error('Configura tus credenciales de EmailJS en el archivo .env', { id: 'modal-email-toast' });
    }
  };

  // Filtrado por cliente, fecha o ID correlativo/UUID
  const ventasFiltradas = ventas.filter((v) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    const nombreCliente = (v.clientes?.nombreCompleto || v.clientes?.nombre_completo || 'Consumidor Final').toLowerCase();
    const fecha = new Date(v.created_at).toLocaleDateString('es-AR').toLowerCase();
    const numCorrelativo = String(getNumeroCorrelativo(v));
    const idReal = String(v.id).toLowerCase();

    return (
      nombreCliente.includes(term) ||
      fecha.includes(term) ||
      numCorrelativo.includes(term) ||
      idReal.includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3.5rem)] overflow-hidden gap-4">
      {/* Estilos CSS de Impresión Térmica (80mm POS) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ticket-impresion-consulta, #ticket-impresion-consulta * {
            visibility: visible !important;
          }
          #ticket-impresion-consulta {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            padding: 4mm !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
          }
        }
      `}</style>

      {/* Ticket Térmico Oculto para Impresión */}
      {ventaSeleccionada && (
        <div id="ticket-impresion-consulta" className="hidden print:block font-mono text-xs text-black">
          <div className="text-center font-bold text-sm uppercase mb-1">
            TODO GOLOSINAS
          </div>
          <div className="text-center text-[10px] mb-2 border-b border-black pb-1">
            Comprobante de Venta #{getNumeroCorrelativo(ventaSeleccionada)}<br />
            {new Date(ventaSeleccionada.created_at).toLocaleString('es-AR')}
          </div>

          <div className="mb-2 text-[11px]">
            <strong>Cliente:</strong> {ventaSeleccionada.clientes?.nombreCompleto || ventaSeleccionada.clientes?.nombre_completo || 'Consumidor Final'}
          </div>

          <div className="border-t border-b border-black py-1 mb-2">
            <div className="flex justify-between font-bold text-[10px] mb-1">
              <span>CANT / ARTÍCULO</span>
              <span>SUBTOTAL</span>
            </div>
            <div className="space-y-1">
              {detallesVenta.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-[11px]">
                  <div className="pr-1">
                    <span>{item.cantidad}x {item.producto_nombre || item.nombre}</span>
                  </div>
                  <span className="font-bold shrink-0">${item.subtotal?.toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 text-right text-[11px] mb-3">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${ventaSeleccionada.subtotal?.toLocaleString('es-AR')}</span>
            </div>

            {(ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento) > 0 && (
              <div className="flex justify-between">
                <span>Descuento ({ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento}%):</span>
                <span>-${(((ventaSeleccionada.subtotal || 0) * (ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento || 0)) / 100).toLocaleString('es-AR')}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
              <span>TOTAL A PAGAR:</span>
              <span>${ventaSeleccionada.total?.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header General */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200 shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Consulta de Ventas</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">Historial completo de transacciones, comprobantes y anulación de ventas</p>
          </div>
        </div>
      </div>

      {/* Estado Carga / Error General */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-gray-100">
          <Loader2 className="w-9 h-9 text-indigo-600 animate-spin" />
          <p className="text-gray-500 font-medium text-xs md:text-sm">Cargando historial de ventas...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs md:text-sm flex items-center gap-2">
          <span>{error}</span>
        </div>
      ) : (
        /* Paso 3: Rediseño de Interfaz (Split Screen) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden items-stretch">
          
          {/* COLUMNA IZQUIERDA: Lista de Ventas (Ocupa 1/3) */}
          <div className="lg:col-span-1 bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
            <div className="border-b border-gray-100 pb-3 mb-3 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm md:text-base font-extrabold text-slate-800 uppercase tracking-wider">
                  Historial ({ventasFiltradas.length})
                </h3>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                  Últimas ventas
                </span>
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente, fecha o N°..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-slate-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Lista Deslazable de Ventas con no-scrollbar */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 no-scrollbar min-h-0">
              {ventasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                  <ShoppingBag className="w-8 h-8 text-gray-300" />
                  <p className="text-xs font-semibold">No se encontraron ventas.</p>
                </div>
              ) : (
                ventasFiltradas.map((v) => {
                  const clienteNombre = v.clientes?.nombreCompleto || v.clientes?.nombre_completo || 'Consumidor Final';
                  const numCorrelativo = getNumeroCorrelativo(v);
                  const isSelected = ventaSeleccionada?.id === v.id;
                  const isCancelada = v.estado === 'Cancelada';

                  return (
                    <div
                      key={v.id}
                      onClick={() => handleVerDetalle(v)}
                      className={`p-3 rounded-xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-600 shadow-sm ring-1 ring-indigo-600/30'
                          : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="overflow-hidden pr-2">
                          <p className="font-bold text-xs text-slate-800 capitalize truncate">{clienteNombre}</p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            Ticket #{numCorrelativo} • {new Date(v.created_at).toLocaleDateString('es-AR')}
                          </p>
                        </div>

                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                          isCancelada 
                            ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          ${v.total?.toLocaleString('es-AR')}
                        </span>
                      </div>

                      {isCancelada && (
                        <span className="inline-block text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md mt-1">
                          🚫 Venta Cancelada
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: Detalle de Venta (Ocupa 2/3) */}
          <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
            {!ventaSeleccionada ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 border-2 border-dashed border-gray-100 rounded-2xl p-8">
                <FileText className="w-12 h-12 text-gray-300" />
                <p className="text-sm font-semibold text-slate-600">Selecciona una venta de la lista</p>
                <p className="text-xs text-gray-400 text-center max-w-xs">
                  Haz clic sobre cualquier ticket de la izquierda para desplegar el detalle completo, productos e imprimir o cancelar la venta.
                </p>
              </div>
            ) : (
              <>
                {/* Encabezado del Detalle */}
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 shrink-0">
                  <div>
                    <h2 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2">
                      Comprobante #{getNumeroCorrelativo(ventaSeleccionada)}
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
                      Cliente: <span className="font-bold text-slate-800 capitalize">
                        {ventaSeleccionada.clientes?.nombreCompleto || ventaSeleccionada.clientes?.nombre_completo || 'Consumidor Final'}
                      </span>
                      <span className="text-gray-400 font-mono ms-2">
                        ({new Date(ventaSeleccionada.created_at).toLocaleString('es-AR')})
                      </span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl md:text-2xl font-black text-indigo-700">
                      ${ventaSeleccionada.total?.toLocaleString('es-AR')}
                    </p>
                    <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                      ventaSeleccionada.estado === 'Cancelada' 
                        ? 'text-rose-700 bg-rose-100 border border-rose-200' 
                        : 'text-emerald-700 bg-emerald-100 border border-emerald-200'
                    }`}>
                      {ventaSeleccionada.estado || 'Completada'}
                    </span>
                  </div>
                </div>

                {/* Lista de Productos Vendidos (Scroll con no-scrollbar) */}
                <div className="flex-1 overflow-y-auto no-scrollbar my-4 min-h-0 border border-gray-100 rounded-xl">
                  {loadingDetalles ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-indigo-600">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-xs text-gray-500 font-medium">Cargando productos de la venta...</span>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-slate-500 uppercase font-bold text-[11px] sticky top-0 z-10">
                          <th className="py-3 px-4">Producto</th>
                          <th className="py-3 px-4 text-center">Cantidad</th>
                          <th className="py-3 px-4 text-right">Precio Un.</th>
                          <th className="py-3 px-4 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detallesVenta.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-gray-400">
                              No hay detalle de artículos para esta venta.
                            </td>
                          </tr>
                        ) : (
                          detallesVenta.map((item, i) => {
                            const nombreProd = item.producto_nombre || item.nombre || 'Producto';
                            const precioUnit = parseFloat(item.precio_unitario || item.precio || 0);

                            return (
                              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-800 capitalize">
                                  {nombreProd}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold rounded-md text-xs border border-indigo-200">
                                    {item.cantidad} u.
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right text-slate-600 font-medium">
                                  ${precioUnit.toLocaleString('es-AR')}
                                </td>
                                <td className="py-3 px-4 text-right font-extrabold text-slate-800">
                                  ${item.subtotal?.toLocaleString('es-AR')}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pie del Detalle y Resumen de Totales */}
                <div className="pt-3 border-t border-gray-100 space-y-3 mt-auto shrink-0">
                  <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-gray-200">
                    <span>Subtotal: <strong>${ventaSeleccionada.subtotal?.toLocaleString('es-AR')}</strong></span>
                    {(ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento) > 0 && (
                      <span className="text-emerald-700 font-bold">
                        Descuento ({ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento}%): -${(((ventaSeleccionada.subtotal || 0) * (ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento || 0)) / 100).toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>

                  {/* Botonera de Acciones */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button 
                      onClick={() => setAccionModal('imprimir')}
                      className="py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-xs"
                    >
                      <Printer className="w-4 h-4 text-gray-600" />
                      <span>🖨️ Imprimir Ticket</span>
                    </button>

                    <button 
                      onClick={() => setAccionModal('reenviar')}
                      className="py-3 px-4 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 text-xs"
                    >
                      <Send className="w-4 h-4 text-indigo-600" />
                      <span>✉️ Reenviar Mail</span>
                    </button>

                    <button 
                      onClick={() => setAccionModal('cancelar')}
                      disabled={ventaSeleccionada.estado === 'Cancelada' || cargando}
                      className={`py-3 px-4 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs shadow-sm ${
                        ventaSeleccionada.estado === 'Cancelada' 
                          ? 'bg-rose-50 text-rose-300 border border-rose-100 cursor-not-allowed' 
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                      }`}
                    >
                      {cargando ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                      <span>{cargando ? 'Cancelando...' : '🚫 Cancelar Venta'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* Modal Dinámico de Confirmación */}
      {accionModal && (
        (() => {
          const config = {
            cancelar: {
              titulo: '¿Cancelar esta venta?',
              mensaje: 'Los artículos regresarán a tu stock. Esta acción no se puede deshacer.',
              icono: '⚠️',
              bgIcono: 'bg-rose-100 text-rose-500',
              bgAlerta: 'bg-rose-50/50 border-rose-100 text-rose-700',
              btnConfirmar: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200',
              textoBtn: 'Sí, Cancelar Venta'
            },
            imprimir: {
              titulo: '¿Imprimir comprobante?',
              mensaje: 'Se preparará el documento del ticket para enviarlo a tu impresora.',
              icono: '🖨️',
              bgIcono: 'bg-indigo-100 text-indigo-500',
              bgAlerta: 'bg-indigo-50/50 border-indigo-100 text-indigo-700',
              btnConfirmar: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200',
              textoBtn: 'Sí, Imprimir'
            },
            reenviar: {
              titulo: '¿Reenviar comprobante?',
              mensaje: 'Se enviará una copia del comprobante de esta venta por correo electrónico.',
              icono: '✉️',
              bgIcono: 'bg-blue-100 text-blue-500',
              bgAlerta: 'bg-blue-50/50 border-blue-100 text-blue-700',
              btnConfirmar: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
              textoBtn: 'Sí, Reenviar'
            }
          }[accionModal];

          if (!config) return null;

          const clienteNombre = ventaSeleccionada?.clientes?.nombreCompleto || ventaSeleccionada?.clientes?.nombre_completo || ventaSeleccionada?.cliente || 'Consumidor Final';

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-150">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-150 border border-gray-100">
                
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-4 mb-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${config.bgIcono}`}>
                      <span className="text-2xl">{config.icono}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-gray-900">{config.titulo}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Ticket de <span className="font-bold text-gray-800">{clienteNombre}</span>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`px-6 py-4 border-y ${config.bgAlerta}`}>
                  <p className="text-sm font-medium text-center">{config.mensaje}</p>
                </div>

                <div className="p-6 flex justify-end gap-3 bg-gray-50">
                  <button
                    onClick={() => setAccionModal(null)}
                    disabled={cargando}
                    className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={handleConfirmarAccion}
                    disabled={cargando}
                    className={`px-5 py-2.5 text-sm font-bold rounded-xl shadow-md transition-colors flex items-center gap-2 ${config.btnConfirmar}`}
                  >
                    {cargando && accionModal === 'cancelar' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <span>{config.textoBtn}</span>
                    )}
                  </button>
                </div>
                
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
