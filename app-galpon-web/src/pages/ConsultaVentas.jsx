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
  Tag,
  Printer,
  Send
} from 'lucide-react';

export default function ConsultaVentas() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Detalle de Venta
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [detallesVenta, setDetallesVenta] = useState([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);

  // Cargar lista de ventas
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

  // Función para obtener un número correlativo limpio (#1, #2, #3...)
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

  // Cargar detalles de una venta (usa la clave primaria real de la DB)
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

  const cerrarModalDetalle = () => {
    setVentaSeleccionada(null);
    setDetallesVenta([]);
  };

  // Imprimir Ticket desde el Modal
  const handleImprimirTicketModal = () => {
    if (!ventaSeleccionada) return;
    toast.success('Generando ticket térmico...', { id: 'modal-print-toast' });
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Reenviar por EmailJS desde el Modal
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
    mensajeCompleto += `Vendedor / Caja: Caja Central\n`;
    mensajeCompleto += `-------------------------------------------------\n`;

    detallesVenta.forEach((item) => {
      const nombreProd = item.producto_nombre || item.nombre || 'Producto';
      const precioUnit = parseFloat(item.precio_unitario || item.precio || 0);
      mensajeCompleto += `${nombreProd}\n`;
      mensajeCompleto += `Cantidad: ${item.cantidad} un. | P. Unitario: $${precioUnit.toLocaleString('es-AR')} | Subtotal: $${item.subtotal.toLocaleString('es-AR')}\n`;
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
    mensajeCompleto += `¡Gracias por su compra en Todo Golosinas!`;

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
    const term = searchTerm.toLowerCase();
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
    <div className="flex flex-col gap-6">
      {/* Estilos CSS de Impresión Térmica (80mm POS) para Consulta de Ventas */}
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

      {/* Ticket Térmico Oculto (Impresión desde Modal) */}
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

          <div className="text-center text-[10px] border-t border-dashed border-black pt-2 uppercase">
            ¡Muchas gracias por su compra!<br />
            *** TODO GOLOSINAS ***
          </div>
        </div>
      )}

      {/* Header & Subtítulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Consulta de Ventas</h1>
          <p className="text-slate-500 text-sm mt-1">Historial completo de transacciones y comprobantes registrados</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por cliente, fecha o N° de comprobante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      {/* Estado Carga / Error */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-gray-500 font-medium text-sm">Cargando historial de ventas...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
          {error}
        </div>
      ) : (
        <>
          {/* Tabla de Ventas (Escritorio / Tablet) */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    <th className="px-6 py-4">ID Venta</th>
                    <th className="px-6 py-4">Fecha / Hora</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4 text-center">Descuento</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {ventasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        No se encontraron ventas registradas.
                      </td>
                    </tr>
                  ) : (
                    ventasFiltradas.map((v) => {
                      const clienteNombre = v.clientes?.nombreCompleto || v.clientes?.nombre_completo || 'Consumidor Final';
                      const numCorrelativo = getNumeroCorrelativo(v);
                      const fechaFormateada = new Date(v.created_at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-600">
                            #{numCorrelativo}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                              <span>{fechaFormateada}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800 capitalize">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span>{clienteNombre}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {v.porcentaje_descuento || v.descuento ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {v.porcentaje_descuento || v.descuento}% OFF
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">Sin desc.</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-extrabold text-indigo-700 text-base">
                            ${v.total?.toLocaleString('es-AR')}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleVerDetalle(v)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Ver Detalle</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tarjetas de Ventas (Móvil) */}
          <div className="md:hidden space-y-3">
            {ventasFiltradas.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl text-center text-gray-500 border border-gray-100 shadow-sm">
                No se encontraron ventas registradas.
              </div>
            ) : (
              ventasFiltradas.map((v) => {
                const clienteNombre = v.clientes?.nombreCompleto || v.clientes?.nombre_completo || 'Consumidor Final';
                const numCorrelativo = getNumeroCorrelativo(v);
                const fechaFormateada = new Date(v.created_at).toLocaleString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={v.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="font-mono text-xs font-bold text-indigo-600">Venta #{numCorrelativo}</span>
                      <span className="text-xs text-gray-400">{fechaFormateada}</span>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase">Cliente</p>
                        <p className="font-bold text-slate-800 text-sm capitalize mt-0.5">{clienteNombre}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-400 font-semibold uppercase">Monto Total</p>
                        <p className="font-extrabold text-indigo-700 text-base mt-0.5">${v.total?.toLocaleString('es-AR')}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      {v.porcentaje_descuento || v.descuento ? (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Desc: {v.porcentaje_descuento || v.descuento}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin descuento</span>
                      )}

                      <button
                        onClick={() => handleVerDetalle(v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Ver Detalle</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Modal de Detalle de Venta */}
      {ventaSeleccionada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cerrarModalDetalle}></div>

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="p-5 border-b border-gray-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Detalle de Venta #{getNumeroCorrelativo(ventaSeleccionada)}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Date(ventaSeleccionada.created_at).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>

              <button onClick={cerrarModalDetalle} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Datos del Cliente */}
            <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 shrink-0 flex justify-between items-center text-xs">
              <div>
                <span className="text-gray-500 block uppercase font-semibold text-[10px]">Cliente</span>
                <span className="font-bold text-slate-800 text-sm capitalize">
                  {ventaSeleccionada.clientes?.nombreCompleto || ventaSeleccionada.clientes?.nombre_completo || 'Consumidor Final'}
                </span>
              </div>

              {ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento ? (
                <div className="text-right">
                  <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
                    Descuento: {ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento}%
                  </span>
                </div>
              ) : null}
            </div>

            {/* Lista de Productos Comprados */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                <span>Productos Comprados</span>
              </h4>

              {loadingDetalles ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-xs">Cargando productos del detalle...</span>
                </div>
              ) : detallesVenta.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No se encontraron productos en esta venta.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {detallesVenta.map((det) => {
                    const nombreProd = det.producto_nombre || det.nombre || 'Producto';
                    const precioUnit = parseFloat(det.precio_unitario || det.precio || 0);

                    return (
                      <div key={det.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 capitalize">{nombreProd}</span>
                          <span className="text-xs text-gray-400">
                            Cant: <strong className="text-slate-700">{det.cantidad}</strong> x ${precioUnit.toLocaleString('es-AR')}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-indigo-700">
                            ${det.subtotal?.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pie del Modal: Resumen de Totales y Botones de Acción */}
            <div className="p-5 border-t border-gray-100 bg-slate-50 shrink-0 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Subtotal Parcial:</span>
                <span className="font-bold text-slate-700">${ventaSeleccionada.subtotal?.toLocaleString('es-AR')}</span>
              </div>

              {(ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento) > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-600 font-semibold">
                  <span>Descuento Aplicado ({ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento}%):</span>
                  <span>-${(((ventaSeleccionada.subtotal || 0) * (ventaSeleccionada.porcentaje_descuento || ventaSeleccionada.descuento || 0)) / 100).toLocaleString('es-AR')}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-base pt-2 border-t border-gray-200">
                <span className="font-bold text-slate-800">TOTAL FINAL:</span>
                <span className="text-xl font-extrabold text-indigo-700">${ventaSeleccionada.total?.toLocaleString('es-AR')}</span>
              </div>

              {/* Botones de Acción (Imprimir y Reenviar Mail) */}
              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={handleImprimirTicketModal}
                  className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Ticket</span>
                </button>

                <button
                  onClick={handleReenviarMailModal}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Reenviar por Mail</span>
                </button>
              </div>

              <button
                onClick={cerrarModalDetalle}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
