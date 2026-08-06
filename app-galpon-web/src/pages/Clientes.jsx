import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { 
  Users, 
  Plus, 
  Search, 
  Loader2, 
  AlertCircle, 
  X, 
  MapPin, 
  Mail, 
  Phone, 
  User 
} from 'lucide-react';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    sucursal: '',
    email: '',
    telefono: ''
  });

  const fetchClientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
      setError('No se pudieron cargar los clientes. Revisa tu conexión a Supabase.');
      toast.error('Error al cargar la lista de clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const openModal = () => {
    setFormData({
      nombreCompleto: '',
      sucursal: '',
      email: '',
      telefono: ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setFormData({
      nombreCompleto: '',
      sucursal: '',
      email: '',
      telefono: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombreCompleto.trim()) {
      toast.error('Por favor ingresa el nombre completo');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        nombreCompleto: formData.nombreCompleto.trim(),
        sucursal: formData.sucursal,
        email: formData.email.trim(),
        telefono: formData.telefono.trim()
      };

      const { error } = await supabase.from('clientes').insert([payload]);

      if (error) throw error;

      toast.success('Cliente guardado con éxito');
      closeModal();
      fetchClientes();
    } catch (err) {
      console.error('Error al guardar cliente:', err);
      toast.error('Hubo un error al guardar el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClientes = clientes.filter((c) => {
    const term = searchTerm.toLowerCase();
    const nombre = (c.nombreCompleto || c.nombre_completo || '').toLowerCase();
    const sucursal = (c.sucursal || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const telefono = (c.telefono || '').toLowerCase();

    return (
      nombre.includes(term) ||
      sucursal.includes(term) ||
      email.includes(term) ||
      telefono.includes(term)
    );
  });

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona la base de clientes y sucursales</p>
        </div>

        <button
          onClick={openModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-medium transition-all shadow-sm shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          <span>+ Nuevo Cliente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre, sucursal, email o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex items-start gap-2">
          <AlertCircle className="shrink-0 w-5 h-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-gray-500 font-medium text-sm">Cargando lista de clientes...</p>
        </div>
      ) : (
        <>
          {/* Desktop Table (Hidden on mobile) */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    <th className="px-6 py-4">Nombre Completo</th>
                    <th className="px-6 py-4">Sucursal</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Teléfono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredClientes.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                        No se encontraron clientes registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredClientes.map((cliente) => {
                      const nombre = cliente.nombreCompleto || cliente.nombre_completo || '-';
                      return (
                        <tr key={cliente.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                              <span className="capitalize">{nombre}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {cliente.sucursal ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {cliente.sucursal}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                            {cliente.email ? (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>{cliente.email}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                            {cliente.telefono ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>{cliente.telefono}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards (Hidden on desktop) */}
          <div className="md:hidden space-y-3">
            {filteredClientes.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center text-gray-500 border border-gray-100 shadow-sm">
                No se encontraron clientes registrados.
              </div>
            ) : (
              filteredClientes.map((cliente) => {
                const nombre = cliente.nombreCompleto || cliente.nombre_completo || '-';
                return (
                  <div key={cliente.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 capitalize text-sm">{nombre}</span>
                      {cliente.sucursal && (
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-semibold">
                          {cliente.sucursal}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500 flex flex-col gap-1 mt-1">
                      {cliente.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span>{cliente.email}</span>
                        </div>
                      )}
                      {cliente.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{cliente.telefono}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Modal Nuevo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Oscuro */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={closeModal}
          ></div>

          {/* Contenido del Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">
                  Nuevo Cliente
                </h2>
              </div>
              {!isSubmitting && (
                <button 
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nombre Completo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombreCompleto}
                  onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Sucursal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Sucursal
                </label>
                <select
                  value={formData.sucursal}
                  onChange={(e) => setFormData({ ...formData, sucursal: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer text-slate-700"
                >
                  <option value="">Seleccione una sucursal</option>
                  <option value="Aguilares">Aguilares</option>
                  <option value="Famaillá">Famaillá</option>
                  <option value="Concepción">Concepción</option>
                  <option value="Monteros">Monteros</option>
                  <option value="Simoca">Simoca</option>
                </select>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Número de teléfono
                </label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="3865-123456"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Acciones */}
              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none h-12 px-6 font-medium text-gray-600 hover:bg-gray-100 rounded-2xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-12 px-6 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-sm shadow-indigo-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
