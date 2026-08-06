import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import emailjs from '@emailjs/browser';

import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Search, 
  User, 
  Printer, 
  Send, 
  CheckCircle2, 
  X, 
  Loader2, 
  Package, 
  Minus,
  ArrowLeft,
  Pencil,
  AlertCircle,
  ChevronRight,
  Check
} from 'lucide-react';

export default function Ventas() {
  // Estado Principal
  const [carrito, setCarrito] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [descuento, setDescuento] = useState(0);

  // Estado Vista Móvil & Modales
  const [verCarritoMobile, setVerCarritoMobile] = useState(false);
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [itemAModificarMobile, setItemAModificarMobile] = useState(null);
  const [nuevaCantidadMobile, setNuevaCantidadMobile] = useState(1);
  const [itemAEliminarMobile, setItemAEliminarMobile] = useState(null);

  // Estado Datos Ticket Térmico Impresión & Correlativo
  const [datosTicketImpresion, setDatosTicketImpresion] = useState(null);
  const [siguienteNumeroVenta, setSiguienteNumeroVenta] = useState(1);

  // Modal Búsqueda Productos
  const [modalSearchOpen, setModalSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [productosBusqueda, setProductosBusqueda] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [productoAConstruir, setProductoAConstruir] = useState(null);
  const [cantidadInput, setCantidadInput] = useState(1);

  // Ref para Foco Rápido en el Input de Cantidad
  const cantidadInputRef = useRef(null);

  // Autofocus y Selección Automática (.select()) para el modal de Ingresar Cantidad
  useEffect(() => {
    if (productoAConstruir && cantidadInputRef.current) {
      const timer = setTimeout(() => {
        cantidadInputRef.current?.focus();
        cantidadInputRef.current?.select();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [productoAConstruir]);

  // Modal Checkout
  const [modalCheckoutOpen, setModalCheckoutOpen] = useState(false);
  const [isSubmittingVenta, setIsSubmittingVenta] = useState(false);

  // Carga Inicial de Clientes y Próximo Número Correlativo
  const fetchProximoNumero = async () => {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setSiguienteNumeroVenta((data[0].id || 0) + 1);
      } else {
        setSiguienteNumeroVenta(1);
      }
    } catch (err) {
      console.error('Error calculando correlativo:', err);
    }
  };

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          setClientes(data);
        }
      } catch (err) {
        console.error('Error cargando clientes:', err);
      }
    };
    fetchClientes();
    fetchProximoNumero();
  }, []);

  // Foco automático en el input de cantidad al abrir el modal de producto
  useEffect(() => {
    if (productoAConstruir && cantidadInputRef.current) {
      const timer = setTimeout(() => {
        cantidadInputRef.current?.focus();
        cantidadInputRef.current?.select();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [productoAConstruir]);

  // Búsqueda de Productos en Servidor
  useEffect(() => {
    if (!modalSearchOpen) return;

    const searchHandler = setTimeout(async () => {
      const term = searchTerm.trim();
      setLoadingSearch(true);
      try {
        let query = supabase.from('productos').select('*').order('nombre', { ascending: true }).limit(20);
        
        if (term) {
          const isBarcode = /^[0-9]{8,14}$/.test(term);
          if (isBarcode) {
            query = query.eq('codigoBarras', term);
          } else {
            query = query.ilike('nombre', `%${term}%`);
          }
        }

        const { data, error } = await query;
        if (error) throw error;
        setProductosBusqueda(data || []);
      } catch (err) {
        console.error('Error buscando productos:', err);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);

    return () => clearTimeout(searchHandler);
  }, [searchTerm, modalSearchOpen]);

  // Cálculos de Totales
  const subtotalCarrito = carrito.reduce((acc, item) => acc + item.subtotal, 0);
  const porcentajeDescuento = Math.min(Math.max(Number(descuento) || 0, 0), 20);
  const montoDescuento = (subtotalCarrito * porcentajeDescuento) / 100;
  const totalFinal = subtotalCarrito - montoDescuento;

  // Objeto del Cliente Seleccionado
  const clienteObjeto = clientes.find((c) => String(c.id) === String(clienteSeleccionado));

  // Manejo del Carrito
  const handleAgregarAlCarrito = (producto, cantidadNum) => {
    const cant = Math.max(parseInt(cantidadNum) || 1, 1);
    const precio = parseFloat(producto.precioBulto || producto.precio || 0);

    setCarrito((prev) => {
      const index = prev.findIndex((item) => item.producto.id === producto.id);
      if (index >= 0) {
        const copy = [...prev];
        const nuevaCant = copy[index].cantidad + cant;
        copy[index] = {
          ...copy[index],
          cantidad: nuevaCant,
          subtotal: nuevaCant * precio
        };
        return copy;
      }
      return [
        ...prev,
        {
          producto,
          cantidad: cant,
          subtotal: cant * precio
        }
      ];
    });

    toast.success(`Añadido: ${producto.nombre}`);
    setProductoAConstruir(null);
    setCantidadInput(1);
    setModalSearchOpen(false);
    setSearchTerm('');
  };

  const handleRemoveFromCarrito = (productoId) => {
    setCarrito((prev) => prev.filter((item) => item.producto.id !== productoId));
  };

  // Modificar cantidad en Móvil / PC
  const handleConfirmarModificarCantidad = () => {
    if (!itemAModificarMobile) return;
    const cant = Math.max(parseInt(nuevaCantidadMobile) || 1, 1);
    const precio = parseFloat(itemAModificarMobile.producto.precioBulto || itemAModificarMobile.producto.precio || 0);

    setCarrito((prev) =>
      prev.map((item) => {
        if (item.producto.id === itemAModificarMobile.producto.id) {
          return {
            ...item,
            cantidad: cant,
            subtotal: cant * precio
          };
        }
        return item;
      })
    );

    toast.success('Cantidad actualizada');
    setItemAModificarMobile(null);
  };

  // Confirmar eliminación
  const handleConfirmarEliminarMobile = () => {
    if (!itemAEliminarMobile) return;
    handleRemoveFromCarrito(itemAEliminarMobile.producto.id);
    toast.success('Producto eliminado del carrito');
    setItemAEliminarMobile(null);
  };

  // Validación y apertura del Checkout
  const handleAbrirCheckout = () => {
    if (carrito.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    if (!clienteSeleccionado) {
      toast.error('Debe seleccionar un cliente antes de registrar la venta');
      return;
    }
    setModalCheckoutOpen(true);
  };

  // Guardado Central de Venta
  const registrarVenta = async (accion) => {
    if (carrito.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    if (!clienteSeleccionado) {
      toast.error('Debe seleccionar un cliente antes de registrar la venta');
      return;
    }

    setIsSubmittingVenta(true);
    toast.loading('Procesando venta...', { id: 'sale-toast' });

    try {
      // 1. Insertar Cabecera de Venta
      const ventaPayload = {
        cliente_id: clienteSeleccionado || null,
        subtotal: subtotalCarrito,
        porcentaje_descuento: porcentajeDescuento,
        total: totalFinal
      };

      const { data: ventaInsertada, error: errorVenta } = await supabase
        .from('ventas')
        .insert([ventaPayload])
        .select()
        .single();

      if (errorVenta) throw errorVenta;

      // 2. Insertar Detalles de Venta
      const ventaId = ventaInsertada.id;
      const detallesPayload = carrito.map((item) => ({
        venta_id: ventaId,
        producto_id: item.producto.id,
        producto_nombre: item.producto.nombre,
        cantidad: item.cantidad,
        precio_unitario: parseFloat(item.producto.precioBulto || item.producto.precio || 0),
        subtotal: item.subtotal
      }));

      const { error: errorDetalles } = await supabase
        .from('venta_detalles')
        .insert(detallesPayload);

      if (errorDetalles) throw errorDetalles;

      // Generar instantánea para el ticket térmico de 80mm
      const numeroComprobante = ventaInsertada?.id || siguienteNumeroVenta;

      const datosTicket = {
        id: numeroComprobante,
        cliente: clienteObjeto
          ? (clienteObjeto.nombreCompleto || clienteObjeto.nombre_completo || 'Consumidor Final')
          : 'Consumidor Final',
        fecha: new Date().toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        items: [...carrito],
        subtotal: subtotalCarrito,
        descuento: porcentajeDescuento,
        montoDescuento,
        total: totalFinal
      };

      setDatosTicketImpresion(datosTicket);

      // 3. Ejecutar Acción Solicitada
      if (accion === 'imprimir') {
        toast.success('Venta registrada. Generando ticket térmico...', { id: 'sale-toast' });
        setTimeout(() => {
          window.print();
        }, 300);
      } else if (accion === 'enviar') {
        // Correos Electrónicos Destinatarios
        const emailEncargado = 'todogolosinas36@gmail.com';
        const emailCliente = clienteObjeto?.email || '';
        const destinatariosArray = [emailEncargado, emailCliente].filter(Boolean);

        // Formatear Mensaje Completo del Comprobante (Ticket Estructurado)
        let mensajeCompleto = `=================================\n`;
        mensajeCompleto += `     TODO GOLOSINAS - VENTA      \n`;
        mensajeCompleto += `=================================\n`;
        mensajeCompleto += `Ticket N°: ${numeroComprobante}\n`;
        mensajeCompleto += `Fecha y Hora: ${datosTicket.fecha}\n`;
        mensajeCompleto += `Cliente: ${datosTicket.cliente}\n`;
        mensajeCompleto += `Vendedor / Caja: Caja Central\n`;
        mensajeCompleto += `-------------------------------------------------\n`;

        carrito.forEach((item) => {
          const precioUnitario = parseFloat(item.producto.precioBulto || item.producto.precio || 0);
          mensajeCompleto += `${item.producto.nombre}\n`;
          mensajeCompleto += `Cantidad: ${item.cantidad} un. | P. Unitario: $${precioUnitario.toLocaleString('es-AR')} | Subtotal: $${item.subtotal.toLocaleString('es-AR')}\n`;
        });

        mensajeCompleto += `-------------------------------------------------\n`;
        mensajeCompleto += `Subtotal General: $${subtotalCarrito.toLocaleString('es-AR')}\n`;
        if (porcentajeDescuento > 0) {
          mensajeCompleto += `Descuento Aplicado: ${porcentajeDescuento}% (-$${montoDescuento.toLocaleString('es-AR')})\n`;
        } else {
          mensajeCompleto += `Descuento Aplicado: 0%\n`;
        }
        mensajeCompleto += `=================================\n`;
        mensajeCompleto += `TOTAL A PAGAR: $${totalFinal.toLocaleString('es-AR')}\n`;
        mensajeCompleto += `=================================\n`;
        mensajeCompleto += `¡Gracias por su compra en Todo Golosinas!`;

        const templateParams = {
          to_email: destinatariosArray.join(', '),
          order_id: numeroComprobante,
          ticket_number: numeroComprobante,
          message: mensajeCompleto
        };

        const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
        const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
        const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

        const isConfigured = serviceId && templateId && publicKey && serviceId !== 'tu_service_id';

        if (isConfigured) {
          toast.loading('Enviando comprobante por email...', { id: 'sale-toast' });
          try {
            const emailPromise = emailjs.send(serviceId, templateId, templateParams, publicKey);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout de respuesta EmailJS')), 4500)
            );

            await Promise.race([emailPromise, timeoutPromise]);
            toast.success(`Venta registrada. Comprobante enviado a: ${destinatariosArray.join(', ')}`, { id: 'sale-toast' });
          } catch (emailErr) {
            console.warn('EmailJS fallo o excedió tiempo límite (venta completada en DB):', emailErr);
            toast.success('Venta registrada con éxito', { id: 'sale-toast' });
          }
        } else {
          toast.success('Venta registrada con éxito', { id: 'sale-toast' });
        }
      } else {
        toast.success('Venta registrada con éxito', { id: 'sale-toast' });
      }

      // 4. Limpieza del Estado
      setCarrito([]);
      setDescuento(0);
      setClienteSeleccionado('');
      setVerCarritoMobile(false);
      setModalCheckoutOpen(false);
      fetchProximoNumero();

    } catch (err) {
      console.error('Error al registrar la venta:', err);
      toast.error('Hubo un error al registrar la venta', { id: 'sale-toast' });
    } finally {
      setIsSubmittingVenta(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20 lg:pb-0">
      {/* Estilos CSS de Impresión Térmica (80mm POS) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ticket-impresion, #ticket-impresion * {
            visibility: visible !important;
          }
          #ticket-impresion {
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

      {/* Ticket Térmico Oculto (Solo visible en ventana de impresión de 80mm) */}
      {datosTicketImpresion && (
        <div id="ticket-impresion" className="hidden print:block font-mono text-xs text-black">
          {/* Encabezado */}
          <div className="text-center font-bold text-sm uppercase mb-1">
            TODO GOLOSINAS
          </div>
          <div className="text-center text-[10px] mb-2 border-b border-black pb-1">
            Comprobante de Venta #{datosTicketImpresion.id}<br />
            {datosTicketImpresion.fecha}
          </div>

          {/* Cliente */}
          <div className="mb-2 text-[11px]">
            <strong>Cliente:</strong> {datosTicketImpresion.cliente}
          </div>

          {/* Detalle de Productos */}
          <div className="border-t border-b border-black py-1 mb-2">
            <div className="flex justify-between font-bold text-[10px] mb-1">
              <span>CANT / ARTÍCULO</span>
              <span>SUBTOTAL</span>
            </div>
            <div className="space-y-1">
              {datosTicketImpresion.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-[11px]">
                  <div className="pr-1">
                    <span>{item.cantidad}x {item.producto.nombre}</span>
                  </div>
                  <span className="font-bold shrink-0">${item.subtotal.toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="space-y-1 text-right text-[11px] mb-3">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${datosTicketImpresion.subtotal.toLocaleString('es-AR')}</span>
            </div>

            {datosTicketImpresion.descuento > 0 && (
              <div className="flex justify-between">
                <span>Descuento ({datosTicketImpresion.descuento}%):</span>
                <span>-${datosTicketImpresion.montoDescuento.toLocaleString('es-AR')}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
              <span>TOTAL A PAGAR:</span>
              <span>${datosTicketImpresion.total.toLocaleString('es-AR')}</span>
            </div>
          </div>

          {/* Pie del Ticket */}
          <div className="text-center text-[10px] border-t border-dashed border-black pt-2 uppercase">
            ¡Muchas gracias por su compra!<br />
            *** TODO GOLOSINAS ***
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${verCarritoMobile ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Vista Escritorio */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-slate-800">Punto de Venta (POS)</h1>
          <p className="text-slate-500 text-sm mt-1">Registra ventas rápidas e imprime comprobantes</p>
        </div>

        {/* Vista Móvil: Título limpio "Ventas" + Botones de Íconos Puros (Cliente y Producto) */}
        <div className="md:hidden flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-xl font-bold text-slate-800">Ventas</h1>

            {/* Contenedor compacto de botones de íconos puros */}
            <div className="flex items-center gap-2">
              {/* Botón Cliente */}
              <button
                onClick={() => setModalClienteOpen(true)}
                title={clienteObjeto ? (clienteObjeto.nombreCompleto || clienteObjeto.nombre_completo) : "Seleccionar Cliente"}
                className={`p-3 rounded-2xl transition-all shadow-sm flex items-center justify-center relative ${clienteObjeto ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                <User className="w-5 h-5" />
                {clienteObjeto && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                )}
              </button>

              {/* Botón Producto */}
              <button
                onClick={() => {
                  setModalSearchOpen(true);
                  setSearchTerm('');
                }}
                title="Agregar Producto"
                className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-sm shadow-indigo-200 transition-all flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Banner indicador de cliente activo en móvil */}
          {clienteObjeto && (
            <div className="flex items-center justify-between bg-indigo-50/90 px-3 py-1.5 rounded-xl text-xs text-indigo-800 font-medium border border-indigo-100">
              <span className="truncate">Cliente: <strong>{clienteObjeto.nombreCompleto || clienteObjeto.nombre_completo}</strong></span>
              <button onClick={() => setModalClienteOpen(true)} className="text-[10px] text-indigo-600 underline font-bold ml-2 shrink-0">Cambiar</button>
            </div>
          )}
        </div>

      </div>

      {/* VISTA MÓVIL EN PANTALLA COMPLETA CUANDO verCarritoMobile ES TRUE */}
      {verCarritoMobile && (
        <div className="md:hidden flex flex-col gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-in fade-in duration-200">
          {/* Header Móvil */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <button
              onClick={() => setVerCarritoMobile(false)}
              className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a productos</span>
            </button>
            <span className="font-bold text-slate-800 text-base">Tu Pedido</span>
          </div>

          {/* Lista Simplificada Móvil */}
          <div className="divide-y divide-gray-100 max-h-[340px] overflow-y-auto pr-1">
            {carrito.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">El carrito está vacío</p>
            ) : (
              carrito.map((item) => (
                <div key={item.producto.id} className="py-3 px-1 border-b border-gray-100 flex items-center justify-between gap-3">
                  {/* Lado Izquierdo: Nombre y botones compactos abajo */}
                  <div className="flex flex-col gap-1.5 overflow-hidden flex-1">
                    <span className="font-medium text-gray-800 text-sm capitalize truncate">
                      {item.producto.nombre}
                    </span>

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => {
                          setItemAModificarMobile(item);
                          setNuevaCantidadMobile(item.cantidad);
                        }}
                        title="Modificar cantidad"
                        className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setItemAEliminarMobile(item)}
                        title="Eliminar"
                        className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Lado Derecho: Subtotal visible */}
                  <div className="shrink-0 text-right">
                    <span className="text-base font-extrabold text-indigo-700">
                      ${item.subtotal.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totales y Finalizar Venta abajo */}
          <div className="pt-3 border-t border-gray-100 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Subtotal Parcial</span>
              <span className="font-bold text-slate-800">${subtotalCarrito.toLocaleString('es-AR')}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-700">Descuento (%)</label>
                <span className="text-xs text-indigo-600 font-bold">Máx. 20%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-slate-800"
                  placeholder="0"
                />
                <span className="font-bold text-slate-600 text-sm">%</span>
              </div>
              {montoDescuento > 0 && (
                <p className="text-xs text-emerald-600 font-semibold text-right">
                  Descuento: -${montoDescuento.toLocaleString('es-AR')}
                </p>
              )}
            </div>

            <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 flex justify-between items-center">
              <span className="font-bold text-indigo-900 text-sm">TOTAL FINAL</span>
              <span className="text-xl font-extrabold text-indigo-700">${totalFinal.toLocaleString('es-AR')}</span>
            </div>

            <button
              onClick={handleAbrirCheckout}
              disabled={carrito.length === 0}
              className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Finalizar Venta</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid Principal (Oculto en móvil cuando verCarritoMobile es true) */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${verCarritoMobile ? 'hidden md:grid' : 'grid'}`}>
        
        {/* Selector de Cliente y Tabla de Carrito */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          
          {/* Selector de Cliente y Botón Agregar (Visibles solo en Escritorio) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hidden md:flex flex-row items-center justify-between gap-4">
            
            {/* Vista Escritorio: Select Tradicional */}
            <div className="flex items-center gap-3 w-auto">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider">Cliente de la Venta *</label>
                <select
                  value={clienteSeleccionado}
                  onChange={(e) => setClienteSeleccionado(e.target.value)}
                  className="mt-1 bg-transparent font-semibold text-slate-800 text-sm focus:outline-none cursor-pointer"
                >
                  <option value="">-- Seleccionar cliente --</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombreCompleto || c.nombre_completo} {c.sucursal ? `(${c.sucursal})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                setModalSearchOpen(true);
                setSearchTerm('');
              }}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-medium transition-all shadow-sm shadow-indigo-200"
            >
              <Plus className="w-5 h-5" />
              <span>Agregar Producto</span>
            </button>
          </div>

          {/* Tabla de Productos en Carrito (Escritorio) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[350px]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <span className="font-bold text-slate-800 text-sm">Productos Seleccionados ({carrito.length})</span>
              {carrito.length > 0 && (
                <button
                  onClick={() => setCarrito([])}
                  className="text-xs text-red-600 hover:underline font-semibold"
                >
                  Vaciar Carrito
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto max-h-[420px]">
              {carrito.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <p className="font-semibold text-slate-700 text-base">El carrito está vacío</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs">
                    Haz clic en el botón "+ Agregar Producto" de arriba para incluir artículos a la venta.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3">Producto</th>
                      <th className="px-5 py-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {carrito.map((item) => (
                      <tr key={item.producto.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-slate-800 capitalize">
                              {item.producto.nombre}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => {
                                  setItemAModificarMobile(item);
                                  setNuevaCantidadMobile(item.cantidad);
                                }}
                                title="Modificar cantidad"
                                className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setItemAEliminarMobile(item)}
                                title="Eliminar"
                                className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-extrabold text-indigo-700 text-base align-top">
                          ${item.subtotal.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Totales & Checkout (Solo visible en Escritorio) */}
        <div className="hidden lg:flex lg:col-span-1 flex-col gap-5">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-full">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-6 pb-3 border-b border-gray-100 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                <span>Resumen de Venta</span>
              </h2>

              <div className="space-y-4">
                {/* Subtotal */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Subtotal Parcial</span>
                  <span className="font-bold text-slate-800 text-base">${subtotalCarrito.toLocaleString('es-AR')}</span>
                </div>

                {/* Input de Descuento */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-slate-700">Descuento (%)</label>
                    <span className="text-xs text-indigo-600 font-bold">Máx. 20%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={descuento}
                      onChange={(e) => setDescuento(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="0"
                    />
                    <span className="font-bold text-slate-600">%</span>
                  </div>
                  {montoDescuento > 0 && (
                    <p className="text-xs text-emerald-600 font-semibold text-right mt-0.5">
                      Descuento: -${montoDescuento.toLocaleString('es-AR')}
                    </p>
                  )}
                </div>

                <hr className="border-gray-100 my-2" />

                {/* Total Final */}
                <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 flex justify-between items-center">
                  <span className="font-bold text-indigo-900 text-base">TOTAL FINAL</span>
                  <span className="text-2xl font-extrabold text-indigo-700">${totalFinal.toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>

            {/* Botón Gigante Finalizar Venta */}
            <div className="mt-8">
              <button
                onClick={handleAbrirCheckout}
                disabled={carrito.length === 0}
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>Finalizar Venta</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Barra Flotante Inferior Sticky (Solo Móvil, cuando verCarritoMobile es false y hay productos) */}
      {!verCarritoMobile && carrito.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total a pagar</span>
            <span className="text-xl font-extrabold text-indigo-700">${totalFinal.toLocaleString('es-AR')}</span>
          </div>
          <button
            onClick={() => setVerCarritoMobile(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-2xl shadow-md transition-all text-sm"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Ver Carrito ({carrito.length})</span>
          </button>
        </div>
      )}

      {/* Modal Seleccionar Cliente (Móvil) */}
      {modalClienteOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalClienteOpen(false)}></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                <span>Seleccionar Cliente</span>
              </h3>
              <button onClick={() => setModalClienteOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 divide-y divide-gray-100">
              {clientes.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No hay clientes registrados.</p>
              ) : (
                clientes.map((c) => {
                  const isSelected = String(clienteSeleccionado) === String(c.id);
                  const nombre = c.nombreCompleto || c.nombre_completo;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setClienteSeleccionado(c.id);
                        setModalClienteOpen(false);
                      }}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm capitalize">{nombre}</p>
                          {c.sucursal && (
                            <p className="text-xs text-gray-400">Sucursal: {c.sucursal}</p>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Modificar Cantidad (Móvil & PC) */}
      {itemAModificarMobile && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setItemAModificarMobile(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 z-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-slate-800 text-base mb-1">Modificar Cantidad</h3>
            <p className="text-xs text-gray-500 mb-4 capitalize">{itemAModificarMobile.producto.nombre}</p>

            <div className="flex items-center justify-center gap-3 mb-5">
              <label className="text-xs font-semibold text-slate-600">Nueva Cantidad:</label>
              <input
                type="number"
                min="1"
                value={nuevaCantidadMobile}
                onChange={(e) => setNuevaCantidadMobile(e.target.value)}
                className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setItemAModificarMobile(null)}
                className="flex-1 py-2.5 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarModificarCantidad}
                className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar (Móvil & PC) */}
      {itemAEliminarMobile && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setItemAEliminarMobile(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 z-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">¿Quitar producto?</h3>
            <p className="text-xs text-gray-500 mb-5">
              ¿Estás seguro de quitar <strong className="capitalize text-slate-700">"{itemAEliminarMobile.producto.nombre}"</strong> del carrito?
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setItemAEliminarMobile(null)}
                className="flex-1 py-2.5 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEliminarMobile}
                className="flex-1 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl text-xs transition-colors"
              >
                Sí, quitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ingresar Cantidad (Foco Rápido) */}
      {productoAConstruir && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setProductoAConstruir(null)}
          ></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 z-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-slate-800 text-base mb-1">Ingresar Cantidad</h3>
            <p className="text-xs text-gray-500 mb-4 capitalize font-medium truncate px-2">
              {productoAConstruir.nombre}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAgregarAlCarrito(productoAConstruir, cantidadInput);
              }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center gap-2">
                <input
                  ref={cantidadInputRef}
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                  value={cantidadInput}
                  onChange={(e) => setCantidadInput(e.target.value)}
                  className="w-28 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xl font-black text-slate-800 text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductoAConstruir(null)}
                  className="flex-1 py-3 font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs shadow-sm shadow-indigo-200 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Búsqueda de Productos */}
      {modalSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalSearchOpen(false)}></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] z-10">
            <div className="p-5 border-b border-gray-100 bg-slate-50 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-600" />
                <span>Buscar Productos</span>
              </h3>
              <button onClick={() => setModalSearchOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Escribe un nombre o escanea un código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Lista de Resultados */}
            <div className="flex-1 overflow-y-auto p-2">
              {loadingSearch ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-xs">Buscando en catálogo...</span>
                </div>
              ) : productosBusqueda.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  No se encontraron productos coincidentes.
                </div>
              ) : (
                productosBusqueda.map((prod) => {
                  const precio = parseFloat(prod.precioBulto || prod.precio || 0);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        setProductoAConstruir(prod);
                        setCantidadInput(1);
                      }}
                      className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer active:bg-indigo-50/50"
                    >
                      {/* Bloque Izquierdo (Info del Producto) */}
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 flex items-center justify-center">
                          <Package className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-semibold text-slate-800 truncate capitalize">{prod.nombre}</span>
                          <span className="text-xs text-gray-500">Cód: {prod.codigoBarras || '-'} | Stock: {prod.stockBultos} u.</span>
                        </div>
                      </div>

                      {/* Bloque Derecho (Precio y Botón) */}
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                        <span className="text-sm font-bold text-blue-600">${precio.toLocaleString('es-AR')}</span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProductoAConstruir(prod);
                            setCantidadInput(1);
                          }}
                          className="hidden md:inline-flex px-3 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors"
                        >
                          Seleccionar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Checkout (Finalización de Venta) */}
      {modalCheckoutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmittingVenta && setModalCheckoutOpen(false)}></div>

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 z-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-1">Confirmar Venta</h3>
            <p className="text-sm text-gray-500 mb-6">
              Monto Total a Cobrar: <span className="font-extrabold text-indigo-600 text-lg">${totalFinal.toLocaleString('es-AR')}</span>
            </p>

            <div className="space-y-3">
              <button
                onClick={() => registrarVenta('imprimir')}
                disabled={isSubmittingVenta}
                className="w-full flex items-center justify-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-sm disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                <span>Imprimir Ticket</span>
              </button>

              <button
                onClick={() => registrarVenta('enviar')}
                disabled={isSubmittingVenta}
                className="w-full flex items-center justify-center gap-3 p-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-sm disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                <span>Enviar Comprobante</span>
              </button>

              <button
                onClick={() => registrarVenta('registrar')}
                disabled={isSubmittingVenta}
                className="w-full flex items-center justify-center gap-3 p-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5 text-slate-500" />
                <span>Solo Registrar</span>
              </button>

              <button
                onClick={() => setModalCheckoutOpen(false)}
                disabled={isSubmittingVenta}
                className="w-full py-3 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
