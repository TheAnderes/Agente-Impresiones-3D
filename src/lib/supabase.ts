import { createClient } from '@supabase/supabase-js'

// Intentar obtener las variables de entorno de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Verificar si son las claves por defecto o están vacías para usar simulación local
const isDefaultOrEmpty = (url: string, key: string) => {
  return (
    !url ||
    !key ||
    url.includes('your-project-id') ||
    key.includes('your-anon-public')
  )
}

export const isSupabaseConfigured = !isDefaultOrEmpty(supabaseUrl, supabaseAnonKey)

// Inicializar el cliente real si está configurado
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Interfaz para Tipos de Datos
export interface ModelData {
  id?: string
  user_id?: string
  name: string
  volume_cm3: number
  bounding_box_x: number
  bounding_box_y: number
  bounding_box_z: number
  estimated_weight_g: number
  estimated_time_min: number
  filament_type: string
  infill_percent: number
  layer_height_mm: number
  file_url?: string
  created_at?: string
}

export interface PrintJob {
  id?: string
  model_id: string
  user_id?: string
  status: 'queued' | 'heating' | 'leveling' | 'printing' | 'paused' | 'completed' | 'failed'
  progress: number
  filament_used_g: number
  elapsed_time_min: number
  total_time_min: number
  nozzle_temp: number
  bed_temp: number
  created_at?: string
  model_name?: string // Campo virtual para conveniencia
}

export interface AIChat {
  id: string
  model_id: string
  user_id?: string
  created_at?: string
}

export interface AIMessage {
  id?: string
  chat_id: string
  sender: 'user' | 'assistant'
  content: string
  created_at?: string
}

export interface AdminProfile {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'operator' | 'guest'
  created_at?: string
}

// Helper para claves de LocalStorage
const STORAGE_KEYS = {
  MODELS: '3d_print_models',
  JOBS: '3d_print_jobs',
  CHATS: '3d_print_chats',
  MESSAGES: '3d_print_messages',
  USERS: 'papois_registered_users'
}

// Cargar de LocalStorage
const loadLocal = <T>(key: string): T[] => {
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : []
}

// Guardar en LocalStorage
const saveLocal = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data))
}

