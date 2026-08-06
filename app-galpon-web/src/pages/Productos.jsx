import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  AlertCircle,
  X,
  Package,
  Upload,
  Download,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

const toTitleCase = (str) => str ? str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Paginación y Métricas
  const [metricas, setMetricas] = useState({ totalArticulos: 0, capitalTotal: 0 });
  const [pagina, setPagina] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const LIMITE = 50;

  // Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentProduct, setCurrentProduct] = useState({
    id: null,
    nombre: '',
    codigoBarras: '',
    precioBulto: '',
    precioCompra: '',
    stockBultos: ''
  });

  // Modal de Eliminación
  const [productoAEliminar, setProductoAEliminar] = useState(null);

  // Estados Importación Excel
  const [datosPendientes, setDatosPendientes] = useState([]);
  const [modalImportacionOpen, setModalImportacionOpen] = useState(false);
  const [opcionesImportacion, setOpcionesImportacion] = useState({ 
    actualizarPrecio: true, 
    actualizarPrecioCompra: false,
    actualizarStock: false, 
    actualizarCodigo: false, 
    agregarNuevos: false 
  });
  
  const fileInputRef = useRef(null);

  const exportarExcel = () => {
    if (productos.length === 0) {
      toast.error('No hay productos para exportar');
      return;
    }
    const datosFormateados = productos.map(p => ({
      Nombre: p.nombre,
      'Código de Barras': p.codigoBarras,
      Precio: p.precioBulto,
      'Precio de Compra': p.precioCompra,
      Stock: p.stockBultos
    }));
    
    const ws = XLSX.utils.json_to_sheet(datosFormateados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, "inventario_tg.xlsx");
    toast.success('Inventario exportado');
  };

  const importarExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          toast.error('El archivo está vacío');
          return;
        }

        const newProducts = data.map(item => {
          // Normalizar claves a minúsculas y sin tildes
          const normalizedItem = {};
          Object.keys(item).forEach(k => {
            const cleanKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            normalizedItem[cleanKey] = item[k];
          });

          const codigoBarrasRaw = normalizedItem['codigo de barras'] || normalizedItem['codigo'] || normalizedItem['cod barras'] || normalizedItem['codigobarras'] || '';
          const precioCompraRaw = normalizedItem['precio de compra'] || normalizedItem['precio compra'] || normalizedItem['costo'] || normalizedItem['costo bulto'] || normalizedItem['compra'] || item['Precio de Compra'] || item.precioCompra || 0;
          
          return {
            nombre: toTitleCase(item.Nombre || item.nombre || normalizedItem['nombre'] || ''),
            codigoBarras: String(codigoBarrasRaw),
            precioBulto: parseFloat(item.Precio || item.precioBulto || normalizedItem['precio'] || 0),
            precioCompra: Number(precioCompraRaw) || 0,
            stockBultos: parseInt(item.Stock || item.stockBultos || normalizedItem['stock'] || 0)
          };
        }).filter(p => p.nombre);

        if (newProducts.length === 0) {
          toast.error('No se encontraron productos válidos');
          return;
        }

        // Filtrar productos duplicados conservando el último iterado
        const productosMap = new Map();
        newProducts.forEach(prod => {
          const key = prod.nombre.toLowerCase().trim();
          productosMap.set(key, prod);
        });

        const productosUnicos = Array.from(productosMap.values());

        if (newProducts.length > productosUnicos.length) {
          toast('Se limpiaron productos duplicados del Excel', { icon: '🧹' });
        }
        
        setDatosPendientes(productosUnicos);
        setModalImportacionOpen(true);
      } catch (error) {
        console.error('Error importando:', error);
        toast.error('Error al parsear el archivo Excel');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Debounce para Búsqueda en Servidor
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagina(0);
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchMetricas = async () => {
    try {
      const { data, error } = await supabase.rpc('obtener_metricas_inventario');
      if (error) {
        console.warn('RPC obtener_metricas_inventario no disponible o con error:', error);
        return;
      }
      if (data) {
        const metricObj = Array.isArray(data) ? data[0] : data;
        if (metricObj) {
          setMetricas({
            totalArticulos: Number(metricObj.totalArticulos ?? metricObj.total_articulos ?? 0),
            capitalTotal: Number(metricObj.capitalTotal ?? metricObj.capital_total ?? 0)
          });
        }
      }
    } catch (err) {
      console.warn('Error llamando RPC:', err);
    }
  };

  const fetchProductos = async (pageToFetch = pagina, isReset = false) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      const cleanTerm = debouncedSearchTerm.trim();
      if (cleanTerm) {
        const isBarcode = /^[0-9]{8,14}$/.test(cleanTerm);
        if (isBarcode) {
          query = query.eq('codigoBarras', cleanTerm);
        } else {
          query = query.ilike('nombre', `%${cleanTerm}%`);
        }
      }

      const from = pageToFetch * LIMITE;
      const to = (pageToFetch + 1) * LIMITE - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;

      const fetchedData = data || [];

      if (pageToFetch === 0 || isReset) {
        setProductos(fetchedData);
      } else {
        setProductos(prev => [...prev, ...fetchedData]);
      }

      setHasMore(fetchedData.length === LIMITE);
    } catch (err) {
      console.error('Error fetching productos:', err);
      setError('No se pudieron cargar los productos. Revisa tu conexión a Supabase.');
      toast.error('No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricas();
  }, []);

  useEffect(() => {
    fetchProductos(pagina, pagina === 0);
  }, [pagina, debouncedSearchTerm]);

  const handleComenzarImportacion = async () => {
    setIsSubmitting(true);
    toast.loading('Procesando importación...', { id: 'sync' });
    try {
      const { data: currentProds, error: fetchError } = await supabase.from('productos').select('*');
      if (fetchError) throw fetchError;

      let actualizados = 0;
      let agregados = 0;

      const promises = datosPendientes.map(async (prod) => {
        const match = currentProds.find(cp => cp.nombre.toLowerCase() === prod.nombre.toLowerCase());

        if (match) {
          const datosAActualizar = {};
          if (opcionesImportacion.actualizarPrecio) datosAActualizar.precioBulto = prod.precioBulto;
          if (opcionesImportacion.actualizarPrecioCompra) datosAActualizar.precioCompra = prod.precioCompra;
          if (opcionesImportacion.actualizarStock) datosAActualizar.stockBultos = prod.stockBultos;
          if (opcionesImportacion.actualizarCodigo) datosAActualizar.codigoBarras = prod.codigoBarras;

          if (Object.keys(datosAActualizar).length > 0) {
            actualizados++;
            return supabase.from('productos').update(datosAActualizar).eq('id', match.id);
          }
          return Promise.resolve();
        } else {
          if (opcionesImportacion.agregarNuevos) {
            agregados++;
            return supabase.from('productos').insert([prod]);
          }
          return Promise.resolve();
        }
      });

      await Promise.all(promises);
      toast.success(`Importación lista: ${actualizados} actualizados, ${agregados} agregados.`, { id: 'sync' });
      setModalImportacionOpen(false);
      setDatosPendientes([]);
      fetchMetricas();
      if (pagina === 0) fetchProductos(0, true);
      else setPagina(0);
    } catch (err) {
      console.error('Error procesando:', err);
      toast.error('Error al procesar la importación', { id: 'sync' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReemplazoTotal = async () => {
    const confirm = window.confirm('¿Estás seguro? Se borrará todo tu stock actual.');
    if (!confirm) return;

    setIsSubmitting(true);
    toast.loading('Reemplazando base de datos...', { id: 'replace' });
    try {
      const { error: deleteError } = await supabase.from('productos').delete().not('id', 'is', null);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from('productos').insert(datosPendientes);
      if (insertError) throw insertError;

      toast.success('Reemplazo completado con éxito', { id: 'replace' });
      setModalImportacionOpen(false);
      setDatosPendientes([]);
      fetchMetricas();
      if (pagina === 0) fetchProductos(0, true);
      else setPagina(0);
    } catch (err) {
      console.error('Error en reemplazo total:', err);
      toast.error('Error al reemplazar datos', { id: 'replace' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredProductos = productos;

  // Funciones de Modal
  const openModal = (product = null) => {
    if (product) {
      setCurrentProduct(product);
    } else {
      setCurrentProduct({
        id: null,
        nombre: '',
        codigoBarras: '',
        precioBulto: '',
        precioCompra: '',
        stockBultos: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentProduct({ id: null, nombre: '', codigoBarras: '', precioBulto: '', precioCompra: '', stockBultos: '' });
  };

  // Guardar (Crear o Actualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Preparar el payload asegurando que los tipos sean correctos
    const payload = {
      nombre: currentProduct.nombre,
      codigoBarras: currentProduct.codigoBarras,
      precioBulto: parseFloat(currentProduct.precioBulto) || 0,
      precioCompra: parseFloat(currentProduct.precioCompra) || 0,
      stockBultos: parseInt(currentProduct.stockBultos) || 0
    };

    try {
      if (currentProduct.id) {
        // Update
        const { error } = await supabase
          .from('productos')
          .update(payload)
          .eq('id', currentProduct.id);
        
        if (error) throw error;
        toast.success('Producto actualizado correctamente');
      } else {
        // Insert
        const { error } = await supabase
          .from('productos')
          .insert([payload]);
        
        if (error) throw error;
        toast.success('Producto creado correctamente');
      }

      fetchMetricas();
      if (pagina === 0) fetchProductos(0, true);
      else setPagina(0);
      closeModal();
    } catch (err) {
      console.error('Error guardando producto:', err);
      toast.error('Hubo un error al guardar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Solicitar Eliminación (Abre Modal)
  const handleDeleteClick = (product) => {
    setProductoAEliminar(product);
  };

  // Confirmar Eliminación Real
  const confirmarEliminacion = async () => {
    if (!productoAEliminar) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', productoAEliminar.id);

      if (error) throw error;
      
      // Actualizar estado local
      setProductos((prev) => prev.filter((p) => p.id !== productoAEliminar.id));
      fetchMetricas();
      toast.success('Producto eliminado con éxito');
    } catch (err) {
      console.error('Error eliminando producto:', err);
      toast.error('Hubo un error al eliminar el producto.');
    } finally {
      setIsSubmitting(false);
      setProductoAEliminar(null);
    }
  };

  const capitalTotal = useMemo(() => productos.reduce((acc, curr) => acc + ((Number(curr.precioCompra) || 0) * (Number(curr.stockBultos) || 0)), 0), [productos]);

  return (
    <div className="flex flex-col h-full">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Productos</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona el inventario de tu almacén</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Import/Export Solo Desktop */}
          <div className="hidden md:flex gap-2">
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputRef}
              onChange={importarExcel}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 px-4 py-3 rounded-2xl font-medium transition-colors shadow-sm"
            >
              <Upload className="w-5 h-5" />
              <span>Importar</span>
            </button>
            <button
              onClick={exportarExcel}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 px-4 py-3 rounded-2xl font-medium transition-colors shadow-sm"
            >
              <Download className="w-5 h-5" />
              <span>Exportar</span>
            </button>
          </div>

          <button
            onClick={() => openModal()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-2xl font-medium transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Panel de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Widget Capital Total */}
        <div className="bg-indigo-600 text-white rounded-2xl p-5 shadow-md flex justify-between items-center">
           <div>
              <h3 className="text-indigo-100 font-medium text-sm">Stock Valorizado (Capital)</h3>
              <p className="text-2xl font-bold mt-1">${(metricas.capitalTotal || 0).toLocaleString('es-AR')}</p>
           </div>
           <div className="bg-indigo-500/50 p-3 rounded-xl">
             <Package className="w-6 h-6 text-white" />
           </div>
        </div>

        {/* Widget Total Artículos */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex justify-between items-center">
           <div>
              <h3 className="text-slate-500 font-medium text-sm">Total de Artículos</h3>
              <p className="text-2xl font-bold text-slate-800 mt-1">{metricas.totalArticulos || productos.length}</p>
           </div>
           <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
             <Package className="w-6 h-6" />
           </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre o código de barras..."
          value={searchTerm}
          onChange={handleSearch}
          className="block w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex items-start gap-2">
          <AlertCircle className="shrink-0 w-5 h-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <p className="text-gray-500 font-medium">Cargando catálogo...</p>
        </div>
      ) : (
        <>
          {/* Desktop Table (Hidden on mobile) */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 max-h-[60vh] overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4">Cód. Barras</th>
                    <th className="px-6 py-4">Precio Compra</th>
                    <th className="px-6 py-4">Precio (Bulto)</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProductos.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                        No se encontraron productos.
                      </td>
                    </tr>
                  ) : (
                    filteredProductos.map((prod) => (
                      <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                            <span className="font-semibold text-slate-800 capitalize">{prod.nombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                          {prod.codigoBarras || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                          {prod.precioCompra !== null && prod.precioCompra !== undefined ? `$${Number(prod.precioCompra).toLocaleString('es-AR')}` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg text-sm">
                            ${parseFloat(prod.precioBulto || 0).toLocaleString('es-AR')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-semibold text-sm ${prod.stockBultos <= 5 ? 'text-red-600' : 'text-slate-700'}`}>
                            {prod.stockBultos} bultos
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openModal(prod)}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(prod)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Botón Cargar Más en Tabla Desktop */}
            {hasMore && (
              <div className="flex justify-center p-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => setPagina(prev => prev + 1)}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-slate-700 font-medium text-sm rounded-2xl shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : null}
                  Cargar más productos
                </button>
              </div>
            )}
          </div>

          {/* Mobile Cards (Hidden on desktop) */}
          <div className="md:hidden max-h-[65vh] overflow-y-auto space-y-3 p-1">
            {filteredProductos.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-gray-500 border border-gray-100 shadow-sm">
                No se encontraron productos.
              </div>
            ) : (
              filteredProductos.map((prod) => (
                <div key={prod.id} className="flex items-center justify-between p-3 mb-2 bg-white border border-gray-100 rounded-2xl shadow-sm">
                  {/* Left Section (Info) */}
                  <div className="flex flex-col overflow-hidden flex-1">
                    <span className="text-sm font-semibold text-gray-800 leading-tight truncate w-32 capitalize">{prod.nombre}</span>
                    <span className="text-xs text-gray-400 mt-0.5">{prod.codigoBarras || '-'}</span>
                  </div>
                  
                  <div className="flex items-center">
                    {/* Center Section (Numbers) */}
                    <div className="flex flex-col text-right">
                      <span className="text-sm font-bold text-indigo-600">${parseFloat(prod.precioBulto || 0).toLocaleString('es-AR')}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Compra: {prod.precioCompra !== null && prod.precioCompra !== undefined ? `$${Number(prod.precioCompra).toLocaleString('es-AR')}` : '-'}</span>
                      <span className="text-xs text-gray-500 mt-0.5 font-medium">{prod.stockBultos} u.</span>
                    </div>

                    {/* Right Section (Actions) */}
                    <div className="flex gap-1 ml-3">
                      <button
                        onClick={() => openModal(prod)}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-gray-100 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(prod)}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Botón Cargar Más en Móvil */}
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => setPagina(prev => prev + 1)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-medium text-sm rounded-2xl shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : null}
                  Cargar más productos
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Formulario (Nuevo / Editar) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={closeModal}
          ></div>
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-slate-800">
                {currentProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la Golosina *</label>
                  <input
                    type="text"
                    required
                    value={currentProduct.nombre}
                    onChange={(e) => setCurrentProduct({...currentProduct, nombre: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    placeholder="Ej. Alfajor Jorgito"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de Barras</label>
                  <input
                    type="text"
                    value={currentProduct.codigoBarras}
                    onChange={(e) => setCurrentProduct({...currentProduct, codigoBarras: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    placeholder="779..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Precio de Compra ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={currentProduct.precioCompra}
                      onChange={(e) => setCurrentProduct({...currentProduct, precioCompra: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Precio x Bulto ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={currentProduct.precioBulto}
                      onChange={(e) => setCurrentProduct({...currentProduct, precioBulto: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock (Bultos) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={currentProduct.stockBultos}
                      onChange={(e) => setCurrentProduct({...currentProduct, stockBultos: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 sm:flex-none h-12 px-6 font-medium text-gray-600 hover:bg-gray-100 rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-12 px-6 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-sm shadow-indigo-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Eliminación */}
      {productoAEliminar && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => !isSubmitting && setProductoAEliminar(null)}
          ></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar producto?</h2>
            <p className="text-gray-500 text-sm mb-8">
              Estás a punto de eliminar <strong>"{productoAEliminar.nombre}"</strong>. Esta acción no se puede deshacer.
            </p>
            
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setProductoAEliminar(null)}
                disabled={isSubmitting}
                className="w-full h-12 flex items-center justify-center font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminacion}
                disabled={isSubmitting}
                className="w-full h-12 flex items-center justify-center gap-2 font-medium text-white bg-red-600 hover:bg-red-700 rounded-2xl shadow-sm shadow-red-200 transition-colors disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importación Opciones */}
      {modalImportacionOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          ></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Cabecera Fija */}
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50 shrink-0">
              <h2 className="text-lg font-bold text-slate-800">
                Opciones de Importación
              </h2>
              {!isSubmitting && (
                <button 
                  onClick={() => { setModalImportacionOpen(false); setDatosPendientes([]); }} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Cuerpo Scrolleable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <p className="text-sm text-indigo-900">
                  Se detectaron <span className="font-bold text-indigo-600 text-base">{datosPendientes.length}</span> productos. Selecciona qué datos deseas actualizar:
                </p>
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center p-4 border border-gray-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 border-2 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-0 transition-all cursor-pointer"
                      checked={opcionesImportacion.actualizarPrecio}
                      onChange={(e) => setOpcionesImportacion({...opcionesImportacion, actualizarPrecio: e.target.checked})}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="block text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">Actualizar Precios</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Modifica el precio del bulto de los productos existentes.</span>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-gray-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 border-2 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-0 transition-all cursor-pointer"
                      checked={opcionesImportacion.actualizarPrecioCompra}
                      onChange={(e) => setOpcionesImportacion({...opcionesImportacion, actualizarPrecioCompra: e.target.checked})}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="block text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">Actualizar Precio de Compra</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Modifica el precio de costo de los productos existentes.</span>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-gray-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 border-2 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-0 transition-all cursor-pointer"
                      checked={opcionesImportacion.actualizarStock}
                      onChange={(e) => setOpcionesImportacion({...opcionesImportacion, actualizarStock: e.target.checked})}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="block text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">Actualizar Stock</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Modifica la cantidad de bultos de los productos existentes.</span>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-gray-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 border-2 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-0 transition-all cursor-pointer"
                      checked={opcionesImportacion.actualizarCodigo}
                      onChange={(e) => setOpcionesImportacion({...opcionesImportacion, actualizarCodigo: e.target.checked})}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="block text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">Actualizar Códigos de Barras</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Actualiza el código de barras si el nombre coincide.</span>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-gray-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 border-2 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-0 transition-all cursor-pointer"
                      checked={opcionesImportacion.agregarNuevos}
                      onChange={(e) => setOpcionesImportacion({...opcionesImportacion, agregarNuevos: e.target.checked})}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="block text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">Agregar productos nuevos al inventario</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Crea el producto si no existe en la base de datos.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Pie Fijo */}
            <div className="p-5 border-t border-gray-100 shrink-0 flex flex-col gap-3 bg-gray-50 rounded-b-2xl">
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => { setModalImportacionOpen(false); setDatosPendientes([]); }}
                  disabled={isSubmitting}
                  className="w-full sm:w-1/3 h-12 font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-2xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleComenzarImportacion}
                  disabled={isSubmitting || (!opcionesImportacion.actualizarPrecio && !opcionesImportacion.actualizarPrecioCompra && !opcionesImportacion.actualizarStock && !opcionesImportacion.actualizarCodigo && !opcionesImportacion.agregarNuevos)}
                  className="w-full sm:w-2/3 flex items-center justify-center gap-2 h-12 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  Comenzar Importación
                </button>
              </div>

              <button
                onClick={handleReemplazoTotal}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 h-12 font-medium text-white bg-red-600 hover:bg-red-700 rounded-2xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                Reemplazo Total (Borrar todo e importar)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
