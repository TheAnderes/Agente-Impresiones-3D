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

// Inicializar el cliente real si está configurado, o dejarlo como nulo si usaremos simulación
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Interfaz para Tipos de Datos
export interface ModelData {
  id?: string
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
  status: 'queued' | 'heating' | 'leveling' | 'printing' | 'paused' | 'completed' | 'failed'
  progress: number
  filament_used_g: number
  elapsed_time_min: number
  total_time_min: number
  nozzle_temp: number
  bed_temp: number
  created_at?: string
}

export interface AIChat {
  id: string
  model_id: string
  created_at?: string
}

export interface AIMessage {
  id?: string
  chat_id: string
  sender: 'user' | 'assistant'
  content: string
  created_at?: string
}

// ==========================================
// SERVICIO DE ABSTRACCIÓN (REAL O LOCAL)
// ==========================================

// Helper para claves de LocalStorage
const STORAGE_KEYS = {
  MODELS: '3d_print_models',
  JOBS: '3d_print_jobs',
  CHATS: '3d_print_chats',
  MESSAGES: '3d_print_messages'
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
  async getModels(): Promise<ModelData[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error) return data || []
      console.error('Error cargando modelos de Supabase, usando fallback local:', error)
    }
    return loadLocal<ModelData>(STORAGE_KEYS.MODELS)
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
        console.error('Error guardando modelo en Supabase, usando fallback local:', error)
    }

    const localModels = loadLocal<ModelData>(STORAGE_KEYS.MODELS)
    localModels.unshift(newModel)
    saveLocal(STORAGE_KEYS.MODELS, localModels)
    return newModel
  },

  // --- TRABAJOS DE IMPRESIÓN ---
  async getPrintJobs(): Promise<PrintJob[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error) return data || []
    }
    return loadLocal<PrintJob>(STORAGE_KEYS.JOBS)
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
      console.error('Error guardando trabajo en Supabase, usando fallback local:', error)
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
      console.error('Error actualizando trabajo en Supabase, usando fallback local:', error)
    }

    const localJobs = loadLocal<PrintJob>(STORAGE_KEYS.JOBS)
    const index = localJobs.findIndex(j => j.id === id)
    if (index !== -1) {
      localJobs[index] = { ...localJobs[index], ...updates }
      saveLocal(STORAGE_KEYS.JOBS, localJobs)
    }
  },

  // --- CHATS E HISTORIAL DE IA ---
  async createChat(modelId: string): Promise<string> {
    const chatId = crypto.randomUUID()
    const newChat: AIChat = {
      id: chatId,
      model_id: modelId,
      created_at: new Date().toISOString()
    }

    if (supabase) {
      const { error } = await supabase
        .from('ai_chats')
        .insert([newChat])
      if (!error) return chatId
      console.error('Error creando chat en Supabase, usando fallback local:', error)
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
      console.error('Error guardando mensaje en Supabase, usando fallback local:', error)
    }

    const localMessages = loadLocal<AIMessage>(STORAGE_KEYS.MESSAGES)
    localMessages.push(newMessage)
    saveLocal(STORAGE_KEYS.MESSAGES, localMessages)
    return newMessage
  }
}