export const dbService = {
  // --- MODELOS ---
  async getModels(userId?: string, role?: string): Promise<ModelData[]> {
    if (supabase) {
      let query = supabase.from('models').select('*')
      
      // Si no es admin, filtrar por su propio user_id
      if (role !== 'admin' && userId) {
        query = query.eq('user_id', userId)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      if (!error) return data || []
      console.error('Error cargando modelos de Supabase:', error)
    }
    
    // Fallback local
    const localModels = loadLocal<ModelData>(STORAGE_KEYS.MODELS)
    if (role === 'admin' || !userId) {
      return localModels
    }
    return localModels.filter(m => m.user_id === userId || m.user_id === 'guest-id')
  },

  async saveModel(model: ModelData): Promise<ModelData> {
    const newModel = {
      ...model,
      id: model.id || crypto.randomUUID(),
      created_at: model.created_at || new Date().toISOString()
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('models')
        .insert([newModel])
        .select()
      if (!error && data && data[0]) {
        return data[0]
      }
      console.error('Error guardando modelo en Supabase:', error)
    }

    const localModels = loadLocal<ModelData>(STORAGE_KEYS.MODELS)
    localModels.unshift(newModel)
    saveLocal(STORAGE_KEYS.MODELS, localModels)
    return newModel
  },

  async deleteModel(modelId: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', modelId)
      if (!error) return
      console.error('Error eliminando modelo en Supabase:', error)
    }

    const localModels = loadLocal<ModelData>(STORAGE_KEYS.MODELS)
    const filtered = localModels.filter(m => m.id !== modelId)
    saveLocal(STORAGE_KEYS.MODELS, filtered)
  },

  // --- TRABAJOS DE IMPRESIÓN ---
  async getPrintJobs(userId?: string, role?: string): Promise<PrintJob[]> {
    if (supabase) {
      let query = supabase.from('print_jobs').select('*')
      
      if (role !== 'admin' && userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (!error) return data || []
    }

    const localJobs = loadLocal<PrintJob>(STORAGE_KEYS.JOBS)
    if (role === 'admin' || !userId) {
      return localJobs
    }
    return localJobs.filter(j => j.user_id === userId || j.user_id === 'guest-id')
  },

  async savePrintJob(job: PrintJob): Promise<PrintJob> {
    const newJob = {
      ...job,
      id: job.id || crypto.randomUUID(),
      created_at: job.created_at || new Date().toISOString()
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('print_jobs')
        .insert([newJob])
        .select()
      if (!error && data && data[0]) {
        return data[0]
      }
      console.error('Error guardando trabajo en Supabase:', error)
    }

    const localJobs = loadLocal<PrintJob>(STORAGE_KEYS.JOBS)
    localJobs.unshift(newJob)
    saveLocal(STORAGE_KEYS.JOBS, localJobs)
    return newJob
  },

  async updatePrintJobStatus(id: string, updates: Partial<PrintJob>): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('print_jobs')
        .update(updates)
        .eq('id', id)
      if (!error) return
      console.error('Error actualizando trabajo en Supabase:', error)
    }

    const localJobs = loadLocal<PrintJob>(STORAGE_KEYS.JOBS)
    const index = localJobs.findIndex(j => j.id === id)
    if (index !== -1) {
      localJobs[index] = { ...localJobs[index], ...updates }
      saveLocal(STORAGE_KEYS.JOBS, localJobs)
    }
  },

  async deletePrintJob(jobId: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('print_jobs')
        .delete()
        .eq('id', jobId)
      if (!error) return
      console.error('Error eliminando trabajo en Supabase:', error)
    }

    const localJobs = loadLocal<PrintJob>(STORAGE_KEYS.JOBS)
    const filtered = localJobs.filter(j => j.id !== jobId)
    saveLocal(STORAGE_KEYS.JOBS, filtered)
  },

  // --- CHATS E HISTORIAL DE IA ---
  async createChat(modelId: string, userId?: string): Promise<string> {
    const chatId = crypto.randomUUID()
    const newChat: AIChat = {
      id: chatId,
      model_id: modelId,
      user_id: userId || 'guest-id',
      created_at: new Date().toISOString()
    }

    if (supabase) {
      const { error } = await supabase
        .from('ai_chats')
        .insert([newChat])
      if (!error) return chatId
      console.error('Error creando chat en Supabase:', error)
    }

    const localChats = loadLocal<AIChat>(STORAGE_KEYS.CHATS)
    localChats.push(newChat)
    saveLocal(STORAGE_KEYS.CHATS, localChats)
    return chatId
  },

  async getChatMessages(chatId: string): Promise<AIMessage[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
      if (!error) return data || []
    }

    const localMessages = loadLocal<AIMessage>(STORAGE_KEYS.MESSAGES)
    return localMessages.filter(m => m.chat_id === chatId)
  },

  async saveChatMessage(message: AIMessage): Promise<AIMessage> {
    const newMessage = {
      ...message,
      id: message.id || crypto.randomUUID(),
      created_at: message.created_at || new Date().toISOString()
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('ai_messages')
        .insert([newMessage])
        .select()
      if (!error && data && data[0]) {
        return data[0]
      }
      console.error('Error guardando mensaje en Supabase:', error)
    }

    const localMessages = loadLocal<AIMessage>(STORAGE_KEYS.MESSAGES)
    localMessages.push(newMessage)
    saveLocal(STORAGE_KEYS.MESSAGES, localMessages)
    return newMessage
  },

  // ==========================================
  // METODOS EXCLUSIVOS DE ADMINISTRACIÓN
  // ==========================================

  // Obtener lista completa de usuarios
  async getProfilesAdmin(): Promise<AdminProfile[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, role, created_at')
        .order('created_at', { ascending: false })
      if (!error) return data as AdminProfile[]
      console.error('Error obteniendo perfiles de Supabase:', error)
    }

    // Fallback local: recuperar perfiles del registro local de pruebas
    const localUsers = loadLocal<any>(STORAGE_KEYS.USERS)
    
    // Cuentas por defecto fijas para simulación
    const defaultUsers: AdminProfile[] = [
      { id: 'admin-id', username: 'admin_papois', full_name: 'Administrador General', role: 'admin', created_at: new Date().toISOString() },
      { id: 'operator-id', username: 'operador_3d', full_name: 'Operador de Impresión', role: 'operator', created_at: new Date().toISOString() },
      { id: 'guest-id', username: 'invitado', full_name: 'Usuario Invitado', role: 'guest', created_at: new Date().toISOString() }
    ]

    const customUsers = localUsers.map((u: any) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role || 'operator',
      created_at: new Date().toISOString()
    }))

    return [...defaultUsers, ...customUsers]
  },

  // Modificar el rol de un usuario
  async updateProfileRoleAdmin(profileId: string, newRole: 'admin' | 'operator' | 'guest'): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId)
      if (!error) return
      console.error('Error actualizando rol de perfil en Supabase:', error)
    }

    // Fallback local
    // Si es un usuario registrado localmente, actualizar su base local
    const localUsers = loadLocal<any>(STORAGE_KEYS.USERS)
    const index = localUsers.findIndex((u: any) => u.id === profileId)
    if (index !== -1) {
      localUsers[index].role = newRole
      saveLocal(STORAGE_KEYS.USERS, localUsers)
    }

    // Si coincide con la sesión activa localmente, forzar recarga en el store
    const localSession = localStorage.getItem('papois_auth_session')
    if (localSession) {
      const sessionData = JSON.parse(localSession)
      if (sessionData.profile.id === profileId) {
        sessionData.profile.role = newRole
        localStorage.setItem('papois_auth_session', JSON.stringify(sessionData))
      }
    }
  }
}
