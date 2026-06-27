<template>
  <v-app theme="dark" class="app-bg">
    <!-- BARRA DE NAVEGACIÓN SUPERIOR -->
    <v-app-bar flat class="glass-bar px-4">
      <v-icon color="primary" size="32" class="me-2 animate-glow">mdi-printer-3d-nozzle</v-icon>
      <v-app-bar-title class="font-weight-black tracking-wide text-h6 text-white">
        PAPOIS <span class="text-primary">EN 3D</span>
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <!-- Selector de Vista (Solo si está logueado como Operador o Admin) -->
      <v-btn-toggle v-if="isLoggedIn && (userRole === 'admin' || userRole === 'operator')" v-model="activeView"
        mandatory variant="flat" density="compact" color="primary" class="glass-toggle me-4">
        <v-btn value="dashboard" prepend-icon="mdi-view-dashboard">Dashboard</v-btn>
        <v-btn value="history" prepend-icon="mdi-history">Historial</v-btn>
        <v-btn v-if="userRole === 'admin'" value="admin" prepend-icon="mdi-shield-account">Administración</v-btn>
      </v-btn-toggle>

      <!-- Botón de Invitado / Perfil de Usuario -->
      <div class="d-flex align-center gap-2">
        <!-- Indicador de conexión a Supabase -->
        <v-chip v-if="userRole === 'admin'" :color="supabaseConnected ? 'success' : 'warning'" variant="tonal"
          size="small" class="font-weight-bold d-none d-sm-flex"
          :prepend-icon="supabaseConnected ? 'mdi-database-check' : 'mdi-database-off'">
          {{ supabaseConnected ? 'Supabase' : 'Local' }}
        </v-chip>

        <!-- Menú de Usuario / Botón de Login -->
        <v-btn v-if="userRole === 'guest'" color="primary" variant="flat" prepend-icon="mdi-login"
          class="text-none font-weight-bold" size="small" @click="showAuthDialog = true">
          Iniciar Sesión
        </v-btn>

        <v-menu v-else>
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" color="primary" variant="tonal" prepend-icon="mdi-account-circle"
              class="text-none font-weight-bold" size="small">
              {{ userProfile?.full_name.split(' ')[0] }}
              <v-chip :color="getRoleColor(userRole)" size="x-small" class="ms-2 font-weight-black">
                {{ getRoleText(userRole) }}
              </v-chip>
            </v-btn>
          </template>
          <v-list theme="dark" class="bg-surface-light border-dark-list">
            <v-list-item-subtitle class="px-4 py-2 text-caption text-grey-darken-1">
              Sesión: {{ authStore.user?.email }}
            </v-list-item-subtitle>
            <v-divider class="border-opacity-25"></v-divider>
            <v-list-item @click="authStore.logout(); activeView = 'dashboard'" prepend-icon="mdi-logout" color="error">
              <v-list-item-title class="text-body-2 text-error font-weight-bold">Cerrar Sesión</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </v-app-bar>

    <!-- CONTENIDO PRINCIPAL -->
    <v-main class="pt-16">
      <!-- 1. LANDING PAGE INTERACTIVA (Se muestra solo a usuarios Invitados no autenticados) -->
      <div v-if="userRole === 'guest' && !showGuestDashboard" class="landing-container w-100">
        <!-- HERO SECTION -->
        <section class="section-hero d-flex flex-column align-center justify-center text-center px-4">
          <v-chip color="primary" variant="tonal" class="mb-4 font-weight-bold" size="large">
            ✨ Plataforma Inteligente de Manufactura Aditiva
          </v-chip>
          <h1 class="text-h2 font-weight-black text-white mb-4 line-height-tight">
            PAPOIS <span class="text-primary animate-glow">EN 3D</span>
          </h1>
          <p class="text-h6 text-grey-lighten-1 max-width-700 mb-8 font-weight-light">
            El entorno definitivo para el análisis geométrico, cotización precisa de filamento y asesoramiento con
            Inteligencia Artificial para impresión 3D.
          </p>
          <div class="d-flex flex-wrap justify-center gap-4">
            <v-btn color="primary" size="large" variant="flat" prepend-icon="mdi-rocket-launch"
              class="text-none font-weight-bold px-8 pulse-btn" @click="showAuthDialog = true">
              Comenzar Ahora
            </v-btn>
            <v-btn color="white" size="large" variant="outlined" prepend-icon="mdi-cube-outline"
              class="text-none font-weight-bold px-8" @click="enterAsGuest">
              Probar Simulador (Invitado)
            </v-btn>
          </div>
        </section>

        <!-- SECCIÓN 1: VISUALIZACIÓN INTERACTIVA 3D -->
        <section class="feature-section py-16 px-6">
          <v-container>
            <v-row class="align-center">
              <v-col cols="12" md="6">
                <div class="pe-md-8">
                  <v-chip color="primary" variant="tonal" class="mb-3 font-weight-bold" size="small">CARACTERÍSTICA
                    I</v-chip>
                  <h2 class="text-h4 font-weight-bold text-white mb-4">Visualización WebGL 3D en Tiempo Real</h2>
                  <p class="text-body-1 text-grey-darken-1 mb-6">
                    Renderiza tus archivos STL directamente en el navegador con aceleración por hardware. Examina la
                    pieza
                    desde cualquier ángulo, activa el modo de malla de alambre (wireframe) para inspeccionar la
                    topología de
                    triángulos y encuadra el modelo sobre una cama caliente virtual de 220x220 mm.
                  </p>
                  <div class="d-flex align-center gap-3">
                    <v-icon color="primary">mdi-check-circle-outline</v-icon>
                    <span class="text-body-2 text-grey-lighten-1">Controles orbitales intuitivos (giro, zoom,
                      paneo).</span>
                  </div>
                  <div class="d-flex align-center gap-3 mt-2">
                    <v-icon color="primary">mdi-check-circle-outline</v-icon>
                    <span class="text-body-2 text-grey-lighten-1">Modos de visualización sólido, translúcido y malla
                      estructural.</span>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <!-- Visor 3D Demostrativo 1 -->
                <div class="mini-viewer-card">
                  <div ref="miniCanvas1" class="mini-canvas"></div>
                  <div class="mini-viewer-overlay">Muestra: Torus Knot (Geometría Compleja)</div>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </section>

        <!-- SECCIÓN 2: COTIZACIÓN INTELIGENTE DE MATERIAL -->
        <section class="feature-section py-16 px-6 bg-dark-section">
          <v-container>
            <v-row class="align-center flex-md-row-reverse">
              <v-col cols="12" md="6">
                <div class="ps-md-8">
                  <v-chip color="secondary" variant="tonal" class="mb-3 font-weight-bold" size="small">CARACTERÍSTICA
                    II</v-chip>
                  <h2 class="text-h4 font-weight-bold text-white mb-4">Cotización y Estimación de Materiales</h2>
                  <p class="text-body-1 text-grey-darken-1 mb-6">
                    Calcula dinámicamente el peso neto del filamento en gramos, la longitud del hilo continuo de 1.75 mm
                    que
                    consumirá la extrusora y el costo estimado en USD según el tipo de filamento seleccionado (PLA, ABS,
                    PETG o TPU). El rebanador matemático se adapta instantáneamente a tus cambios de relleno (infill),
                    altura de capa y uso de soportes.
                  </p>
                  <div class="d-flex align-center gap-3">
                    <v-icon color="secondary">mdi-check-circle-outline</v-icon>
                    <span class="text-body-2 text-grey-lighten-1">Fórmulas basadas en volumetría y densidades físicas
                      reales.</span>
                  </div>
                  <div class="d-flex align-center gap-3 mt-2">
                    <v-icon color="secondary">mdi-check-circle-outline</v-icon>
                    <span class="text-body-2 text-grey-lighten-1">Precios e infill ajustables en tiempo real con
                      recálculo
                      dinámico.</span>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <!-- Visor 3D Demostrativo 2 -->
                <div class="mini-viewer-card border-secondary">
                  <div ref="miniCanvas2" class="mini-canvas"></div>
                  <div class="mini-viewer-overlay color-sec">Muestra: Florero Geométrico (Ajuste de Infill)</div>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </section>

        <!-- SECCIÓN 3: CÁLCULOS DE CARACTERÍSTICAS Y SLICER -->
        <section class="feature-section py-16 px-6">
          <v-container>
            <v-row class="align-center">
              <v-col cols="12" md="6">
                <div class="pe-md-8">
                  <v-chip color="info" variant="tonal" class="mb-3 font-weight-bold" size="small">CARACTERÍSTICA
                    III</v-chip>
                  <h2 class="text-h4 font-weight-bold text-white mb-4">Cálculos de Dimensiones y Volumen Real</h2>
                  <p class="text-body-1 text-grey-darken-1 mb-6">
                    El motor de parseo lee los bytes del archivo y extrae el volumen del sólido real en centímetros
                    cúbicos
                    ($cm^3$) sumando tetraedros en el espacio tridimensional. Identifica el tamaño exacto de la caja
                    delimitadora (Bounding Box X, Y, Z) para verificar si la pieza cabe físicamente en tu volumen de
                    impresión.
                  </p>
                  <div class="d-flex align-center gap-3">
                    <v-icon color="info">mdi-check-circle-outline</v-icon>
                    <span class="text-body-2 text-grey-lighten-1">Verificación de cotas y colisiones con el volumen
                      límite
                      de cama.</span>
                  </div>
                  <div class="d-flex align-center gap-3 mt-2">
                    <v-icon color="info">mdi-check-circle-outline</v-icon>
                    <span class="text-body-2 text-grey-lighten-1">Detección y conteo exacto de facetas (triángulos
                      geométricos).</span>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <!-- Visor 3D Demostrativo 3 -->
                <div class="mini-viewer-card border-info">
                  <div ref="miniCanvas3" class="mini-canvas"></div>
                  <div class="mini-viewer-overlay color-info">Muestra: Engranaje Industrial (Cálculo de Cotas)</div>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </section>

        <!-- SECCIÓN DE LLAMADO A LA ACCIÓN FINAL -->
        <section class="py-16 text-center px-4 bg-dark-section">
          <v-icon color="primary" size="48" class="mb-4">mdi-lock-open-outline</v-icon>
          <h2 class="text-h4 font-weight-bold text-white mb-4">¿Listo para Optimizar tus Impresiones?</h2>
          <p class="text-body-1 text-grey-darken-1 max-width-600 mx-auto mb-8">
            Crea una cuenta en segundos para desbloquear el Dashboard de trabajo, subir tus propios archivos STL,
            analizar
            tus piezas con el Asistente de IA y registrar tus cotizaciones en Supabase.
          </p>
          <v-btn color="primary" size="large" variant="flat" class="font-weight-bold text-none px-12"
            @click="showAuthDialog = true">
            Registrarse / Iniciar Sesión
          </v-btn>
        </section>
      </div>

      <!-- 2. WORKSPACE / DASHBOARD PRIVADO (Para Operadores, Admins o Invitados que hacen click en Probar) -->
      <v-container fluid class="pa-4 fill-height align-start" v-else>
        <!-- A. VISTA DASHBOARD DE TRABAJO -->
        <v-row v-if="activeView === 'dashboard'" class="fill-height ma-0" dense>
          <!-- PANEL IZQUIERDO: ANALIZADOR Y CONTROL DE PARÁMETROS -->
          <v-col cols="12" md="4" class="pa-2 d-flex flex-column">
            <ModelAnalyzer @loaded="onModelLoaded" @print="onPrintTriggered" />
          </v-col>

          <!-- PANEL CENTRAL: VISOR 3D INTERACTIVO -->
          <v-col cols="12" md="5" class="pa-2 d-flex flex-column">
            <Model3DViewer :positions="positions" :boundingBoxSize="boundingBoxSize" :boundingBoxMin="boundingBoxMin"
              :boundingBoxMax="boundingBoxMax" />
          </v-col>

          <!-- PANEL DERECHO: ASISTENTE DE IA / CONSOLA DE IMPRESIÓN -->
          <v-col cols="12" md="3" class="pa-2 d-flex flex-column">
            <!-- Consola de Impresión (Simulación) -->
            <PrinterConsole v-show="isPrintingActive" ref="printerConsole" :activeModel="activeModel"
              @status-change="onPrinterStatusChange" @completed="onPrintCompleted" />

            <!-- Chat de IA Asistente -->
            <AIChatAssistant v-show="!isPrintingActive" :activeModel="activeModel" />
          </v-col>
        </v-row>

        <!-- B. VISTA HISTORIAL DE MODELOS -->
        <div v-else-if="activeView === 'history'" class="w-100 pa-2">
          <div class="d-flex justify-space-between align-center mb-6">
            <div>
              <h2 class="text-h5 font-weight-black text-white">Historial de Modelos de {{ userProfile?.full_name }}</h2>
              <p class="text-body-2 text-grey-darken-1">Modelos y cotizaciones persistidas</p>
            </div>
            <v-btn color="primary" variant="outlined" prepend-icon="mdi-refresh" @click="loadHistory" class="text-none">
              Actualizar Historial
            </v-btn>
          </div>

          <!-- Grid de Historial -->
          <v-row v-if="savedModels.length > 0">
            <v-col v-for="model in savedModels" :key="model.id" cols="12" sm="6" md="4" lg="3" class="pa-2">
              <v-card class="glass-card h-100 d-flex flex-column">
                <v-card-item class="pb-1">
                  <v-card-title class="text-subtitle-1 font-weight-bold text-truncate" :title="model.name">
                    {{ model.name }}
                  </v-card-title>
                  <v-card-subtitle class="monospace text-caption text-primary">
                    {{ formatDate(model.created_at) }}
                  </v-card-subtitle>
                </v-card-item>

                <!-- Especificaciones del Historial -->
                <v-card-text class="py-2 flex-grow-1">
                  <div class="d-flex justify-space-between text-body-2 mb-1">
                    <span class="text-grey-darken-1">Volumen:</span>
                    <span class="font-weight-medium text-white">{{ model.volume_cm3.toFixed(2) }} cm³</span>
                  </div>
                  <div class="d-flex justify-space-between text-body-2 mb-1">
                    <span class="text-grey-darken-1">Dimensiones:</span>
                    <span class="font-weight-medium text-white">
                      {{ Math.round(model.bounding_box_x) }}x{{ Math.round(model.bounding_box_y) }}x{{
                        Math.round(model.bounding_box_z) }} mm
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
                  <v-btn color="primary" variant="tonal" block size="small" prepend-icon="mdi-cube-outline"
                    class="text-none font-weight-bold" @click="loadModelIntoDashboard(model)">
                    Cargar en Visor
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>

          <!-- Placeholder vacío -->
          <div v-else class="d-flex flex-column align-center justify-center py-16 text-center w-100">
            <v-icon size="80" color="grey-darken-3" class="mb-4">mdi-folder-open-outline</v-icon>
            <h3 class="text-h6 text-grey-lighten-1 mb-1">No hay modelos analizados</h3>
            <p class="text-body-2 text-grey-darken-1 max-width-300">
              Sube y analiza archivos en el Dashboard para registrarlos en tu base de datos Supabase.
            </p>
          </div>
        </div>

        <!-- C. VISTA PANEL DE ADMINISTRACIÓN (Solo para administradores) -->
        <div v-else-if="activeView === 'admin' && userRole === 'admin'" class="w-100 pa-2">
          <AdminPanel />
        </div>
      </v-container>
    </v-main>

    <!-- Diálogo de Autenticación -->
    <AuthDialog v-model="showAuthDialog" @success="onAuthSuccess" />
  </v-app>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed, watch } from 'vue'
