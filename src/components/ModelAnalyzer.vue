<template>
  <v-card class="glass-card flex-grow-1 d-flex flex-column h-100" min-height="450">
    <v-card-item class="pb-2">
      <template v-slot:prepend>
        <v-icon color="primary" class="me-2">mdi-printer-3d</v-icon>
      </template>
      <v-card-title class="font-weight-bold">Analizador de Impresión</v-card-title>
      <v-card-subtitle>Calculadora inteligente de material 3D</v-card-subtitle>
    </v-card-item>

    <v-divider class="mx-4 border-opacity-25"></v-divider>

    <div class="card-scroll-content px-4 py-3 flex-grow-1">
      <!-- 1. ZONA DE UPLOAD -->
      <div
        class="upload-zone d-flex flex-column align-center justify-center py-6 px-4 mb-4"
        :class="{ 'upload-dragover': dragover, 'has-file': fileName }"
        @dragover.prevent="dragover = true"
        @dragleave.prevent="dragover = false"
        @drop.prevent="onFileDrop"
        @click="triggerFileSelect"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".stl"
          class="d-none"
          @change="onFileSelected"
        />
        
        <v-icon
          :color="fileName ? 'success' : 'primary'"
          size="40"
          class="mb-2 animate-bounce"
        >
          {{ fileName ? 'mdi-file-check-outline' : 'mdi-cloud-upload-outline' }}
        </v-icon>

        <span class="text-body-1 font-weight-medium text-center">
          {{ fileName ? fileName : 'Arrastra tu archivo STL aquí' }}
        </span>
        <span class="text-caption text-grey-darken-1 text-center mt-1">
          {{ fileName ? 'Haz clic para cambiar de archivo' : 'O haz clic para explorar en tu equipo' }}
        </span>

        <!-- Cargando animado -->
        <v-overlay
          v-model="loading"
          contained
          class="align-center justify-center"
          scrim="#0a0e17"
        >
          <div class="d-flex flex-column align-center text-center">
            <v-progress-circular
              color="primary"
              indeterminate
              size="64"
              width="6"
              class="mb-3"
            ></v-progress-circular>
            <span class="text-subtitle-1 font-weight-bold text-white">Analizando geometría 3D...</span>
            <span class="text-caption text-grey-lighten-1 mt-1">Calculando volumen e infill...</span>
          </div>
        </v-overlay>
      </div>

      <!-- 2. AJUSTES DE REBANADO (SLICER) -->
      <div v-if="volume > 0">
        <h4 class="text-subtitle-2 font-weight-bold text-primary mb-3">⚙️ Ajustes del Rebanador (Slicer)</h4>

        <!-- Selector de Material -->
        <v-select
          v-model="selectedMaterial"
          :items="materials"
          label="Material del Filamento"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-flask-outline"
          class="mb-3"
        ></v-select>

        <!-- Slider de Relleno (Infill) -->
        <div class="mb-3">
          <div class="d-flex justify-space-between text-body-2 mb-1">
            <span>Relleno (Infill):</span>
            <span class="font-weight-bold text-primary">{{ infill }}%</span>
          </div>
          <v-slider
            v-model="infill"
            min="10"
            max="100"
            step="5"
            color="primary"
            track-color="grey-darken-3"
            density="compact"
            hide-details
          ></v-slider>
        </div>

        <!-- Fila: Altura de capa y Soportes -->
        <v-row class="ma-0 mb-3" dense>
          <v-col cols="6" class="pa-0 pe-2">
            <v-select
              v-model="layerHeight"
              :items="layerHeights"
              item-title="title"
              item-value="value"
              label="Altura de Capa"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-format-list-bulleted-type"
              hide-details
            ></v-select>
          </v-col>
          <v-col cols="6" class="pa-0 ps-2 d-flex align-center">
            <v-switch
              v-model="hasSupports"
              label="Soportes"
              color="primary"
              density="compact"
              hide-details
              inset
            ></v-switch>
          </v-col>
        </v-row>

        <v-divider class="my-3 border-opacity-25"></v-divider>

        <!-- 3. ESTIMACIÓN DE MATERIALES (KPIs) -->
        <h4 class="text-subtitle-2 font-weight-bold text-primary mb-3">📊 Métricas de Impresión Estimadas</h4>

        <v-row dense class="mb-3">
          <!-- Tarjeta Peso -->
          <v-col cols="6" class="pa-1">
            <div class="stat-box d-flex align-center">
              <v-icon color="primary" class="me-2" size="28">mdi-weight-gram</v-icon>
              <div>
                <div class="text-caption text-grey-darken-1">Peso Estimado</div>
                <div class="text-subtitle-1 font-weight-bold text-white">{{ estWeight.toFixed(1) }} g</div>
              </div>
            </div>
          </v-col>
          <!-- Tarjeta Longitud -->
          <v-col cols="6" class="pa-1">
            <div class="stat-box d-flex align-center">
              <v-icon color="primary" class="me-2" size="28">mdi-ruler</v-icon>
              <div>
                <div class="text-caption text-grey-darken-1">Longitud Filamento</div>
                <div class="text-subtitle-1 font-weight-bold text-white">{{ estLength.toFixed(1) }} m</div>
              </div>
            </div>
          </v-col>
          <!-- Tarjeta Costo -->
          <v-col cols="6" class="pa-1">
            <div class="stat-box d-flex align-center">
              <v-icon color="success" class="me-2" size="28">mdi-currency-usd</v-icon>
              <div>
                <div class="text-caption text-grey-darken-1">Costo Estimado</div>
                <div class="text-subtitle-1 font-weight-bold text-success">${{ estCost.toFixed(2) }} USD</div>
              </div>
            </div>
          </v-col>
          <!-- Tarjeta Tiempo -->
          <v-col cols="6" class="pa-1">
            <div class="stat-box d-flex align-center">
              <v-icon color="warning" class="me-2" size="28">mdi-clock-outline</v-icon>
              <div>
                <div class="text-caption text-grey-darken-1">Tiempo de Impresión</div>
                <div class="text-subtitle-1 font-weight-bold text-white">{{ formatTime(estTimeMin) }}</div>
              </div>
            </div>
          </v-col>
        </v-row>
      </div>
    </div>

    <!-- 4. BOTÓN ACCIÓN DE IMPRESIÓN -->
    <v-card-actions v-if="volume > 0" class="px-4 pb-4 pt-0">
      <v-btn
        color="primary"
        block
        size="large"
        variant="flat"
        class="pulse-btn text-none font-weight-bold"
        prepend-icon="mdi-printer-3d-nozzle"
        @click="triggerPrint"
      >
        Enviar a Impresora 3D
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { parseSTL } from '../services/stlParser'
import type { ParsedSTL } from '../services/stlParser'
import { MATERIAL_SPECS } from '../services/aiService'
import { dbService } from '../lib/supabase'
import type { ModelData } from '../lib/supabase'

