<template>
  <v-card class="glass-card flex-grow-1 d-flex flex-column h-100" min-height="450">
    <v-card-item class="pb-2">
      <template v-slot:prepend>
        <v-icon color="warning" class="me-2">mdi-monitor-dashboard</v-icon>
      </template>
      <v-card-title class="font-weight-bold">Centro de Control de Impresión</v-card-title>
      <v-card-subtitle>Monitoreo en tiempo real de la impresora 3D</v-card-subtitle>
    </v-card-item>

    <v-divider class="mx-4 border-opacity-25"></v-divider>

    <div class="card-scroll-content px-4 py-3 flex-grow-1 d-flex flex-column gap-3">
      <!-- 1. ESTADO GENERAL Y PROGRESO -->
      <div class="d-flex justify-space-between align-center">
        <div>
          <span class="text-caption text-grey-darken-1 block">Estado actual:</span>
          <span :class="statusColorClass" class="text-subtitle-1 font-weight-bold d-flex align-center">
            <v-icon size="20" class="me-1" :class="{ 'spin-icon': status === 'printing' }">
              {{ statusIcon }}
            </v-icon>
            {{ statusText }}
          </span>
        </div>
        <div v-if="status !== 'idle'" class="text-right">
          <span class="text-caption text-grey-darken-1 block">Progreso:</span>
          <span class="text-h5 font-weight-black text-primary">{{ Math.round(progress) }}%</span>
        </div>
      </div>

      <!-- Barra de progreso lineal -->
      <v-progress-linear
        v-if="status !== 'idle'"
        v-model="progress"
        color="primary"
        height="8"
        rounded
        striped
        class="mb-2"
      ></v-progress-linear>

      <v-row dense class="mb-1" v-if="status !== 'idle'">
        <v-col cols="4" class="text-center">
          <div class="stat-small">
            <span class="text-caption text-grey-darken-1 block">Boquilla</span>
            <span class="text-subtitle-2 font-weight-bold text-white">{{ Math.round(nozzleTemp) }}°C / {{ targetNozzleTemp }}°C</span>
          </div>
        </v-col>
        <v-col cols="4" class="text-center">
          <div class="stat-small">
            <span class="text-caption text-grey-darken-1 block">Cama Caliente</span>
            <span class="text-subtitle-2 font-weight-bold text-white">{{ Math.round(bedTemp) }}°C / {{ targetBedTemp }}°C</span>
          </div>
        </v-col>
        <v-col cols="4" class="text-center">
          <div class="stat-small">
            <span class="text-caption text-grey-darken-1 block">Ejes (X, Y, Z)</span>
            <span class="text-subtitle-2 font-weight-bold text-primary monospace">{{ printX }}, {{ printY }}, {{ printZ.toFixed(2) }}</span>
          </div>
        </v-col>
      </v-row>

      <!-- 2. VISUALIZACIÓN BIDIMENSIONAL EN VIVO (Simulador Webcam/Capas) -->
      <div class="sim-screen mb-2">
        <canvas ref="simCanvas" width="360" height="150" class="w-100 h-100"></canvas>
        <div class="screen-label">SIMULACIÓN DE BOQUILLA EN VIVO</div>
      </div>

      <!-- 3. GRÁFICO DE TEMPERATURA Y CONSOLA DE TERMINAL (TABS) -->
      <v-tabs v-model="activeTab" density="compact" color="primary" class="border-bottom-dark">
        <v-tab value="graph" class="text-none">Telemetría Térmica</v-tab>
        <v-tab value="terminal" class="text-none">Consola G-Code</v-tab>
      </v-tabs>

      <div class="tab-content flex-grow-1 d-flex flex-column mt-2">
        <!-- Gráfico de Temperatura (Canvas) -->
        <div v-show="activeTab === 'graph'" class="flex-grow-1 relative-container" style="min-height: 140px;">
          <canvas ref="tempCanvas" width="360" height="140" class="w-100 h-100"></canvas>
        </div>

        <!-- Terminal de comandos G-Code -->
        <div v-show="activeTab === 'terminal'" class="flex-grow-1 d-flex flex-column">
          <div ref="terminalLog" class="terminal-log flex-grow-1 p-2 font-mono">
            <div v-for="(log, idx) in terminalLogs" :key="idx" :class="log.type" class="terminal-line">
              <span class="terminal-timestamp">[{{ log.time }}]</span> {{ log.msg }}
            </div>
            <div v-if="terminalLogs.length === 0" class="text-grey-darken-2 text-center mt-8 font-italic">
              Esperando comandos de impresión...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. ACCIONES DE CONTROL -->
    <v-card-actions v-if="status !== 'idle'" class="px-4 pb-4 pt-0 gap-2">
      <v-btn
        v-if="status === 'printing' || status === 'heating' || status === 'leveling'"
        color="warning"
        variant="outlined"
        class="flex-grow-1 text-none font-weight-bold"
        prepend-icon="mdi-pause"
        @click="pausePrint"
      >
        Pausar
      </v-btn>
      <v-btn
        v-if="status === 'paused'"
        color="success"
        variant="flat"
        class="flex-grow-1 text-none font-weight-bold"
        prepend-icon="mdi-play"
        @click="resumePrint"
      >
        Reanudar
      </v-btn>
      <v-btn
        color="error"
        variant="tonal"
        class="flex-grow-1 text-none font-weight-bold"
        prepend-icon="mdi-stop"
        @click="cancelPrint"
      >
        Cancelar
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { dbService } from '../lib/supabase'
import type { ModelData, PrintJob } from '../lib/supabase'