import * as THREE from 'three'
import { isSupabaseConfigured, dbService } from '../lib/supabase'
import type { ModelData } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

// Importar Componentes
import ModelAnalyzer from '../components/ModelAnalyzer.vue'
import Model3DViewer from '../components/Model3DViewer.vue'
import PrinterConsole from '../components/PrinterConsole.vue'
import AIChatAssistant from '../components/AIChatAssistant.vue'
import AuthDialog from '../components/AuthDialog.vue'
import AdminPanel from '../components/AdminPanel.vue'

// Inicializar Store de Autenticación
const authStore = useAuthStore()

// Estado
const activeView = ref<'dashboard' | 'history' | 'admin'>('dashboard')
const supabaseConnected = ref(isSupabaseConfigured)
const showAuthDialog = ref(false)
const showGuestDashboard = ref(false)
const savedModels = ref<ModelData[]>([])

// Datos del modelo activo
const activeModel = ref<ModelData | null>(null)
const positions = ref<Float32Array | null>(null)
const boundingBoxSize = ref<{ x: number; y: number; z: number } | null>(null)
const boundingBoxMin = ref<{ x: number; y: number; z: number } | null>(null)
const boundingBoxMax = ref<{ x: number; y: number; z: number } | null>(null)

// Estatus de la impresora
const printerConsole = ref<any>(null)
const printerStatus = ref('idle')

