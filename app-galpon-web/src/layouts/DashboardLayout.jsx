import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Home,
  Package, 
  Users, 
  ShoppingCart, 
  LineChart, 
  Truck, 
  LogOut, 
  Menu, 
  X,
  Candy,
  FileText,
  Sparkles
} from 'lucide-react';

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { to: '/inicio', icon: Home, label: 'Inicio' },
    { to: '/lo-nuevo', icon: Sparkles, label: 'Lo Nuevo' },
    { to: '/productos', icon: Package, label: 'Productos' },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/ventas', icon: ShoppingCart, label: 'Ventas' },
    { to: '/consultas', icon: LineChart, label: 'Consulta de Ventas' },
    { to: '/compras', icon: Truck, label: 'Compras' },
    { to: '/historial-compras', icon: FileText, label: 'Historial de Compras' },
  ];

  const SidebarContent = () => (
    <>
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center bg-indigo-600 text-white font-black text-xl rounded-lg h-10 w-10 shadow-md shrink-0">
            TG
          </div>
          <span className="font-bold text-lg text-slate-800 transition-opacity duration-300 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100">
            Todo Golosina
          </span>
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto overflow-x-hidden no-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setIsSidebarOpen(false)}
            className={({ isActive }) => `
              ${item.to === '/compras' ? 'hidden md:flex' : 'flex'} items-center gap-4 px-4 py-3 rounded-lg transition-colors
              ${isActive 
                ? 'bg-blue-50 text-blue-700 font-semibold' 
                : 'text-gray-600 hover:bg-gray-100 font-medium'}
            `}
          >
            <item.icon className="w-6 h-6 shrink-0" />
            <span className="transition-opacity duration-300 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 font-medium text-slate-700">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 overflow-hidden">
        <button
          onClick={handleLogout}
          className="flex items-center gap-4 px-4 py-3 w-full rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <LogOut className="w-6 h-6 shrink-0" />
          <span className="transition-opacity duration-300 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 font-medium text-slate-700">
            Cerrar Sesión
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col transform transition-all duration-300 ease-in-out group
        w-64 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:w-20 md:hover:w-64 md:fixed md:z-40 md:h-screen md:overflow-x-hidden
      `}>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:ml-20 transition-all duration-300">
        {/* Mobile Top Header */}
        <header className="flex items-center justify-between p-4 bg-white border-b shadow-sm w-full md:hidden">
          <div className="flex items-center justify-center bg-indigo-600 text-white font-black text-xl rounded-lg h-10 w-10 shadow-md">
            TG
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-gray-100 text-slate-600"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