const props = defineProps<{
  activeModel: ModelData | null
}>()

const emit = defineEmits<{
  (e: 'completed', job: PrintJob): void
  (e: 'status-change', status: string): void
}>()

// Configuración y variables del simulador
const status = ref<'idle' | 'heating' | 'leveling' | 'printing' | 'paused' | 'completed' | 'failed'>('idle')
const progress = ref(0)
const nozzleTemp = ref(22)
const bedTemp = ref(22)
const targetNozzleTemp = ref(0)
const targetBedTemp = ref(0)
const printX = ref(0)
const printY = ref(0)
const printZ = ref(0)
const activeTab = ref<'graph' | 'terminal'>('graph')
const terminalLogs = ref<{ time: string; msg: string; type: string }[]>([])
const terminalLog = ref<HTMLDivElement | null>(null)

// Elementos de Canvas
const tempCanvas = ref<HTMLCanvasElement | null>(null)
const simCanvas = ref<HTMLCanvasElement | null>(null)

// Historial para el gráfico
const tempHistory: { nozzle: number[]; bed: number[] } = {
  nozzle: Array(60).fill(22),
  bed: Array(60).fill(22)
}

// Control de intervalos de simulación
let simulationInterval: number | null = null
let currentJobId = ''
let elapsedSeconds = 0
let totalEstimatedSeconds = 0

// ==========================================
// TEXTO E ICONOS SEGÚN ESTADO
// ==========================================

const statusText = computed(() => {
  switch (status.value) {
    case 'idle': return 'Impresora lista para operar'
    case 'heating':
      if (bedTemp.value < targetBedTemp.value - 2) return 'Calentando plataforma térmica...'
      return 'Calentando extrusor a temperatura de extrusión...'
    case 'leveling': return 'Autonivelación de la cama de impresión...'
    case 'printing': return 'Imprimiendo filamento...'
    case 'paused': return 'Impresión en pausa'
    case 'completed': return 'Trabajo completado con éxito'
    case 'failed': return 'Impresión abortada'
    default: return 'Desconocido'
  }
})

const statusIcon = computed(() => {
  switch (status.value) {
    case 'idle': return 'mdi-printer-3d-nozzle'
    case 'heating': return 'mdi-thermometer-chevron-up'
    case 'leveling': return 'mdi-axis-z-arrow'
    case 'printing': return 'mdi-printer-3d-nozzle-alert'
    case 'paused': return 'mdi-pause-circle'
    case 'completed': return 'mdi-check-circle-outline'
    case 'failed': return 'mdi-close-circle-outline'
    default: return 'mdi-help-circle'
  }
})