// Referencias a Canvas de Landing Page
const miniCanvas1 = ref<HTMLDivElement | null>(null)
const miniCanvas2 = ref<HTMLDivElement | null>(null)
const miniCanvas3 = ref<HTMLDivElement | null>(null)

// Estructuras de control para los visualizadores de la landing page
let miniScenes: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; mesh: THREE.Mesh }[] = []
let animationFrameId: number | null = null

// Computados de Sesión
const isLoggedIn = computed(() => authStore.profile !== null)
const userRole = computed(() => authStore.profile?.role || 'guest')
const userProfile = computed(() => authStore.profile)

const isPrintingActive = computed(() => {
  return ['heating', 'leveling', 'printing', 'paused'].includes(printerStatus.value)
})

// ==========================================
// CICLO DE VIDA Y AUTENTICACIÓN
// ==========================================

onMounted(async () => {
  await authStore.initializeAuth()

  // Si es un invitado (no logueado), inicializar los visualizadores 3D en la landing page
  if (userRole.value === 'guest' && !showGuestDashboard.value) {
    nextTick(() => {
      initLandingViewers()
    })
  }

  loadHistory()
})

onBeforeUnmount(() => {
  destroyLandingViewers()
})

// Observar si el rol de usuario cambia (al loguearse o desloguearse)
watch(userRole, (newRole) => {
  if (newRole === 'guest' && !showGuestDashboard.value) {
    nextTick(() => {
      initLandingViewers()
    })
  } else {
    destroyLandingViewers()
  }
  loadHistory()
})

