-- Esquema SQL Completo para el proyecto PAPOIS EN 3D
-- Copia e instala este script en el editor SQL de tu panel de Supabase para configurar la base de datos con Roles y Permisos.

-- 1. Tabla de perfiles de usuario con soporte de Roles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'guest')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar Row Level Security (RLS) para perfiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles
CREATE POLICY "Perfiles son legibles por usuarios autenticados" ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios pueden actualizar su propio perfil básico" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins tienen control total sobre todos los perfiles" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 2. Tabla de modelos 3D cargados y vinculados a usuarios
CREATE TABLE IF NOT EXISTS public.models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    volume_cm3 DOUBLE PRECISION,
    bounding_box_x DOUBLE PRECISION, -- mm
    bounding_box_y DOUBLE PRECISION, -- mm
    bounding_box_z DOUBLE PRECISION, -- mm
    estimated_weight_g DOUBLE PRECISION,
    estimated_time_min INT,
    filament_type TEXT DEFAULT 'PLA',
    infill_percent INT DEFAULT 15,
    layer_height_mm DOUBLE PRECISION DEFAULT 0.2,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

-- Políticas para Models
CREATE POLICY "Usuarios pueden ver sus propios modelos" ON public.models
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Operadores y Admins pueden guardar modelos" ON public.models
    FOR INSERT WITH CHECK (
        (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('operator', 'admin')))
    );

CREATE POLICY "Usuarios pueden borrar sus propios modelos" ON public.models
    FOR DELETE USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. Tabla de trabajos de impresión (Print Jobs)
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'heating', 'leveling', 'printing', 'paused', 'completed', 'failed')),
    progress DOUBLE PRECISION DEFAULT 0.0,
    filament_used_g DOUBLE PRECISION DEFAULT 0.0,
    elapsed_time_min INT DEFAULT 0,
    total_time_min INT DEFAULT 0,
    nozzle_temp DOUBLE PRECISION DEFAULT 0.0,
    bed_temp DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas para Print Jobs
CREATE POLICY "Usuarios pueden ver sus propios trabajos de impresión" ON public.print_jobs
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Operadores y Admins pueden crear trabajos de impresión" ON public.print_jobs
    FOR INSERT WITH CHECK (
        (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('operator', 'admin')))
    );

CREATE POLICY "Usuarios pueden actualizar sus propios trabajos de impresión" ON public.print_jobs
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins pueden borrar cualquier trabajo" ON public.print_jobs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Tabla de conversaciones de chat con IA
CREATE TABLE IF NOT EXISTS public.ai_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

-- Políticas para AI Chats
CREATE POLICY "Usuarios pueden ver sus propios chats" ON public.ai_chats
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Operadores y Admins pueden crear chats" ON public.ai_chats
    FOR INSERT WITH CHECK (
        (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('operator', 'admin')))
    );

-- 5. Tabla de mensajes de chat con IA
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.ai_chats(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para AI Messages
CREATE POLICY "Usuarios pueden ver mensajes de sus propios chats" ON public.ai_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.ai_chats 
            WHERE id = chat_id AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
        )
    );

CREATE POLICY "Usuarios pueden insertar mensajes en sus chats" ON public.ai_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_chats 
            WHERE id = chat_id AND user_id = auth.uid()
        )
    );

-- 6. Trigger automático para perfiles y asignación de roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT := 'operator';
BEGIN
  -- Si es el primer usuario o tiene un correo específico, podemos darle rol de admin
  IF new.email = 'admin@papois.com' OR new.email LIKE '%@papois.com' AND new.email LIKE 'admin%' THEN
    assigned_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, username, full_name, avatar_url, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario PAPOIS'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    assigned_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Descomenta esto para vincular el registro de Supabase Auth con la tabla profiles:
-- CREATE OR REPLACE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