const statusColorClass = computed(() => {
  switch (status.value) {
    case 'idle': return 'text-grey-lighten-1'
    case 'heating': return 'text-warning'
    case 'leveling': return 'text-info'
    case 'printing': return 'text-primary animate-glow'
    case 'paused': return 'text-amber'
    case 'completed': return 'text-success'
    case 'failed': return 'text-error'
    default: return 'text-white'
  }
})

// ==========================================
// INICIAR TRABAJO DE IMPRESIÓN
// ==========================================

const startPrint = async (model: ModelData) => {
  if (simulationInterval) clearInterval(simulationInterval)

  // Configurar temperaturas objetivo
  if (model.filament_type === 'ABS') {
    targetNozzleTemp.value = 240
    targetBedTemp.value = 100
  } else if (model.filament_type === 'PETG') {
    targetNozzleTemp.value = 230
    targetBedTemp.value = 80
  } else if (model.filament_type === 'TPU') {
    targetNozzleTemp.value = 220
    targetBedTemp.value = 50
  } else { // PLA
    targetNozzleTemp.value = 200
    targetBedTemp.value = 60
  }

  // Resetear estados
  status.value = 'heating'
  emit('status-change', 'heating')
  progress.value = 0
  nozzleTemp.value = 22
  bedTemp.value = 22
  printX.value = 0
  printY.value = 0
  printZ.value = 0
  elapsedSeconds = 0
  terminalLogs.value = []

  // El tiempo de simulación será más rápido que el tiempo real.
  // Una impresión de 2 horas tomará unos 2.5 minutos de simulación (150 pasos).
  // Hacemos que cada segundo de simulación corresponda a aproximadamente el 0.6% del progreso.
  totalEstimatedSeconds = 120 // Pasos de actualización totales

  addTerminalLog('M110 N0 ; Inicializar número de línea G-Code', 'command')
  addTerminalLog(`M140 S${targetBedTemp.value} ; Calentar cama a ${targetBedTemp.value}°C`, 'command')
  addTerminalLog(`M104 S${targetNozzleTemp.value} ; Calentar boquilla a ${targetNozzleTemp.value}°C`, 'command')
  addTerminalLog('M190 S60 ; Esperando que la cama caliente alcance la temperatura', 'info')

  // Crear el trabajo de impresión en base de datos
  try {
    const job: PrintJob = {
      model_id: model.id || '',
      status: 'heating',
      progress: 0,
      filament_used_g: 0,
      elapsed_time_min: 0,
      total_time_min: model.estimated_time_min,
      nozzle_temp: nozzleTemp.value,
      bed_temp: bedTemp.value
    }
    const savedJob = await dbService.savePrintJob(job)
    currentJobId = savedJob.id || ''
  } catch (err) {
    console.error('Error creando trabajo de impresión:', err)
    currentJobId = crypto.randomUUID()
  }

  // Iniciar bucle de actualización (cada 1 segundo)
  simulationInterval = window.setInterval(runSimulationStep, 1000)
}

// Exponer la función para que el padre la invoque
defineExpose({ startPrint })

// ==========================================
// BUCLE PRINCIPAL DE SIMULACIÓN
// ==========================================