const emit = defineEmits<{
  (e: 'loaded', data: ParsedSTL & { material: string; infill: number; layerHeight: number; hasSupports: boolean; estWeight: number; estTimeMin: number }): void
  (e: 'print', data: ModelData): void
}>()

// Estado
const fileInput = ref<HTMLInputElement | null>(null)
const dragover = ref(false)
const loading = ref(false)
const fileName = ref('')
const volume = ref(0)
const boundingBox = ref<ParsedSTL['boundingBox'] | null>(null)
const positionsArray = ref<Float32Array | null>(null)
const triangleCount = ref(0)

// Configuración de impresión
const selectedMaterial = ref('PLA')
const infill = ref(15)
const layerHeight = ref(0.20)
const hasSupports = ref(false)

// Opciones
const materials = ['PLA', 'ABS', 'PETG', 'TPU']
const layerHeights = [
  { title: 'Alta Definición (0.12 mm)', value: 0.12 },
  { title: 'Estándar (0.20 mm)', value: 0.20 },
  { title: 'Borrador / Rápido (0.28 mm)', value: 0.28 }
]

// Precios de referencia por Kilogramo para el filamento (USD)
const MATERIAL_PRICES: Record<string, number> = {
  PLA: 22,
  ABS: 26,
  PETG: 25,
  TPU: 38
}

