import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface UserProfile {
  id: string
  username: string
  full_name: string
  avatar_url: string
  role: 'admin' | 'operator' | 'guest'
  created_at?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any | null>(null)
  const profile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const isLocalMode = ref(!isSupabaseConfigured)

  // Inicializar autenticación y recuperar sesión activa
  const initializeAuth = async () => {
    loading.value = true
    if (isSupabaseConfigured && supabase) {
      // 1. Caso Supabase Real
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          user.value = session.user
          await fetchProfile(session.user.id)
        } else {
          // Si no hay sesión, establecer como invitado por defecto
          setGuestSession()
        }
      } catch (err) {
        console.error('Error al inicializar sesión en Supabase:', err)
        setGuestSession()
      }
    } else {
      // 2. Caso Simulado Local
      const localSession = localStorage.getItem('papois_auth_session')
      if (localSession) {
        const sessionData = JSON.parse(localSession)
        user.value = sessionData.user
        profile.value = sessionData.profile
      } else {
        setGuestSession()
      }
    }
    loading.value = false
  }

  // Establecer sesión de invitado por defecto
  const setGuestSession = () => {
    user.value = { id: 'guest-id', email: 'invitado@papois.com' }
    profile.value = {
      id: 'guest-id',
      username: 'invitado',
      full_name: 'Usuario Invitado',
      avatar_url: '',
      role: 'guest'
    }
  }

  // Obtener perfil del usuario desde base de datos
  const fetchProfile = async (userId: string) => {
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && data) {
        profile.value = data as UserProfile
      } else {
        console.error('Error cargando perfil de Supabase:', error)
        // Fallback preventivo
        profile.value = {
          id: userId,
          username: 'usuario',
          full_name: 'Usuario Registrado',
          avatar_url: '',
          role: 'operator'
        }
      }
    }
  }

  // Iniciar Sesión
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    loading.value = true
    
    if (isSupabaseConfigured && supabase) {
      // 1. Caso Supabase Real
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
        
        user.value = data.user
        await fetchProfile(data.user!.id)
        
        loading.value = false
        return { success: true }
      } catch (err: any) {
        loading.value = false
        return { success: false, error: err.message || 'Credenciales inválidas' }
      }
    } else {
      // 2. Caso Simulado Local (Para testing de roles de forma inmediata)
      await new Promise(resolve => setTimeout(resolve, 800)) // Demora estética
      
      // Administrador por defecto
      if (email === 'admin@papois.com') {
        user.value = { id: 'admin-id', email: 'admin@papois.com' }
        profile.value = {
          id: 'admin-id',
          username: 'admin_papois',
          full_name: 'Administrador General',
          avatar_url: '',
          role: 'admin'
        }
      } 
      // Operador por defecto
      else if (email === 'operator@papois.com') {
        user.value = { id: 'operator-id', email: 'operator@papois.com' }
        profile.value = {
          id: 'operator-id',
          username: 'operador_3d',
          full_name: 'Operador de Impresión',
          avatar_url: '',
          role: 'operator'
        }
      } 
      // Buscar en perfiles registrados en LocalStorage
      else {
        const localUsers = JSON.parse(localStorage.getItem('papois_registered_users') || '[]')
        const found = localUsers.find((u: any) => u.email === email && u.password === password)
        
        if (found) {
          user.value = { id: found.id, email: found.email }
          profile.value = {
            id: found.id,
            username: found.username,
            full_name: found.full_name,
            avatar_url: '',
            role: found.role || 'operator'
          }
        } else {
          loading.value = false
          return { success: false, error: 'Usuario no registrado o contraseña incorrecta en simulación local.' }
        }
      }

      // Guardar sesión local
      localStorage.setItem('papois_auth_session', JSON.stringify({
        user: user.value,
        profile: profile.value
      }))
      
      loading.value = false
      return { success: true }
    }
  }

  // Registrar Usuario
  const register = async (
    email: string,
    password: string,
    username: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> => {
    loading.value = true

    if (isSupabaseConfigured && supabase) {
      // 1. Caso Supabase Real
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              full_name: fullName
            }
          }
        })
        if (error) throw error

        // Nota: El disparador SQL handle_new_user creará automáticamente
        // la fila correspondiente en public.profiles.
        user.value = data.user
        
        // Esperar un momento a que se propague el trigger y cargar perfil
        await new Promise(resolve => setTimeout(resolve, 1000))
        if (data.user) {
          await fetchProfile(data.user.id)
        }
        
        loading.value = false
        return { success: true }
      } catch (err: any) {
        loading.value = false
        return { success: false, error: err.message || 'Error al registrar usuario' }
      }
    } else {
      // 2. Caso Simulado Local
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const localUsers = JSON.parse(localStorage.getItem('papois_registered_users') || '[]')
      if (localUsers.some((u: any) => u.email === email)) {
        loading.value = false
        return { success: false, error: 'El correo ya se encuentra registrado localmente.' }
      }

      const newUserId = crypto.randomUUID()
      // Asignar rol admin si el correo empieza con admin, de lo contrario operator
      const assignedRole = 'admin'
      
      const newMockUser = {
        id: newUserId,
        email,
        password,
        username,
        full_name: fullName,
        role: assignedRole
      }
      
      localUsers.push(newMockUser)
      localStorage.setItem('papois_registered_users', JSON.stringify(localUsers))

      // Iniciar sesión inmediatamente
      user.value = { id: newUserId, email }
      profile.value = {
        id: newUserId,
        username,
        full_name: fullName,
        avatar_url: '',
        role: assignedRole
      }

      localStorage.setItem('papois_auth_session', JSON.stringify({
        user: user.value,
        profile: profile.value
      }))

      loading.value = false
      return { success: true }
    }
  }

  // Cerrar Sesión
  const logout = async () => {
    loading.value = true
    
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    } else {
      localStorage.removeItem('papois_auth_session')
    }

    setGuestSession()
    loading.value = false
  }

  // Comprobación rápida de permisos
  const hasRole = (roles: ('admin' | 'operator' | 'guest')[]) => {
    return profile.value ? roles.includes(profile.value.role) : false
  }

  return {
    user,
    profile,
    loading,
    isLocalMode,
    initializeAuth,
    login,
    register,
    logout,
    hasRole
  }
})