const runSimulationStep = () => {
  if (status.value === 'paused' || status.value === 'idle' || status.value === 'completed') return

  elapsedSeconds++

  // 1. Simulación de Fases
  if (status.value === 'heating') {
    // Calentar Cama Caliente primero
    if (bedTemp.value < targetBedTemp.value) {
      bedTemp.value += Math.random() * 6 + 4
      if (bedTemp.value > targetBedTemp.value) bedTemp.value = targetBedTemp.value
    }

    // Calentar Boquilla después de que la cama tenga cierta temperatura
    if (bedTemp.value > targetBedTemp.value - 10 && nozzleTemp.value < targetNozzleTemp.value) {
      if (nozzleTemp.value === 22) {
        addTerminalLog(`M109 S${targetNozzleTemp.value} ; Esperando temperatura de boquilla`, 'info')
      }
      nozzleTemp.value += Math.random() * 14 + 10
      if (nozzleTemp.value > targetNozzleTemp.value) nozzleTemp.value = targetNozzleTemp.value
    }

    // Fluctuar ligeramente una vez caliente
    if (bedTemp.value >= targetBedTemp.value) {
      bedTemp.value = targetBedTemp.value + (Math.random() * 0.8 - 0.4)
    }
    if (nozzleTemp.value >= targetNozzleTemp.value) {
      nozzleTemp.value = targetNozzleTemp.value + (Math.random() * 1.2 - 0.6)
    }

    // Transición a Autonivelación
    if (bedTemp.value >= targetBedTemp.value - 0.5 && nozzleTemp.value >= targetNozzleTemp.value - 0.5) {
      status.value = 'leveling'
      emit('status-change', 'leveling')
      addTerminalLog('G28 ; Home de todos los ejes (X, Y, Z)', 'command')
      addTerminalLog('G29 ; Autonivelado de cama por sensor 3D-Touch', 'command')
      addTerminalLog('M117 Calibrando cama...', 'info')
    }

    // Calcular progreso del calentamiento (0 a 15%)
    const bedProgress = (bedTemp.value / targetBedTemp.value) * 50
    const nozzleProgress = (nozzleTemp.value / targetNozzleTemp.value) * 50
    progress.value = (bedProgress + nozzleProgress) * 0.15
  }
  else if (status.value === 'leveling') {
    // Simular que el cabezal mide 4 puntos
    const step = elapsedSeconds % 4
    if (step === 0) {
      printX.value = 10; printY.value = 10; printZ.value = 5
      addTerminalLog('G29 P1 ; Midiendo punto frontal izquierdo...', 'info')
    } else if (step === 1) {
      printX.value = 210; printY.value = 10; printZ.value = 5
      addTerminalLog('G29 P2 ; Midiendo punto frontal derecho...', 'info')
    } else if (step === 2) {
      printX.value = 210; printY.value = 210; printZ.value = 5
      addTerminalLog('G29 P3 ; Midiendo punto trasero derecho...', 'info')
    } else if (step === 3) {
      printX.value = 10; printY.value = 210; printZ.value = 5
      addTerminalLog('G29 P4 ; Midiendo punto trasero izquierdo...', 'info')
    }

    // Transición a impresión
    if (elapsedSeconds > 12) { // 6 segundos de calibración
      status.value = 'printing'
      emit('status-change', 'printing')
      progress.value = 15
      addTerminalLog('G92 E0 ; Reiniciar longitud de extrusor', 'command')
      addTerminalLog('G1 F1500 E3 ; Extruir línea de purga', 'command')
      addTerminalLog('M117 Imprimiendo modelo 3D...', 'info')
    }
  }
  else if (status.value === 'printing') {
    // Progreso lineal desde 15% a 98%
    const printTimeSteps = totalEstimatedSeconds - 18 // Descontar calentamiento/calibración
    const currentStep = elapsedSeconds - 12
    const ratio = Math.min(currentStep / printTimeSteps, 1)

    progress.value = 15 + ratio * 83

    // Simular coordenadas de impresión moviéndose aleatoriamente en el volumen del modelo
    const sizeX = props.activeModel ? Math.round(props.activeModel.bounding_box_x) : 100
    const sizeY = props.activeModel ? Math.round(props.activeModel.bounding_box_y) : 100
    const sizeZ = props.activeModel ? Math.round(props.activeModel.bounding_box_z) : 100

    printX.value = Math.round(Math.random() * sizeX - sizeX / 2 + 110)
    printY.value = Math.round(Math.random() * sizeY - sizeY / 2 + 110)
    
    // El eje Z asciende paulatinamente con el progreso
    printZ.value = ratio * sizeZ

    // Fluctuar temperaturas ligeramente
    nozzleTemp.value = targetNozzleTemp.value + (Math.random() * 1.6 - 0.8)
    bedTemp.value = targetBedTemp.value + (Math.random() * 0.8 - 0.4)

    // Escribir comandos G-Code realistas
    if (elapsedSeconds % 2 === 0) {
      const eExtrusion = (Math.random() * 0.05 + 0.01).toFixed(4)
      addTerminalLog(`G1 X${printX.value} Y${printY.value} Z${printZ.value.toFixed(2)} E${eExtrusion} F1200`, 'command')
    }

    // Transición a completado
    if (ratio >= 1) {
      status.value = 'completed'
      emit('status-change', 'completed')
      progress.value = 100
      printX.value = 0
      printY.value = 220 // Mover cama adelante
      printZ.value = sizeZ + 10 // Levantar boquilla
      nozzleTemp.value = 120 // Comenzar enfriado
      bedTemp.value = 45

      addTerminalLog('G1 X0 Y220 ; Presentar modelo al frente', 'command')
      addTerminalLog('M104 S0 ; Apagar calentador de boquilla', 'command')
      addTerminalLog('M140 S0 ; Apagar cama térmica', 'command')
      addTerminalLog('M107 ; Apagar ventilador de capa', 'command')
      addTerminalLog('M117 Impresión finalizada con éxito!', 'success')

      if (simulationInterval) {
        clearInterval(simulationInterval)
        simulationInterval = null
      }

      // Guardar fin de trabajo en BD
      const finalWeight = props.activeModel?.estimated_weight_g || 0
      const finalMinutes = props.activeModel?.estimated_time_min || 0
      
      const finishedJob: PrintJob = {
        model_id: props.activeModel?.id || '',
        status: 'completed',
        progress: 100,
        filament_used_g: finalWeight,
        elapsed_time_min: finalMinutes,
        total_time_min: finalMinutes,
        nozzle_temp: 22,
        bed_temp: 22
      }

      dbService.updatePrintJobStatus(currentJobId, finishedJob)
      emit('completed', finishedJob)
    }
  }

  // Guardar datos en historial para el gráfico de telemetría
  updateTelemetryData(nozzleTemp.value, bedTemp.value)

  // Actualizar base de datos periódicamente (cada 8 segundos o al cambiar de fase)
  if (elapsedSeconds % 8 === 0 && status.value !== 'completed') {
    const elapsedMinutes = Math.round((elapsedSeconds / totalEstimatedSeconds) * (props.activeModel?.estimated_time_min || 60))
    dbService.updatePrintJobStatus(currentJobId, {
      status: status.value,
      progress: progress.value,
      nozzle_temp: nozzleTemp.value,
      bed_temp: bedTemp.value,
      elapsed_time_min: elapsedMinutes
    })
  }

  // Redibujar gráficos y simulador
  drawTelemetryGraph()
  drawPrintSimulation()
}

