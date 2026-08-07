import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Package, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  PlusCircle,
  MinusCircle,
  Truck,
  Trash2,
  ShoppingCart,
  Check,
  X
} from 'lucide-react';

export default function Compras() {
  const [activeTab, setActiveTab] = useState('ingreso'); // 'ingreso' | 'salida'

  // Búsqueda de Productos
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Refs para cadena de foco con la tecla Enter en Ingreso de Stock
  const cantidadRef = useRef(null);
  const costoRef = useRef(null);
  const ventaRef = useRef(null);
  const agregarRef = useRef(null);

  // Estado para la Lista Temporal de Compras (Carrito de Ingreso)
  const [listaCompras, setListaCompras] = useState([]);

  // Formulario 1: Ingreso de Stock (Compras)
  const [cantidadAgregar, setCantidadAgregar] = useState('');
  const [nuevoCosto, setNuevoCosto] = useState('');
  const [nuevaVenta, setNuevaVenta] = useState('');
  const [isSubmittingIngreso, setIsSubmittingIngreso] = useState(false);

  // Formulario 2: Salidas / Devoluciones
  const [cantidadDescontar, setCantidadDescontar] = useState('');
  const [motivoSalida, setMotivoSalida] = useState('Devolución a Proveedor');
  const [fechaSalida, setFechaSalida] = useState(new Date().toISOString().split('T')[0]);
  const [observacionesSalida, setObservacionesSalida] = useState('');
  const [isSubmittingSalida, setIsSubmittingSalida] = useState(false);

  // Auto-foco automático al cargar / ingresar a la pantalla de Compras
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Buscar productos en Supabase al escribir en el buscador
  useEffect(() => {
    const searchProducts = async () => {
      const term = searchTerm.trim();
      if (!term) {
        setSearchResults([]);
        return;
      }

      setLoadingSearch(true);
      try {
        let query = supabase.from('productos').select('*').limit(15);
        const isBarcode = /^[0-9]{8,14}$/.test(term);

        if (isBarcode) {
          query = query.eq('codigoBarras', term);
        } else {
          query = query.ilike('nombre', `%${term}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('Error buscando productos:', err);
      } finally {
        setLoadingSearch(false);
      }
    };

    const timer = setTimeout(() => {
      searchProducts();
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Restablecer índice enfocado al cambiar el término de búsqueda
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchTerm]);

  // Auto-scroll para mantener visible el elemento enfocado en la lista
  useEffect(() => {
    if (focusedIndex >= 0 && resultsContainerRef.current) {
      const children = resultsContainerRef.current.children;
      if (children[focusedIndex]) {
        children[focusedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex]);

  // Manejo de Teclado (Flechas y Enter) en el Buscador
  const handleKeyDown = (e) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && searchResults[focusedIndex]) {
        e.preventDefault();
        handleSelectProduct(searchResults[focusedIndex]);
        setFocusedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setSearchResults([]);
      setFocusedIndex(-1);
    }
  };

  // Al seleccionar un producto del buscador
  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setSearchTerm('');
    setSearchResults([]);
    setFocusedIndex(-1);

    // Pre-llenar valores para Ingreso de Stock
    const costoActual = parseFloat(prod.precioCompra || prod.precioCosto || prod.precio_costo || 0);
    const ventaActual = parseFloat(prod.precioBulto || prod.precio || prod.precio_venta || 0);

    setNuevoCosto(costoActual > 0 ? costoActual : '');
    setNuevaVenta(ventaActual > 0 ? ventaActual : '');
    setCantidadAgregar('');

    // Pre-llenar valores para Salida
    setCantidadDescontar('');
    setObservacionesSalida('');

    // Foco directo al input de Cantidad al seleccionar desde el buscador
    setTimeout(() => {
      cantidadRef.current?.focus();
      cantidadRef.current?.select();
    }, 100);
  };

  // Cálculo de Margen de Ganancia para Ingreso
  const costoNum = parseFloat(nuevoCosto) || 0;
  const ventaNum = parseFloat(nuevaVenta) || 0;
  const gananciaUnitaria = ventaNum - costoNum;
  const margenPorcentaje = costoNum > 0 ? ((gananciaUnitaria / costoNum) * 100).toFixed(1) : 0;

  // 1. Agregar Producto a la Lista Temporal de Compra (NO envía a Supabase)
  const handleAgregarALista = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Selecciona un producto del catálogo');
      return;
    }

    const cantidad = parseInt(cantidadAgregar);
    if (!cantidad || cantidad <= 0) {
      toast.error('Ingresa una cantidad a agregar válida (mayor a 0)');
      return;
    }

    if (costoNum <= 0 || ventaNum <= 0) {
      toast.error('El costo y el precio de venta deben ser números mayores a 0');
      return;
    }

    const nuevoItem = {
      id_temporal: Date.now() + Math.random(),
      producto: selectedProduct,
      cantidad: cantidad,
      costo: costoNum,
      venta: ventaNum,
      subtotal: cantidad * costoNum
    };

    setListaCompras((prev) => [...prev, nuevoItem]);
    toast.success(`"${selectedProduct.nombre}" agregado al resumen de compra`);

    // Resetear inputs y enfocar buscador de nuevo
    setSelectedProduct(null);
    setSearchTerm('');
    setSearchResults([]);
    setCantidadAgregar('');
    setNuevoCosto('');
    setNuevaVenta('');

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Eliminar un ítem de la lista temporal
  const handleEliminarDeLista = (idTemporal) => {
    setListaCompras((prev) => prev.filter((item) => item.id_temporal !== idTemporal));
    toast.success('Producto removido del resumen');
  };

  // Total General acumulado de la compra temporal
  const totalGeneralCompra = listaCompras.reduce((acc, item) => acc + item.subtotal, 0);

  // 2. Envío Masivo a Supabase (Secuencial con manejo estricto de errores)
  const handleConfirmarCompraTotal = async () => {
    if (listaCompras.length === 0) {
      toast.error('El resumen de compra está vacío');
      return;
    }

    setIsSubmittingIngreso(true);
    console.log('Enviando lista a Supabase:', listaCompras);

    try {
      for (const item of listaCompras) {
        const stockActual = parseInt(item.producto.stockBultos || item.producto.stock || 0);
        const nuevoStock = stockActual + item.cantidad;

        // 1. Actualizar stock y precios en 'productos'
        const { error: errorUpdate } = await supabase
          .from('productos')
          .update({
            stockBultos: Number(item.producto.stockBultos || item.producto.stock || 0) + Number(item.cantidad),
            precioCompra: item.costo,
            precioBulto: item.venta
          })
          .eq('id', item.producto.id);

        if (errorUpdate) {
          throw new Error(`Error actualizando producto ${item.producto.nombre}: ${errorUpdate.message}`);
        }

        // 2. Insertar registro en 'historial_compras'
        const { error: errorInsert } = await supabase
          .from('historial_compras')
          .insert([{
            producto_id: item.producto.id,
            nombre_producto: item.producto.nombre,
            cantidad: item.cantidad,
            precio_costo: item.costo,
            precio_venta: item.venta,
            precio_venta_anterior: item.producto.precioBulto || item.producto.precio || item.producto.precio_venta || 0
          }]);

        if (errorInsert) {
          throw new Error(`Error insertando historial de ${item.producto.nombre}: ${errorInsert.message}`);
        }
      }

      toast.success(`¡Compra masiva registrada con éxito! (${listaCompras.length} ítems procesados)`, { duration: 5000 });

      // Limpieza total al finalizar con éxito
      setListaCompras([]);
      setSelectedProduct(null);
      setSearchTerm('');
      setSearchResults([]);

      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error general en la compra:', error);
      toast.error(error.message || 'Error general al guardar la compra en Supabase');
    } finally {
      setIsSubmittingIngreso(false);
    }
  };

  // Registrar Salida / Devolución
  const handleRegistrarSalida = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error('Selecciona un producto del catálogo');
      return;
    }

    const cantidad = parseInt(cantidadDescontar);
    if (!cantidad || cantidad <= 0) {
      toast.error('Ingresa una cantidad a descontar válida (mayor a 0)');
      return;
    }

    const stockActual = parseInt(selectedProduct.stockBultos || selectedProduct.stock || 0);
    if (cantidad > stockActual) {
      toast.error(`La cantidad a descontar (${cantidad}) supera el stock actual (${stockActual})`);
      return;
    }

    setIsSubmittingSalida(true);
    try {
      const nuevoStock = Math.max(0, stockActual - cantidad);

      const { error } = await supabase
        .from('productos')
        .update({ stockBultos: nuevoStock })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      try {
        await supabase.from('movimientos_stock').insert([{
          producto_id: selectedProduct.id,
          tipo: 'salida',
          motivo: motivoSalida,
          cantidad: cantidad,
          fecha: fechaSalida,
          observaciones: observacionesSalida.trim()
        }]);
      } catch (eMov) {
        // Ignorar si la tabla no está creada
      }

      toast.success(`Salida registrada. Stock restante: ${nuevoStock} u.`, { duration: 4000 });

      setSelectedProduct((prev) => prev ? {
        ...prev,
        stockBultos: nuevoStock
      } : null);

      setCantidadDescontar('');
      setObservacionesSalida('');
    } catch (err) {
      console.error('Error registrando salida:', err);
      toast.error('No se pudo registrar la salida del producto');
    } finally {
      setIsSubmittingSalida(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3.5rem)] overflow-hidden gap-4">
      {/* Header General */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Gestión de Mercadería</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium">Sistema de carga masiva de compras, actualización de listas y egresos</p>
          </div>
        </div>

        {/* Selector de Pestañas Desktop */}
        <div className="flex bg-gray-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('ingreso')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ingreso'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-500 hover:text-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ingreso de Stock (Compras)</span>
          </button>

          <button
            onClick={() => setActiveTab('salida')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'salida'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-500 hover:text-slate-800'
            }`}
          >
            <MinusCircle className="w-4 h-4" />
            <span>Salidas / Devoluciones</span>
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: SISTEMA DE DOBLE PANEL PARA INGRESO DE COMPRAS */}
      {activeTab === 'ingreso' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden items-stretch">
          
          {/* COLUMNA IZQUIERDA: Buscador y Formulario de Carga */}
          <div className="flex flex-col h-full min-h-0 space-y-4 overflow-y-auto pr-1">
            {/* Buscador Inteligente */}
            <div className="relative z-30 shrink-0">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  1. Buscar Golosina o Escanear Código
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 w-5 h-5 text-indigo-500" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar por nombre o escanear código de barras..."
                    className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-slate-800 placeholder-gray-400 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {loadingSearch && (
                    <Loader2 className="absolute right-4 top-3.5 w-5 h-5 text-indigo-600 animate-spin" />
                  )}
                </div>
              </div>

              {/* Desplegable de Resultados */}
              {searchResults.length > 0 && (
                <div
                  ref={resultsContainerRef}
                  className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-64 overflow-y-auto divide-y divide-gray-100 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  {searchResults.map((prod, index) => {
                    const stock = prod.stockBultos || prod.stock || 0;
                    const precioVenta = parseFloat(prod.precioBulto || prod.precio || 0);
                    const isFocused = index === focusedIndex;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => {
                          handleSelectProduct(prod);
                          setFocusedIndex(-1);
                        }}
                        className={`p-4 cursor-pointer flex items-center justify-between transition-colors ${
                          isFocused
                            ? 'bg-indigo-100/90 border-l-4 border-indigo-600 font-bold shadow-inner'
                            : 'hover:bg-indigo-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isFocused ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm capitalize">{prod.nombre}</p>
                            <p className="text-xs text-gray-400">Cód: {prod.codigoBarras || 'Sin código'}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-extrabold text-indigo-700 text-sm">${precioVenta.toLocaleString('es-AR')}</p>
                          <p className="text-xs font-semibold text-slate-500">Stock: {stock} u.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Banner de Producto Seleccionado */}
            {selectedProduct ? (
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-md flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
                    <Package className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">Producto Seleccionado</span>
                    <h2 className="text-base font-extrabold capitalize leading-tight">{selectedProduct.nombre}</h2>
                    <p className="text-xs text-slate-300 mt-0.5">Stock Actual: {selectedProduct.stockBultos || selectedProduct.stock || 0} u.</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedProduct(null)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl transition-colors backdrop-blur-md text-slate-200"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-3 text-indigo-800 text-xs shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-indigo-600" />
                <span>Busca una golosina arriba para comenzar a cargar el lote de compra.</span>
              </div>
            )}

            {/* Formulario de Carga de Valores */}
            {selectedProduct && (
              <form onSubmit={handleAgregarALista} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 shrink-0">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <PlusCircle className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Datos del Lote a Ingresar</h3>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Cantidad a Agregar */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Cantidad *
                    </label>
                    <input
                      ref={cantidadRef}
                      type="number"
                      min="1"
                      required
                      placeholder="Ej. 24"
                      value={cantidadAgregar}
                      onChange={(e) => setCantidadAgregar(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          costoRef.current?.focus();
                          costoRef.current?.select();
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Nuevo Precio de Costo */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      P. Costo ($) *
                    </label>
                    <input
                      ref={costoRef}
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="Costo"
                      value={nuevoCosto}
                      onChange={(e) => setNuevoCosto(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          ventaRef.current?.focus();
                          ventaRef.current?.select();
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Nuevo Precio de Venta */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      P. Venta ($) *
                    </label>
                    <input
                      ref={ventaRef}
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="Venta"
                      value={nuevaVenta}
                      onChange={(e) => setNuevaVenta(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          agregarRef.current?.focus();
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-indigo-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Cálculo Visual del Margen */}
                <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-900">Margen s/ Costo: <strong>{margenPorcentaje}%</strong></span>
                  <span className="text-indigo-700 font-bold">Subtotal: ${(cantidadAgregar * costoNum).toLocaleString('es-AR')}</span>
                </div>

                <button
                  ref={agregarRef}
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/40"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Agregar al Resumen de Compra</span>
                </button>
              </form>
            )}
          </div>

          {/* COLUMNA DERECHA: Resumen de Compra Temporal (Carrito de Ingreso de Alto Fijo) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full min-h-0 overflow-hidden">
            {/* Header de Resumen */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <h2 className="font-extrabold text-slate-800 text-base">Resumen de Compra</h2>
              </div>

              <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-full text-xs">
                {listaCompras.length} {listaCompras.length === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>

            {/* Lista / Tabla de Productos a Ingresar (Scroll Interno) */}
            {listaCompras.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-400 gap-3 border-2 border-dashed border-gray-100 rounded-2xl min-h-0">
                <ShoppingCart className="w-10 h-10 text-gray-300" />
                <p className="text-xs font-semibold">El resumen de compra está vacío.</p>
                <p className="text-[11px] text-gray-400 text-center max-w-xs">
                  Busca productos a la izquierda y agrégalos para procesar la compra masiva.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100 pr-2">
                {listaCompras.map((item) => (
                  <div key={item.id_temporal} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-slate-800 capitalize truncate">{item.producto.nombre}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Cant: <strong className="text-slate-800">{item.cantidad} u.</strong> | Costo: ${item.costo.toLocaleString('es-AR')} | Venta: ${item.venta.toLocaleString('es-AR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-extrabold text-indigo-700 text-sm">
                        ${item.subtotal.toLocaleString('es-AR')}
                      </span>

                      <button
                        onClick={() => handleEliminarDeLista(item.id_temporal)}
                        title="Eliminar de la lista"
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer de Resumen y Botón de Confirmación Masiva (Fijo Abajo) */}
            <div className="pt-3 border-t border-gray-100 space-y-3 mt-auto shrink-0">
              <div className="flex justify-between items-baseline bg-slate-50 p-3.5 rounded-2xl border border-gray-200">
                <span className="font-bold text-slate-600 text-xs uppercase tracking-wider">Total a Pagar:</span>
                <span className="text-2xl font-black text-emerald-700">
                  ${totalGeneralCompra.toLocaleString('es-AR')}
                </span>
              </div>

              <button
                onClick={handleConfirmarCompraTotal}
                disabled={isSubmittingIngreso || listaCompras.length === 0}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingIngreso ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                <span>Confirmar y Guardar Compra Masiva</span>
              </button>
            </div>
          </div>

        </div>
      ) : (
        /* PESTAÑA 2: SALIDAS / DEVOLUCIONES */
        <div className="space-y-6">
          {/* Tarjetas de Referencia del Producto */}
          {selectedProduct && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Actual</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-slate-800">
                    {selectedProduct.stockBultos || selectedProduct.stock || 0}
                  </span>
                  <span className="text-xs font-bold text-gray-500">unidades disponibles</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Precio de Venta</span>
                <span className="text-3xl font-black text-indigo-600 mt-2">
                  ${(parseFloat(selectedProduct.precioBulto || selectedProduct.precio || 0)).toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          )}

          {/* Formulario de Egreso */}
          <form onSubmit={handleRegistrarSalida} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <MinusCircle className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-slate-800 text-base">Registrar Egreso / Baja de Stock</h3>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {/* Cantidad a Descontar */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Cantidad a Descontar *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct?.stockBultos || selectedProduct?.stock || 9999}
                  required
                  placeholder="Ej. 5"
                  value={cantidadDescontar}
                  onChange={(e) => setCantidadDescontar(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-lg font-bold text-red-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Motivo de Salida *
                </label>
                <select
                  value={motivoSalida}
                  onChange={(e) => setMotivoSalida(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="Devolución a Proveedor">Devolución a Proveedor</option>
                  <option value="Vencimiento">Vencimiento</option>
                  <option value="Mercadería Rota">Mercadería Rota</option>
                  <option value="Consumo Interno">Consumo Interno</option>
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Fecha de Registro *
                </label>
                <input
                  type="date"
                  required
                  value={fechaSalida}
                  onChange={(e) => setFechaSalida(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Observaciones / Detalles Extra (Opcional)
              </label>
              <textarea
                rows="3"
                placeholder="Describe cualquier detalle relevante sobre la baja de mercadería..."
                value={observacionesSalida}
                onChange={(e) => setObservacionesSalida(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              ></textarea>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingSalida || !selectedProduct}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-md shadow-red-200 disabled:opacity-50 text-sm"
              >
                {isSubmittingSalida ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>Registrar Salida de Mercadería</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
