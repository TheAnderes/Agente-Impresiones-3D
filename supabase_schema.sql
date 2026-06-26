-- Esquema SQL para el proyecto 3d-analisis-ia
-- Copia y pega esto en el editor SQL de tu panel de Supabase para configurar las tablas necesarias.

-- 1. Tabla de perfiles de usuario (extiende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar Row Level Security (RLS) para perfiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfiles públicos son visibles para todos" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. Tabla de modelos 3D cargados
CREATE TABLE IF NOT EXISTS public.models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    volume_cm3 DOUBLE PRECISION,
    bounding_box_x DOUBLE PRECISION, -- Ancho en mm
    bounding_box_y DOUBLE PRECISION, -- Largo en mm
    bounding_box_z DOUBLE PRECISION, -- Alto en mm
    estimated_weight_g DOUBLE PRECISION,
    estimated_time_min INT,
    filament_type TEXT DEFAULT 'PLA',
    infill_percent INT DEFAULT 15,
    layer_height_mm DOUBLE PRECISION DEFAULT 0.2,
    file_url TEXT, -- Opcional si se sube a Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede ver modelos (Simulado)" ON public.models
    FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar modelos" ON public.models
    FOR INSERT WITH CHECK (true);

-- 3. Tabla de trabajos de impresión (Print Jobs)
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'queued', -- queued, heating, printing, paused, completed, failed
    progress DOUBLE PRECISION DEFAULT 0.0,
    filament_used_g DOUBLE PRECISION DEFAULT 0.0,
    elapsed_time_min INT DEFAULT 0,
    total_time_min INT DEFAULT 0,
    nozzle_temp DOUBLE PRECISION DEFAULT 0.0,
    bed_temp DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver trabajos de impresión públicamente" ON public.print_jobs
    FOR SELECT USING (true);

CREATE POLICY "Crear/actualizar trabajos de impresión" ON public.print_jobs
    FOR ALL USING (true);

-- 4. Tabla de conversaciones de chat con IA
CREATE TABLE IF NOT EXISTS public.ai_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver chats propios o públicos" ON public.ai_chats
    FOR SELECT USING (true);

CREATE POLICY "Crear chats" ON public.ai_chats
    FOR INSERT WITH CHECK (true);

-- 5. Tabla de mensajes individuales de chat con IA
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.ai_chats(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'user' o 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver mensajes" ON public.ai_messages
    FOR SELECT USING (true);

CREATE POLICY "Insertar mensajes" ON public.ai_messages
    FOR INSERT WITH CHECK (true);

-- 6. Trigger para crear perfil al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', new.email),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Descomenta la siguiente línea una vez subida a Supabase si deseas automatizar perfiles de usuario:
-- CREATE OR REPLACE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
