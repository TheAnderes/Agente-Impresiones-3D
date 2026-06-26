<template>
  <v-card class="glass-card flex-grow-1 d-flex flex-column h-100" min-height="500">
    <!-- Cabecera Admin -->
    <v-card-item class="pb-2">
      <template v-slot:prepend>
        <v-icon color="secondary" class="me-2">mdi-shield-account</v-icon>
      </template>
      <v-card-title class="font-weight-bold">Consola de Administración</v-card-title>
      <v-card-subtitle>Gestión de roles de usuario, permisos y base de datos</v-card-subtitle>
    </v-card-item>

    <v-divider class="mx-4 border-opacity-25"></v-divider>

    <!-- Pestañas de control -->
    <v-tabs v-model="activeTab" density="comfortable" color="secondary" class="px-4 border-bottom-dark">
      <v-tab value="users" prepend-icon="mdi-account-group">Usuarios y Roles</v-tab>
      <v-tab value="jobs" prepend-icon="mdi-printer-3d-nozzle-outline">Impresiones Globales</v-tab>
    </v-tabs>

    <!-- Contenido de las pestañas -->
    <div class="card-scroll-content px-4 py-3 flex-grow-1">
      <v-window v-model="activeTab">
        <!-- 1. GESTIÓN DE USUARIOS Y ROLES -->
        <v-window-item value="users">
          <div class="d-flex justify-space-between align-center mb-4">
            <span class="text-subtitle-2 text-grey-darken-1">Usuarios registrados en la base de datos:</span>
            <v-btn size="small" color="secondary" variant="outlined" prepend-icon="mdi-refresh" @click="loadProfiles" :loading="loading">
              Refrescar
            </v-btn>
          </div>

          <v-table theme="dark" class="bg-transparent border-dark-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-white">Nombre Completo</th>
                <th class="text-left font-weight-bold text-white">Usuario</th>
                <th class="text-left font-weight-bold text-white">Rol de Acceso</th>
                <th class="text-center font-weight-bold text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="profile in profiles" :key="profile.id">
                <td>
                  <div class="font-weight-bold">{{ profile.full_name }}</div>
                  <div class="text-caption text-grey-darken-2 monospace">{{ profile.id }}</div>
                </td>
                <td class="monospace text-primary">@{{ profile.username }}</td>
                <td>
                  <v-chip :color="getRoleColor(profile.role)" size="small" class="font-weight-bold">
                    {{ getRoleText(profile.role) }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <!-- Selector de Rol para cambiar permisos en vivo -->
                  <v-menu>
                    <template v-slot:activator="{ props }">
                      <v-btn
                        v-bind="props"
                        color="secondary"
                        variant="tonal"
                        size="small"
                        prepend-icon="mdi-cog"
                        class="text-none"
                        :disabled="profile.id === currentUserId" 
                      >
                        Cambiar Rol
                      </v-btn>
                    </template>
                    <v-list theme="dark" class="bg-surface-light border-dark-list">
                      <v-list-item @click="changeUserRole(profile.id, 'guest')">
                        <v-list-item-title class="text-body-2 text-grey d-flex align-center">
                          <v-icon size="16" class="me-2" color="grey">mdi-eye</v-icon>
                          Invitado (Lectura)
                        </v-list-item-title>
                      </v-list-item>
                      <v-list-item @click="changeUserRole(profile.id, 'operator')">
                        <v-list-item-title class="text-body-2 text-primary d-flex align-center">
                          <v-icon size="16" class="me-2" color="primary">mdi-printer-3d</v-icon>
                          Operador (Escritura)
                        </v-list-item-title>
                      </v-list-item>
                      <v-list-item @click="changeUserRole(profile.id, 'admin')">
                        <v-list-item-title class="text-body-2 text-secondary d-flex align-center">
                          <v-icon size="16" class="me-2" color="secondary">mdi-shield-account</v-icon>
                          Administrador (Total)
                        </v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                  <span v-if="profile.id === currentUserId" class="text-caption text-grey-darken-2 font-italic">Tú (Bloqueado)</span>
                </td>
              </tr>
              <tr v-if="profiles.length === 0">
                <td colspan="4" class="text-center py-8 text-grey-darken-2">
                  No se encontraron perfiles de usuario en el sistema.
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>

        <!-- 2. GESTIÓN DE TRABAJOS DE IMPRESIÓN GLOBAL -->
        <v-window-item value="jobs">
          <div class="d-flex justify-space-between align-center mb-4">
            <span class="text-subtitle-2 text-grey-darken-1">Registro global de cotizaciones e impresiones:</span>
            <v-btn size="small" color="secondary" variant="outlined" prepend-icon="mdi-refresh" @click="loadPrintJobs" :loading="loading">
              Refrescar
            </v-btn>
          </div>

          <v-table theme="dark" class="bg-transparent border-dark-table">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-white">Detalle de Trabajo</th>
                <th class="text-left font-weight-bold text-white">Parámetros</th>
                <th class="text-left font-weight-bold text-white">Estado</th>
                <th class="text-center font-weight-bold text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="job in printJobs" :key="job.id">
                <td>
                  <div class="font-weight-bold text-white">ID: {{ job.id?.slice(0, 8) }}...</div>
                  <div class="text-caption text-grey-darken-2 block">Vinc. Modelo ID: {{ job.model_id.slice(0, 8) }}...</div>
                  <div class="text-caption text-grey-darken-2 monospace">{{ formatDate(job.created_at) }}</div>
                </td>
                <td>
                  <div class="text-body-2">Material: <strong>{{ job.filament_used_g.toFixed(1) }}g</strong> de <v-chip size="x-small" color="primary" class="font-weight-bold">{{ getFilamentType(job.model_id) }}</v-chip></div>
                  <div class="text-caption text-grey-darken-2">Tiempo: {{ job.elapsed_time_min }} / {{ job.total_time_min }} min</div>
                </td>
                <td>
                  <div class="d-flex align-center">
                    <v-chip :color="getStatusColor(job.status)" size="small" class="font-weight-bold me-2">
                      {{ getStatusText(job.status) }}
                    </v-chip>
                    <span class="text-caption font-weight-bold text-primary">{{ Math.round(job.progress) }}%</span>
                  </div>
                </td>
                <td class="text-center">
                  <v-btn
                    color="error"
                    variant="tonal"
                    size="small"
                    icon="mdi-trash-can-outline"
                    @click="deleteJob(job.id!)"
                    title="Eliminar de base de datos"
                  ></v-btn>
                </td>
              </tr>
              <tr v-if="printJobs.length === 0">
                <td colspan="4" class="text-center py-8 text-grey-darken-2">
                  No hay registros de impresión en la base de datos global.
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>
      </v-window>
    </div>
  </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue'
import { dbService } from '../lib/supabase'
import type { AdminProfile, PrintJob, ModelData } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const activeTab = ref<'users' | 'jobs'>('users')
const profiles = ref<AdminProfile[]>([])
const printJobs = ref<PrintJob[]>([])
const models = ref<ModelData[]>([])
const loading = ref(false)

const currentUserId = computed(() => authStore.profile?.id || '')

// Cargar perfiles desde dbService
const loadProfiles = async () => {
  loading.value = true
  try {
    profiles.value = await dbService.getProfilesAdmin()
  } catch (err) {
    console.error('Error cargando perfiles admin:', err)
  } finally {
    loading.value = false
  }
}

// Cargar trabajos globales desde dbService
const loadPrintJobs = async () => {
  loading.value = true
  try {
    // Pasar undefined para user_id y 'admin' para role para que devuelva todo
    printJobs.value = await dbService.getPrintJobs(undefined, 'admin')
    models.value = await dbService.getModels(undefined, 'admin')
  } catch (err) {
    console.error('Error cargando impresiones globales:', err)
  } finally {
    loading.value = false
  }
}

// Cambiar rol de usuario en base de datos
const changeUserRole = async (userId: string, role: 'admin' | 'operator' | 'guest') => {
  try {
    await dbService.updateProfileRoleAdmin(userId, role)
    
    // Si estamos en modo simulación local y cambiamos el rol del usuario activo,
    // actualizamos la sesión
    if (authStore.isLocalMode && userId === currentUserId.value) {
      authStore.initializeAuth()
    }
    
    await loadProfiles()
  } catch (err) {
    console.error('Error actualizando rol:', err)
  }
}

// Eliminar un trabajo de la base de datos
const deleteJob = async (jobId: string) => {
  if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este registro de impresión?')) return
  try {
    await dbService.deletePrintJob(jobId)
    await loadPrintJobs()
  } catch (err) {
    console.error('Error eliminando trabajo:', err)
  }
}

// Obtener filamento mapeando el model_id
const getFilamentType = (modelId: string): string => {
  const found = models.value.find(m => m.id === modelId)
  return found ? found.filament_type : 'PLA'
}

// ==========================================
// FORMATOS Y COLORES
// ==========================================

const getRoleText = (role: string) => {
  switch (role) {
    case 'admin': return 'Administrador'
    case 'operator': return 'Operador'
    case 'guest': return 'Invitado'
    default: return role
  }
}

const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin': return 'secondary'
    case 'operator': return 'primary'
    case 'guest': return 'grey'
    default: return 'white'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'queued': return 'En Cola'
    case 'heating': return 'Calentando'
    case 'leveling': return 'Nivelando'
    case 'printing': return 'Imprimiendo'
    case 'paused': return 'Pausado'
    case 'completed': return 'Completado'
    case 'failed': return 'Abortado'
    default: return status
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'queued': return 'grey'
    case 'heating': return 'warning'
    case 'leveling': return 'info'
    case 'printing': return 'primary'
    case 'paused': return 'amber'
    case 'completed': return 'success'
    case 'failed': return 'error'
    default: return 'white'
  }
}

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Cargar datos al montar
onMounted(() => {
  loadProfiles()
  loadPrintJobs()
})

// Recargar al cambiar de tab
watch(activeTab, (newTab) => {
  if (newTab === 'users') loadProfiles()
  else loadPrintJobs()
})
</script>

<style scoped>
.glass-card {
  background: rgba(15, 23, 42, 0.45) !important;
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2) !important;
}

.border-bottom-dark {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.border-dark-table {
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  overflow: hidden;
}

.border-dark-table th {
  background: rgba(0, 0, 0, 0.25) !important;
  border-bottom: 1.5px solid rgba(255, 255, 255, 0.08) !important;
}

.border-dark-table td {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
}

.bg-surface-light {
  background: #182235 !important;
}

.border-dark-list {
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.card-scroll-content {
  overflow-y: auto;
  max-height: calc(100vh - 210px);
}

.monospace {
  font-family: 'Courier New', Courier, monospace !important;
}
</style>
