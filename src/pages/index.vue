<template>
  <v-app theme="dark" class="app-bg">
    <!-- BARRA DE NAVEGACIÓN SUPERIOR -->
    <v-app-bar flat class="glass-bar px-4">
      <v-icon color="primary" size="32" class="me-2 animate-glow">mdi-printer-3d-nozzle</v-icon>
      <v-app-bar-title class="font-weight-black tracking-wide text-h6">
        3D <span class="text-primary">ANÁLISIS</span> IA
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <!-- Selector de Vista -->
      <v-btn-toggle
        v-model="activeView"
        mandatory
        variant="flat"
        density="compact"
        color="primary"
        class="glass-toggle me-4"
      >
        <v-btn value="dashboard" prepend-icon="mdi-view-dashboard">Dashboard</v-btn>
        <v-btn value="history" prepend-icon="mdi-history">Historial</v-btn>
      </v-btn-toggle>

      <!-- Indicador de conexión a Supabase -->
      <v-tooltip location="bottom">
        <template v-slot:activator="{ props }">
          <v-chip
            v-bind="props"
            :color="supabaseConnected ? 'success' : 'warning'"
            variant="tonal"
            size="small"
            class="font-weight-bold"
            :prepend-icon="supabaseConnected ? 'mdi-database-check' : 'mdi-database-off'"
          >
            {{ supabaseConnected ? 'Supabase Conectado' : 'Modo Local' }}
          </v-chip>
        </template>
        <span>
          {{ supabaseConnected 
            ? 'Conexión activa con tu base de datos Supabase.' 
            : 'Usando almacenamiento local del navegador. Configura .env.local para conectar Supabase.' }}
        </span>
      </v-tooltip>
    </v-app-bar>

    <!-- CONTENIDO PRINCIPAL -->
    <v-main class="pt-16">
      <v-container fluid class="pa-4 fill-height align-start">
        <!-- VISTA DE DASHBOARD -->
        <v-row v-if="activeView === 'dashboard'" class="fill-height ma-0" dense>
          <!-- PANEL IZQUIERDO: ANALIZADOR Y CONTROL DE PARÁMETROS -->
          <v-col cols="12" md="4" class="pa-2 d-flex flex-column">
            <ModelAnalyzer
              @loaded="onModelLoaded"
              @print="onPrintTriggered"
            />
          </v-col>

          <!-- PANEL CENTRAL: VISOR 3D INTERACTIVO -->
          <v-col cols="12" md="5" class="pa-2 d-flex flex-column">
            <Model3DViewer
              :positions="positions"
              :boundingBoxSize="boundingBoxSize"
              :boundingBoxMin="boundingBoxMin"
              :boundingBoxMax="boundingBoxMax"
            />
          </v-col>

          <!-- PANEL DERECHO: ASISTENTE DE IA / CONSOLA DE IMPRESIÓN -->
          <v-col cols="12" md="3" class="pa-2 d-flex flex-column">
            <!-- Consola de Impresión (Se muestra si hay una impresión activa) -->
            <PrinterConsole
              v-show="isPrintingActive"
              ref="printerConsole"
              :activeModel="activeModel"
              @status-change="onPrinterStatusChange"
              @completed="onPrintCompleted"
            />

            <!-- Chat del Asistente de IA (Se muestra si la impresora está inactiva) -->
            <AIChatAssistant
              v-show="!isPrintingActive"
              :activeModel="activeModel"
            />
          </v-col>
        </v-row>

        <!-- VISTA DE HISTORIAL -->
        <div v-else-if="activeView === 'history'" class="w-100 pa-2">
          <div class="d-flex justify-space-between align-center mb-6">
            <div>
              <h2 class="text-h5 font-weight-black text-white">Historial de Modelos Analizados</h2>
              <p class="text-body-2 text-grey-darken-1">Modelos guardados en tu base de datos</p>
            </div>
            <v-btn
              color="primary"
              variant="outlined"
              prepend-icon="mdi-refresh"
              @click="loadHistory"
              class="text-none"
            >
              Actualizar Historial
            </v-btn>
          </div>

          <!-- Grid de Historial -->
          <v-row v-if="savedModels.length > 0">
            <v-col
              v-for="model in savedModels"
              :key="model.id"
              cols="12"
              sm="6"
              md="4"
              lg="3"
              class="pa-2"
            >
              <v-card class="glass-card h-100 d-flex flex-column">
                <v-card-item class="pb-1">
                  <v-card-title class="text-subtitle-1 font-weight-bold text-truncate" :title="model.name">
                    {{ model.name }}
                  </v-card-title>
                  <v-card-subtitle class="monospace text-caption text-primary">
                    {{ formatDate(model.created_at) }}
                  </v-card-subtitle>
                </v-card-item>

                <!-- Especificaciones Rápidas -->
                <v-card-text class="py-2 flex-grow-1">
                  <div class="d-flex justify-space-between text-body-2 mb-1">
                    <span class="text-grey-darken-1">Volumen:</span>
                    <span class="font-weight-medium text-white">{{ model.volume_cm3.toFixed(2) }} cm³</span>
                  </div>
                  <div class="d-flex justify-space-between text-body-2 mb-1">
                    <span class="text-grey-darken-1">Dimensiones:</span>
                    <span class="font-weight-medium text-white">
                      {{ Math.round(model.bounding_box_x) }}x{{ Math.round(model.bounding_box_y) }}x{{ Math.round(model.bounding_box_z) }} mm
                    </span>
                  </div>
                  <div class="d-flex justify-space-between text-body-2 mb-1">
                    <span class="text-grey-darken-1">Material:</span>
                    <v-chip size="x-small" color="primary" variant="flat" class="font-weight-bold">
                      {{ model.filament_type }}
                    </v-chip>
                  </div>
                  <div class="d-flex justify-space-between text-body-2 mb-1">
                    <span class="text-grey-darken-1">Relleno:</span>
                    <span class="font-weight-medium text-white">{{ model.infill_percent }}%</span>
                  </div>
                  <div class="d-flex justify-space-between text-body-2">
                    <span class="text-grey-darken-1">Peso / Tiempo:</span>
                    <span class="font-weight-medium text-white">
                      {{ model.estimated_weight_g.toFixed(1) }}g / {{ formatMinutes(model.estimated_time_min) }}
                    </span>
                  </div>
                </v-card-text>

                <v-divider class="border-opacity-25"></v-divider>

                <v-card-actions class="pa-2">
                  <v-btn
                    color="primary"
                    variant="tonal"
                    block
                    size="small"
                    prepend-icon="mdi-cube-outline"
                    class="text-none font-weight-bold"
                    @click="loadModelIntoDashboard(model)"
                  >
                    Cargar en Visor
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>

          <!-- Placeholder si está vacío -->
          <div v-else class="d-flex flex-column align-center justify-center py-16 text-center">
            <v-icon size="80" color="grey-darken-3" class="mb-4">mdi-folder-open-outline</v-icon>
            <h3 class="text-h6 text-grey-lighten-1 mb-1">No hay modelos analizados</h3>
            <p class="text-body-2 text-grey-darken-1 max-width-300">
              Sube y analiza archivos STL en la pestaña del Dashboard para registrarlos en la base de datos.
            </p>
          </div>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { isSupabaseConfigured, dbService } from '../lib/supabase'