// ==========================================
// METODOS DE TELEMETRÍA Y LOGS
// ==========================================

const addTerminalLog = (msg: string, type: 'command' | 'info' | 'success' | 'error') => {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  terminalLogs.value.push({ time: timeStr, msg, type })

  // Limitar logs a 120 líneas
  if (terminalLogs.value.length > 120) {
    terminalLogs.value.shift()
  }

  // Auto-scroll al final
  nextTick(() => {
    if (terminalLog.value) {
      terminalLog.value.scrollTop = terminalLog.value.scrollHeight
    }
  })
}

const updateTelemetryData = (nozzle: number, bed: number) => {
  tempHistory.nozzle.shift()
  tempHistory.nozzle.push(nozzle)

  tempHistory.bed.shift()
  tempHistory.bed.push(bed)
}

// Dibujar el gráfico de telemetría en el Canvas
const drawTelemetryGraph = () => {
  const canvas = tempCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  // Limpiar fondo con gradiente oscuro
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, w, h)

  // Dibujar cuadrícula de fondo
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
  ctx.lineWidth = 1
  for (let i = 20; i < h; i += 25) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(w, i)
    ctx.stroke()
  }

  // Dibujar líneas de referencia de temperatura objetivo (Target)
  if (status.value !== 'idle') {
    // Boquilla objetivo (Nozzle Target)
    const ny = h - 10 - (targetNozzleTemp.value / 260) * (h - 20)
    ctx.strokeStyle = 'rgba(239, 83, 80, 0.25)'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, ny)
    ctx.lineTo(w, ny)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(239, 83, 80, 0.6)'
    ctx.font = '9px monospace'
    ctx.fillText(`${targetNozzleTemp.value}°C`, 5, ny - 3)

    // Cama objetivo (Bed Target)
    const by = h - 10 - (targetBedTemp.value / 260) * (h - 20)
    ctx.strokeStyle = 'rgba(33, 150, 243, 0.25)'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, by)
    ctx.lineTo(w, by)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(33, 150, 243, 0.6)'
    ctx.fillText(`${targetBedTemp.value}°C`, w - 35, by - 3)
  }

  const drawLine = (data: number[], color: string, glowColor: string) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.shadowColor = glowColor
    ctx.shadowBlur = 8

    ctx.beginPath()
    const pointsCount = data.length
    for (let i = 0; i < pointsCount; i++) {
      const val = data[i]
      const x = (i / (pointsCount - 1)) * (w - 20) + 10
      // Escalar de 0 a 260 grados Celsius en el eje Y
      const y = h - 10 - (val / 260) * (h - 20)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.shadowBlur = 0 // Resetear sombra
  }

  // Dibujar curva de la cama caliente (Azul)
  drawLine(tempHistory.bed, '#2196f3', 'rgba(33, 150, 243, 0.5)')

  // Dibujar curva de la boquilla (Rojo)
  drawLine(tempHistory.nozzle, '#ef5350', 'rgba(239, 83, 80, 0.5)')
}