// ==========================================
// FÓRMULAS DE ESTIMACIÓN INGENIERIL
// ==========================================

// 1. Peso estimado en gramos
const estWeight = computed(() => {
  if (volume.value === 0) return 0

  const specs = MATERIAL_SPECS[selectedMaterial.value] || MATERIAL_SPECS.PLA
  const density = specs.density // g/cm3

  // Estimación del volumen real impreso considerando perímetros e infill
  // Asumimos que un modelo tiene capas sólidas y paredes (alrededor del 22% del volumen total)
  // y el resto es relleno hueco
  const shellFraction = 0.22
  const infillFraction = infill.value / 100
  const printedVolumeFraction = shellFraction + (1 - shellFraction) * infillFraction

  let finalVolume = volume.value * printedVolumeFraction

  // Si tiene soportes, estimamos un 15% adicional de material
  if (hasSupports.value) {
    finalVolume *= 1.15
  }

  return finalVolume * density // Peso = Volumen impreso * Densidad
})

// 2. Longitud del filamento (m) para filamento estándar de 1.75mm de diámetro
const estLength = computed(() => {
  if (estWeight.value === 0) return 0
  const specs = MATERIAL_SPECS[selectedMaterial.value] || MATERIAL_SPECS.PLA
  
  // Radio de filamento estándar: 1.75mm / 2 = 0.875mm = 0.0875cm
  // Área transversal: pi * r^2 = pi * 0.0875^2 = 0.02405 cm2
  const crossSectionArea = 0.02405 // cm2
  
  // Volumen impreso = Peso / Densidad
  const printedVolumeCm3 = estWeight.value / specs.density
  
  // Longitud en cm = Volumen / Área transversal
  const lengthCm = printedVolumeCm3 / crossSectionArea
  
  // Retornar en metros
  return lengthCm / 100
})

// 3. Costo estimado en USD
const estCost = computed(() => {
  const pricePerKg = MATERIAL_PRICES[selectedMaterial.value] || 22
  return (estWeight.value / 1000) * pricePerKg
})

// 4. Tiempo de impresión estimado en minutos
const estTimeMin = computed(() => {
  if (volume.value === 0) return 0

  // Velocidad de impresión estándar según material (mm/s)
  const speedMap: Record<string, number> = {
    PLA: 60,
    ABS: 50,
    PETG: 45,
    TPU: 25
  }
  const speed = speedMap[selectedMaterial.value] || 50

  // Volumen en mm3
  const volumeMm3 = volume.value * 1000

  // Volumen impreso estimado en mm3
  const shellFraction = 0.22
  const infillFraction = infill.value / 100
  const printedVolumeMm3 = volumeMm3 * (shellFraction + (1 - shellFraction) * infillFraction)

  // Estimación de tiempo basada en la tasa de extrusión volumétrica máxima
  // Tasa = Velocidad * Diámetro Boquilla (0.4) * Altura Capa
  const nozzleDiameter = 0.4
  const extrusionRate = speed * nozzleDiameter * layerHeight.value // mm3/s

  let timeSeconds = printedVolumeMm3 / extrusionRate

  // Tiempo adicional de calentamiento de boquilla/cama y movimientos en vacío (aprox 15 min)
  let timeMin = (timeSeconds / 60) + 15

  // Si tiene soportes, incrementa un 25% el tiempo por la retracción y cambio de trayectorias
  if (hasSupports.value) {
    timeMin *= 1.25
  }

  // Factor de escala por detalles (si la altura de capa es muy fina, aumenta la resolución y el recorrido)
  if (layerHeight.value === 0.12) {
    timeMin *= 1.4 // 40% más lento debido a más capas
  } else if (layerHeight.value === 0.28) {
    timeMin *= 0.75 // 25% más rápido
  }

  return Math.round(timeMin)
})