// Permitir probar como invitado de manera local
const enterAsGuest = () => {
  showGuestDashboard.value = true
  destroyLandingViewers()
}

// Al loguearse con éxito
const onAuthSuccess = () => {
  showGuestDashboard.value = false
  activeView.value = 'dashboard'
  loadHistory()
}

// ==========================================
// MINI VISUALISADORES 3D DE LANDING PAGE
// ==========================================

const initLandingViewers = () => {
  destroyLandingViewers() // Limpieza preventiva

  const canvases = [miniCanvas1.value, miniCanvas2.value, miniCanvas3.value]

  // Geometrías para cada sección
  // 1. Torus Knot (Estructura compleja)
  const geom1 = new THREE.TorusKnotGeometry(12, 4, 120, 16)
  // 2. Florero (Cilindro sin tapas con onda sinusoidal)
  const geom2 = new THREE.CylinderGeometry(10, 14, 26, 32, 16, true)
  // Aplicar deformación sinusoidal para simular un florero impreso en 3D
  const pos = geom2.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const angle = Math.atan2(pos.getZ(i), pos.getX(i))
    const scale = 1.0 + 0.25 * Math.sin(y * 0.3)
    pos.setX(i, pos.getX(i) * scale)
    pos.setZ(i, pos.getZ(i) * scale)
  }
  geom2.computeVertexNormals()

  // 3. Engranaje industrial
  const geom3 = new THREE.CylinderGeometry(15, 15, 10, 24, 2)
  const pos3 = geom3.attributes.position
  // Extruir dientes del engranaje en los vértices externos alternados
  for (let i = 0; i < pos3.count; i++) {
    const y = pos3.getY(i)
    if (Math.abs(y) < 4.9) { // Solo en el cuerpo, no tapas
      const idx = i % 24
      if (idx % 2 === 0) {
        pos3.setX(i, pos3.getX(i) * 1.18)
        pos3.setZ(i, pos3.getZ(i) * 1.18)
      }
    }
  }
  geom3.computeVertexNormals()

  const geometries = [geom1, geom2, geom3]
  const colors = ['#00e5ff', '#9c27b0', '#2196f3'] // Cian, Violeta, Azul

  canvases.forEach((container, idx) => {
    if (!container) return

    const w = container.clientWidth || 340
    const h = container.clientHeight || 260

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f172a') // Fondo oscuro de sección

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 100)
    camera.position.set(0, 5, 38)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Luces
    const ambientLight = new THREE.AmbientLight('#111827', 1.5)
    scene.add(ambientLight)

    const dirLight1 = new THREE.DirectionalLight('#ffffff', 1.5)
    dirLight1.position.set(10, 20, 15)
    scene.add(dirLight1)

    const pointLight = new THREE.PointLight(colors[idx], 2, 50)
    pointLight.position.set(-10, -5, 10)
    scene.add(pointLight)

    // Material plástico reflectante neón
    const material = new THREE.MeshStandardMaterial({
      color: colors[idx],
      roughness: 0.15,
      metalness: 0.25,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometries[idx], material)
    mesh.position.y = idx === 1 ? -2 : 0 // Ajuste vertical menor
    scene.add(mesh)

    miniScenes.push({ scene, camera, renderer, mesh })
  })

  // Animar los mini visualizadores
  const animateLanding = () => {
    animationFrameId = requestAnimationFrame(animateLanding)

    miniScenes.forEach((s) => {
      // Rotación constante en ejes Y y X
      s.mesh.rotation.y += 0.012
      s.mesh.rotation.x += 0.004
      s.renderer.render(s.scene, s.camera)
    })
  }

  animateLanding()
}

