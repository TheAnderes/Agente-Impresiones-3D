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

      <div v-if="volume > 0">
        <h4 class="text-subtitle-2 font-weight-bold text-primary mb-3">⚙️ Ajustes del Rebanador (Slicer)</h4>

        <v-select
          v-model="selectedMaterial"
          :items="materials"
          label="Material del Filamento"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-flask-outline"
          class="mb-3"
        ></v-select>

        <div class="mb-3">
          <div class="d-flex justify-space-between text-body-2 mb-1">
            <span>Relleno (Infill):</span>
            <span class="font-weight-bold text-primary">{{ infill }}%</span>
          </div>
          <v-slider
            v-model="infill"
            min="5"
            max="100"
            step="5"
            color="primary"
            track-color="grey-darken-3"
            density="compact"
            hide-details
          ></v-slider>
        </div>

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

        <h4 class="text-subtitle-2 font-weight-bold text-primary mb-3">📊 Métricas de Impresión Estimadas</h4>

        <v-row dense class="mb-3">
          <v-col cols="6" class="pa-1">
            <div class="stat-box d-flex align-center">
              <v-icon color="primary" class="me-2" size="28">mdi-weight-gram</v-icon>
              <div>
                <div class="text-caption text-grey-darken-1">Peso Estimado</div>
                <div class="text-subtitle-1 font-weight-bold text-white">{{ estWeight.toFixed(1) }} g</div>
              </div>
            </div>
          </v-col>
          <v-col cols="6" class="pa-1">
            <div class="stat-box d-flex align-center">
              <v-icon color="primary" class="me-2" size="28">mdi-ruler</v-icon>
              <div>
                <div class="text-caption text-grey-darken-1">Longitud Filamento</div>
                <div class="text-subtitle-1 font-weight-bold text-white">{{ estLength.toFixed(1) }} m</div>
              </div>
            </div>
          </v-col>
          <v-col cols="6" class="pa-1">
            <div class="stat-box d-flex align-center">
              <v-icon color="success" class="me-2" size="28">mdi-cash</v-icon>
              <div>
                <div class="text-caption text-grey-darken-1">Costo Estimado</div>
                <div class="text-subtitle-1 font-weight-bold text-success">{{ estCost.toFixed(2) }} Bs.</div>
              </div>
            </div>
          </v-col>
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

// CONFIGURACIÓN GLOBAL DE COSTOS (Hardcoded temporalmente, lista para migración a base de datos)
const PRECIO_FILAMENTO_POR_GRAMO_BOB = 1.0  // 1 Bs / gramo de filamento
const CONFIG_WALL_THICKNESS_MM = 1.2        // Espesor estándar de paredes (3 perímetros de 0.4mm)

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

// ==========================================
// FÓRMULAS DE ESTIMACIÓN INGENIERIL (SLICER APPROXIMATION)
// ==========================================

// 1. Peso estimado en gramos basado en Slicer Approximation real
const estWeight = computed(() => {
  if (volume.value === 0 || !boundingBox.value) return 0

  const specs = MATERIAL_SPECS[selectedMaterial.value] || MATERIAL_SPECS.PLA
  const density = specs.density // g/cm³

  // Convertir volumen total bruto del STL de cm³ a mm³
  const volumenTotalMm3 = volume.value * 1000

  // Aproximación del Área Superficial (mm²) usando el Bounding Box (Caja contenedora)
  const dx = boundingBox.value.size.x
  const dy = boundingBox.value.size.y
  const dz = boundingBox.value.size.z
  const areaSuperficialMm2 = 2 * (dx * dy + dy * dz + dx * dz)

  // Calcular el volumen real que ocupan las paredes sólidas (Perímetros externos)
  let volumenParedesMm3 = areaSuperficialMm2 * CONFIG_WALL_THICKNESS_MM
  
  // Control de desbordamiento por si la pieza es más pequeña que el grosor de las paredes
  if (volumenParedesMm3 > volumenTotalMm3) {
    volumenParedesMm3 = volumenTotalMm3
  }

  // Extraer el volumen del núcleo interno (el vacío interno)
  const volumenNucleoMm3 = volumenTotalMm3 - volumenParedesMm3

  // Aplicar porcentaje de relleno (Infill Fraction) restando la fracción de aire vacío
  const infillFraction = infill.value / 100
  const volumenPlasticoRealMm3 = volumenParedesMm3 + (volumenNucleoMm3 * infillFraction)

  // Convertir el volumen real impreso de mm³ a cm³
  let finalVolumeCm3 = volumenPlasticoRealMm3 / 1000

  // Si tiene soportes activos, sumar un 12% aproximado de material estructural sacrificable
  if (hasSupports.value) {
    finalVolumeCm3 *= 1.12
  }

  // Masa = Volumen Real (cm³) * Densidad (g/cm³)
  return finalVolumeCm3 * density
})

// 2. Longitud del filamento (m) para filamento estándar de ø1.75mm
const estLength = computed(() => {
  if (estWeight.value === 0) return 0
  const specs = MATERIAL_SPECS[selectedMaterial.value] || MATERIAL_SPECS.PLA
  
  // Área de sección transversal de filamento estándar: pi * r² (r = 0.0875 cm)
  const crossSectionArea = 0.02405 // cm²
  
  // Volumen real consumido en cm³
  const printedVolumeCm3 = estWeight.value / specs.density
  
  // Longitud en cm = Volumen / Área transversal
  const lengthCm = printedVolumeCm3 / crossSectionArea
  
  return lengthCm / 100 // Retorna metros lineales
})

// 3. Costo estimado basado en variables centralizadas (Moneda local: Bs.)
const estCost = computed(() => {
  return estWeight.value * PRECIO_FILAMENTO_POR_GRAMO_BOB
})

// 4. Tiempo de impresión estimado en minutos
const estTimeMin = computed(() => {
  if (volume.value === 0) return 0

  const speedMap: Record<string, number> = {
    PLA: 60,
    ABS: 50,
    PETG: 45,
    TPU: 25
  }
  const speed = speedMap[selectedMaterial.value] || 50

  const volumenTotalMm3 = volume.value * 1000
  const dx = boundingBox.value ? boundingBox.value.size.x : 50
  const dy = boundingBox.value ? boundingBox.value.size.y : 50
  const dz = boundingBox.value ? boundingBox.value.size.z : 50
  const areaSuperficialMm2 = 2 * (dx * dy + dy * dz + dx * dz)

  const volumenParedesMm3 = Math.min(areaSuperficialMm2 * CONFIG_WALL_THICKNESS_MM, volumenTotalMm3)
  const volumenNucleoMm3 = volumenTotalMm3 - volumenParedesMm3
  const printedVolumeMm3 = volumenParedesMm3 + (volumenNucleoMm3 * (infill.value / 100))

  const nozzleDiameter = 0.4
  const extrusionRate = speed * nozzleDiameter * layerHeight.value // mm³/s

  let timeSeconds = printedVolumeMm3 / extrusionRate
  let timeMin = (timeSeconds / 60) + 15

  if (hasSupports.value) {
    timeMin *= 1.25
  }

  if (layerHeight.value === 0.12) {
    timeMin *= 1.4 
  } else if (layerHeight.value === 0.28) {
    timeMin *= 0.75 
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

watch([selectedMaterial, infill, layerHeight, hasSupports], () => {
  if (volume.value > 0) {
    triggerAnalysisUpdate()
  }
})

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
    const savedModel = await dbService.saveModel(modelData)
    emit('print', savedModel)
  } catch (err) {
    console.error('Error guardando modelo:', err)
    emit('print', modelData)
  }
}

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