// Dibujar la simulación física de la impresión (Movimiento del cabezal y pieza en 2D)
const drawPrintSimulation = () => {
  const canvas = simCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  // Fondo cyberpunk oscuro
  ctx.fillStyle = '#0a0f1d'
  ctx.fillRect(0, 0, w, h)

  // Cama de impresión virtual
  ctx.strokeStyle = 'rgba(33, 150, 243, 0.15)'
  ctx.lineWidth = 1
  ctx.strokeRect(10, 10, w - 20, h - 20)

  // Si no está imprimiendo, mostrar inactivo
  if (status.value === 'idle') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.font = '13px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('IMPRESORA 3D FUERA DE LÍNEA', w / 2, h / 2)
    return
  }

  // Dibujar la pieza creciendo (Representado por capas circulares o patrones en el centro)
  if (status.value === 'printing' || status.value === 'completed') {
    const cx = w / 2
    const cy = h / 2
    const maxRadius = Math.min(w, h) * 0.3

    // Crecimiento concéntrico según progreso
    const currentProgressRatio = (progress.value - 15) / 85 // Progreso desde fase de impresión
    const printRatio = Math.max(0, currentProgressRatio)

    ctx.fillStyle = 'rgba(0, 229, 255, 0.04)'
    ctx.beginPath()
    ctx.arc(cx, cy, maxRadius * 0.9, 0, Math.PI * 2)
    ctx.fill()

    // Dibujar múltiples círculos simulando perímetros concéntricos de filamento
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'
    ctx.lineWidth = 1.5
    for (let r = 10; r < maxRadius * printRatio; r += 6) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Dibujar el Cabezal/Boquilla moviéndose (Solo si está operando)
  if (status.value === 'printing' || status.value === 'leveling') {
    // Mapear coordenadas (0-220 mm) al canvas
    const margin = 10
    const mapX = margin + (printX.value / 220) * (w - 2 * margin)
    const mapY = margin + (printY.value / 220) * (h - 2 * margin)

    // Líneas de guía de pórtico del eje X e Y (Estructura de impresora CoreXY)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    // Guía horizontal X
    ctx.beginPath()
    ctx.moveTo(10, mapY)
    ctx.lineTo(w - 10, mapY)
    ctx.stroke()
    // Guía vertical Y
    ctx.beginPath()
    ctx.moveTo(mapX, 10)
    ctx.lineTo(mapX, h - 10)
    ctx.stroke()

    // Dibujar la boquilla extrusora (Círculo rojo brillante / boquilla de latón dorada)
    ctx.shadowColor = '#ef5350'
    ctx.shadowBlur = 10
    
    // Boquilla latón
    ctx.fillStyle = '#ff9800'
    ctx.beginPath()
    ctx.moveTo(mapX, mapY)
    ctx.lineTo(mapX - 6, mapY - 10)
    ctx.lineTo(mapX + 6, mapY - 10)
    ctx.closePath()
    ctx.fill()

    // Destello de calor/filamento fundido
    ctx.fillStyle = '#ef5350'
    ctx.beginPath()
    ctx.arc(mapX, mapY, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.shadowBlur = 0 // Resetear sombra
  }
}

// ==========================================
// CONTROLES DE LA IMPRESORA
// ==========================================

const pausePrint = () => {
  if (status.value === 'printing' || status.value === 'heating' || status.value === 'leveling') {
    status.value = 'paused'
    emit('status-change', 'paused')
    addTerminalLog('M25 ; Pausar impresión de tarjeta SD', 'command')
    addTerminalLog('M117 Impresión pausada temporalmente', 'info')
  }
}

const resumePrint = () => {
  if (status.value === 'paused') {
    status.value = 'printing'
    emit('status-change', 'printing')
    addTerminalLog('M24 ; Reanudar impresión desde tarjeta SD', 'command')
    addTerminalLog('M117 Reanudando trabajo...', 'info')
  }
}

const cancelPrint = () => {
  status.value = 'failed'
  emit('status-change', 'failed')
  
  if (simulationInterval) {
    clearInterval(simulationInterval)
    simulationInterval = null
  }

  nozzleTemp.value = 22
  bedTemp.value = 22
  progress.value = 0
  addTerminalLog('M112 ; Parada de emergencia forzada', 'error')
  addTerminalLog('M104 S0 ; Apagar boquilla inmediatamente', 'command')
  addTerminalLog('M140 S0 ; Apagar cama inmediatamente', 'command')
  addTerminalLog('M117 Impresión abortada por el operador', 'error')

  // Guardar cancelación en base de datos
  dbService.updatePrintJobStatus(currentJobId, {
    status: 'failed',
    nozzle_temp: 22,
    bed_temp: 22
  })
}

// Observar cambio de dimensiones para ajustar tamaño de canvas
watch(activeTab, (newTab) => {
  if (newTab === 'graph') {
    nextTick(() => {
      drawTelemetryGraph()
    })
  }
})

onMounted(() => {
  drawTelemetryGraph()
  drawPrintSimulation()
})

onBeforeUnmount(() => {
  if (simulationInterval) {
    clearInterval(simulationInterval)
  }
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

.card-scroll-content {
  overflow-y: auto;
  max-height: calc(100vh - 170px);
}

.stat-small {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  padding: 4px 6px;
}

.sim-screen {
  position: relative;
  height: 150px;
  background-color: #0a0f1d;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.screen-label {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.8);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.6rem;
  font-family: monospace;
  letter-spacing: 1px;
  font-weight: 700;
  color: #00e5ff;
  border: 1px solid rgba(0, 229, 255, 0.3);
}

.border-bottom-dark {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.terminal-log {
  background: #070a13;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  height: 140px;
  overflow-y: auto;
  padding: 8px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  line-height: 1.35;
}

.terminal-line {
  margin-bottom: 3px;
  white-space: pre-wrap;
  word-break: break-all;
}

.terminal-timestamp {
  color: #8f9bb3;
}

.command {
  color: #4fc3f7; /* Azul claro para comandos G-code */
}

.info {
  color: #e0e0e0; /* Gris para textos informativos */
}

.success {
  color: #81c784; /* Verde para éxitos */
}

.error {
  color: #e57373; /* Rojo para errores */
}

.spin-icon {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-glow {
  text-shadow: 0 0 8px rgba(33, 150, 243, 0.6);
}

.relative-container {
  position: relative;
  width: 100%;
}

canvas {
  display: block;
}
</style>