const destroyLandingViewers = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  miniScenes.forEach((s) => {
    s.mesh.geometry.dispose()
    if (Array.isArray(s.mesh.material)) {
      s.mesh.material.forEach(m => m.dispose())
    } else {
      s.mesh.material.dispose()
    }
    s.renderer.dispose()
  })

  miniScenes = []

  if (miniCanvas1.value) miniCanvas1.value.innerHTML = ''
  if (miniCanvas2.value) miniCanvas2.value.innerHTML = ''
  if (miniCanvas3.value) miniCanvas3.value.innerHTML = ''
}

// ==========================================
// EVENTOS DASHBOARD
// ==========================================

const onModelLoaded = (data: any) => {
  positions.value = data.positions
  boundingBoxSize.value = data.boundingBox.size
  boundingBoxMin.value = data.boundingBox.min
  boundingBoxMax.value = data.boundingBox.max

  activeModel.value = {
    id: data.id,
    user_id: authStore.user?.id || 'guest-id',
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

const onPrintTriggered = (savedModel: ModelData) => {
  // Comprobación de rol de Invitado
  if (userRole.value === 'guest') {
    alert('Operación Bloqueada: Los usuarios con rol de Invitado no pueden guardar modelos ni registrar cotizaciones. Por favor, inicia sesión para habilitar la simulación.')
    showAuthDialog.value = true
    return
  }

  activeModel.value = savedModel
  printerStatus.value = 'heating'

  nextTick(() => {
    if (printerConsole.value) {
      printerConsole.value.startPrint(savedModel)
    }
  })
}

const onPrinterStatusChange = (newStatus: string) => {
  printerStatus.value = newStatus
}

const onPrintCompleted = () => {
  loadHistory()
}

// Cargar historial con filtros por usuario
const loadHistory = async () => {
  if (!isLoggedIn.value) {
    savedModels.value = []
    return
  }
  try {
    savedModels.value = await dbService.getModels(authStore.user?.id, userRole.value)
  } catch (err) {
    console.error('Error cargando historial de modelos:', err)
  }
}

// Cargar un modelo guardado en el visor
const loadModelIntoDashboard = (model: ModelData) => {
  activeModel.value = model
  positions.value = generateBoxVertices(model.bounding_box_x, model.bounding_box_y, model.bounding_box_z)
  boundingBoxSize.value = { x: model.bounding_box_x, y: model.bounding_box_y, z: model.bounding_box_z }
  boundingBoxMin.value = { x: -model.bounding_box_x / 2, y: 0, z: -model.bounding_box_z / 2 }
  boundingBoxMax.value = { x: model.bounding_box_x / 2, y: model.bounding_box_z, z: model.bounding_box_z / 2 }
  activeView.value = 'dashboard'
  printerStatus.value = 'idle'
}

// Genera un cubo de malla para Three.js representando las dimensiones físicas
const generateBoxVertices = (dx: number, dy: number, dz: number): Float32Array => {
  const x = dx / 2
  const y = dy
  const z = dz / 2
  const v = new Float32Array([
    -x, 0, z, x, 0, z, x, y, z, -x, 0, z, x, y, z, -x, y, z,
    -x, 0, -z, -x, y, -z, x, y, -z, -x, 0, -z, x, y, -z, x, 0, -z,
    -x, y, -z, -x, y, z, x, y, z, -x, y, -z, x, y, z, x, y, -z,
    -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, -z, x, 0, z, -x, 0, z,
    x, 0, -z, x, y, -z, x, y, z, x, 0, -z, x, y, z, x, 0, z,
    -x, 0, -z, -x, 0, z, -x, y, z, -x, 0, -z, -x, y, z, -x, y, -z
  ])
  return v
}

// ==========================================
// FORMATOS Y ROLES AUXILIARES
// ==========================================

const getRoleText = (role: string) => {
  switch (role) {
    case 'admin': return 'ADMINISTRADOR'
    case 'operator': return 'OPERADOR'
    case 'guest': return 'INVITADO'
    default: return role.toUpperCase()
  }
}

const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin': return 'secondary'
    case 'operator': return 'primary'
    case 'guest': return 'grey-darken-2'
    default: return 'white'
  }
}

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
</script>