import type { ModelData } from '../lib/supabase'

// Importar Componentes
import ModelAnalyzer from '../components/ModelAnalyzer.vue'
import Model3DViewer from '../components/Model3DViewer.vue'
import PrinterConsole from '../components/PrinterConsole.vue'
import AIChatAssistant from '../components/AIChatAssistant.vue'

// Estado
const activeView = ref<'dashboard' | 'history'>('dashboard')
const supabaseConnected = ref(isSupabaseConfigured)
const savedModels = ref<ModelData[]>([])

// Datos del modelo activo para compartir
const activeModel = ref<ModelData | null>(null)
const positions = ref<Float32Array | null>(null)
const boundingBoxSize = ref<{ x: number; y: number; z: number } | null>(null)
const boundingBoxMin = ref<{ x: number; y: number; z: number } | null>(null)
const boundingBoxMax = ref<{ x: number; y: number; z: number } | null>(null)

// Control de Impresora
const printerConsole = ref<any>(null)
const printerStatus = ref('idle')

// Retorna true si la impresora está haciendo algo diferente a Idle, Completado o Fallo
const isPrintingActive = computed(() => {
  return ['heating', 'leveling', 'printing', 'paused'].includes(printerStatus.value)
})

// ==========================================
// EVENTOS DEL DASHBOARD
// ==========================================

// Al analizar el archivo STL en ModelAnalyzer
const onModelLoaded = (data: any) => {
  positions.value = data.positions
  boundingBoxSize.value = data.boundingBox.size
  boundingBoxMin.value = data.boundingBox.min
  boundingBoxMax.value = data.boundingBox.max

  // Crear objeto ModelData temporal
  activeModel.value = {
    id: data.id,
    name: data.name,
    volume_cm3: data.volume,
    bounding_box_x: data.boundingBox.size.x,
    bounding_box_y: data.boundingBox.size.y,
    bounding_box_z: data.boundingBox.size.z,
    estimated_weight_g: data.estWeight,
    estimated_time_min: data.estTimeMin,
    filament_type: data.material,
    infill_percent: data.infill,
    layer_height_mm: data.layerHeight
  }
}