// ==========================================
// MANEJADORES DE ARCHIVOS
// ==========================================

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    processFile(target.files[0])
  }
}

const onFileDrop = (event: DragEvent) => {
  dragover.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    processFile(event.dataTransfer.files[0])
  }
}

const processFile = async (file: File) => {
  if (!file.name.toLowerCase().endsWith('.stl')) {
    alert('Por favor, sube únicamente archivos en formato .stl')
    return
  }

  loading.value = true
  fileName.value = file.name

  try {
    const parsed = await parseSTL(file)
    volume.value = parsed.volume
    boundingBox.value = parsed.boundingBox
    positionsArray.value = parsed.positions
    triangleCount.value = parsed.triangleCount

    triggerAnalysisUpdate()
  } catch (error) {
    console.error('Error procesando el STL:', error)
    alert('Error al analizar el archivo STL. Asegúrate de que es un archivo STL válido.')
    fileName.value = ''
    volume.value = 0
  } finally {
    loading.value = false
  }
}

// Disparar actualizaciones del modelo cargado hacia la app
const triggerAnalysisUpdate = () => {
  if (volume.value === 0) return

  emit('loaded', {
    name: fileName.value,
    volume: volume.value,
    boundingBox: boundingBox.value!,
    positions: positionsArray.value!,
    triangleCount: triangleCount.value,
    material: selectedMaterial.value,
    infill: infill.value,
    layerHeight: layerHeight.value,
    hasSupports: hasSupports.value,
    estWeight: estWeight.value,
    estTimeMin: estTimeMin.value
  })
}

// Observar cambios en ajustes para recalcular y emitir cambios
watch([selectedMaterial, infill, layerHeight, hasSupports], () => {
  if (volume.value > 0) {
    triggerAnalysisUpdate()
  }
})

// Enviar a impresión: Guarda en base de datos e inicia simulación
const triggerPrint = async () => {
  if (volume.value === 0 || !boundingBox.value) return

  const modelData: ModelData = {
    name: fileName.value,
    volume_cm3: volume.value,
    bounding_box_x: boundingBox.value.size.x,
    bounding_box_y: boundingBox.value.size.y,
    bounding_box_z: boundingBox.value.size.z,
    estimated_weight_g: estWeight.value,
    estimated_time_min: estTimeMin.value,
    filament_type: selectedMaterial.value,
    infill_percent: infill.value,
    layer_height_mm: layerHeight.value
  }

  try {
    // Guardar en Supabase (o LocalStorage fallback)
    const savedModel = await dbService.saveModel(modelData)
    emit('print', savedModel)
  } catch (err) {
    console.error('Error guardando modelo:', err)
    // Emitir con datos locales si hay error de base de datos
    emit('print', modelData)
  }
}

// Formatear minutos a formato legible "2h 45m"
const formatTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}
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

.card-scroll-content {
  overflow-y: auto;
  max-height: calc(100vh - 280px);
}

.upload-zone {
  border: 2px dashed rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  cursor: pointer;
  background: rgba(33, 150, 243, 0.02);
  transition: all 0.25s ease;
}

.upload-zone:hover {
  border-color: #2196f3;
  background: rgba(33, 150, 243, 0.05);
}

.upload-dragover {
  border-color: #00e5ff;
  background: rgba(0, 229, 255, 0.08);
  transform: scale(1.02);
}

.has-file {
  border-style: solid;
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.03);
}

.stat-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 8px 12px;
  height: 100%;
}

.pulse-btn {
  background: linear-gradient(135deg, #2196f3, #00d2ff) !important;
  box-shadow: 0 0 15px rgba(33, 150, 243, 0.4);
  transition: all 0.3s ease;
}

.pulse-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(0, 210, 255, 0.7);
}

.animate-bounce {
  animation: bounce 2.5s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
</style>