<style scoped>
/* ESTILOS DE LANDING PAGE PREMIUM */
.landing-container {
  min-height: 100vh;
  overflow-x: hidden;
}

.section-hero {
  height: calc(90vh - 64px);
  background: radial-gradient(circle at 50% 30%, rgba(33, 150, 243, 0.08) 0%, rgba(10, 14, 23, 0) 60%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.line-height-tight {
  line-height: 1.15;
}

.max-width-700 {
  max-width: 700px;
}

.max-width-600 {
  max-width: 600px;
}

.feature-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.bg-dark-section {
  background: rgba(0, 0, 0, 0.15);
}

.mini-viewer-card {
  position: relative;
  height: 280px;
  background: #0f172a;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid rgba(0, 229, 255, 0.15);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.mini-viewer-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5);
  border-color: rgba(0, 229, 255, 0.5);
}

.border-secondary {
  border-color: rgba(156, 39, 176, 0.15);
}

.border-secondary:hover {
  border-color: rgba(156, 39, 176, 0.5);
}

.border-info {
  border-color: rgba(33, 150, 243, 0.15);
}

.border-info:hover {
  border-color: rgba(33, 150, 243, 0.5);
}

.mini-canvas {
  width: 100%;
  height: 100%;
}

.mini-viewer-overlay {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(10, 14, 23, 0.8);
  backdrop-filter: blur(4px);
  border-left: 3px solid #00e5ff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  color: #00e5ff;
  letter-spacing: 0.5px;
}

.color-sec {
  border-left-color: #9c27b0;
  color: #e040fb;
}

.color-info {
  border-left-color: #2196f3;
  color: #90caf9;
}

/* ESTILOS DE COMPONENTES DE TRABAJO */
.glass-card {
  background: rgba(15, 23, 42, 0.45) !important;
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2) !important;
}

.glass-toggle {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 8px;
  overflow: hidden;
}

.bg-surface-light {
  background: #182235 !important;
}

.border-dark-list {
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.monospace {
  font-family: 'Courier New', Courier, monospace !important;
}

.pulse-btn {
  background: linear-gradient(135deg, #2196f3, #00d2ff) !important;
  box-shadow: 0 0 15px rgba(33, 150, 243, 0.4);
}

.pulse-btn:hover {
  box-shadow: 0 0 25px rgba(0, 210, 255, 0.7);
}
</style>