// Al hacer clic en "Enviar a Impresora 3D" en ModelAnalyzer
const onPrintTriggered = (savedModel: ModelData) => {
  activeModel.value = savedModel
  
  // Cambiar el estado de visualización a activo para mostrar la consola
  printerStatus.value = 'heating'
  
  nextTick(() => {
    // Iniciar la simulación en la consola
    if (printerConsole.value) {
      printerConsole.value.startPrint(savedModel)
    }
  })
}

const onPrinterStatusChange = (newStatus: string) => {
  printerStatus.value = newStatus
}

const onPrintCompleted = (job: any) => {
  // Impresión terminada, podemos refrescar el historial en segundo plano
  loadHistory()
}

// ==========================================
// MÉTODOS DE HISTORIAL
// ==========================================

const loadHistory = async () => {
  try {
    savedModels.value = await dbService.getModels()
  } catch (err) {
    console.error('Error cargando historial:', err)
  }
}

// Carga un modelo guardado desde el historial al Dashboard activo
const loadModelIntoDashboard = (model: ModelData) => {
  activeModel.value = model
  
  // Como no guardamos los vértices Float32Array crudos en la base de datos por eficiencia de almacenamiento,
  // creamos un cubo/caja placeholder o representativa en el visor 3D para el modelo histórico cargado.
  // Generaremos un conjunto de triángulos representativos de una caja de sus dimensiones exactas.
  positions.value = generateBoxVertices(model.bounding_box_x, model.bounding_box_y, model.bounding_box_z)
  
  boundingBoxSize.value = { x: model.bounding_box_x, y: model.bounding_box_y, z: model.bounding_box_z }
  boundingBoxMin.value = { x: -model.bounding_box_x/2, y: 0, z: -model.bounding_box_z/2 }
  boundingBoxMax.value = { x: model.bounding_box_x/2, y: model.bounding_box_z, z: model.bounding_box_z/2 }

  // Cambiar pestaña al dashboard
  activeView.value = 'dashboard'
  printerStatus.value = 'idle'
}

// Genera un cubo de malla para Three.js representando las dimensiones físicas del modelo del historial
const generateBoxVertices = (dx: number, dy: number, dz: number): Float32Array => {
  const x = dx / 2
  const y = dy
  const z = dz / 2

  // 6 caras * 2 triángulos * 3 vértices * 3 coordenadas = 108 floats
  const v = new Float32Array([
    // Frente (Z = z)
    -x, 0, z,  x, 0, z,  x, y, z,
    -x, 0, z,  x, y, z, -x, y, z,
    // Atrás (Z = -z)
    -x, 0, -z, -x, y, -z,  x, y, -z,
    -x, 0, -z,  x, y, -z,  x, 0, -z,
    // Techo (Y = y)
    -x, y, -z, -x, y, z,   x, y, z,
    -x, y, -z,  x, y, z,   x, y, -z,
    // Piso (Y = 0)
    -x, 0, -z,  x, 0, -z,  x, 0, z,
    -x, 0, -z,  x, 0, z,  -x, 0, z,
    // Derecha (X = x)
     x, 0, -z,  x, y, -z,  x, y, z,
     x, 0, -z,  x, y, z,   x, 0, z,
    // Izquierda (X = -x)
    -x, 0, -z, -x, 0, z,  -x, y, z,
    -x, 0, -z, -x, y, z,  -x, y, -z
  ])
  return v
}

// ==========================================
// UTILIDADES FORMATO
// ==========================================

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

onMounted(() => {
  loadHistory()
})
</script>

<style>
/* CLASES GLOBALES DE DISEÑO PREMIUM (MODO OSCURO NEÓN) */
.app-bg {
  background: radial-gradient(circle at 50% 10%, #10192e 0%, #060813 100%) !important;
  font-family: 'Outfit', 'Inter', sans-serif !important;
}

.glass-bar {
  background: rgba(10, 14, 23, 0.6) !important;
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.glass-toggle {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 8px;
  overflow: hidden;
}

.tracking-wide {
  letter-spacing: 1.5px;
}

.animate-glow {
  filter: drop-shadow(0 0 6px rgba(33, 150, 243, 0.8));
}

.max-width-250 {
  max-width: 250px;
}

.max-width-300 {
  max-width: 300px;
}

.monospace {
  font-family: 'Courier New', Courier, monospace !important;
}

.gap-2 {
  gap: 8px;
}

.gap-3 {
  gap: 12px;
}

/* Scrollbars personalizadas para estética cyberpunk */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.15);
}

::-webkit-scrollbar-thumb {
  background: rgba(33, 150, 243, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 229, 255, 0.5);
}
</style>
