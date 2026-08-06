import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL o Anon Key no configuradas. ' +
    'Creá un archivo .env en la raíz del proyecto con:\n' +
    'VITE_SUPABASE_URL=tu-url\n' +
    'VITE_SUPABASE_ANON_KEY=tu-anon-key'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
