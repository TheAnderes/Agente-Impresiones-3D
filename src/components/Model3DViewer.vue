<template>
  <div class="viewer-container">
    <div v-if="!positions || positions.length === 0" class="viewer-placeholder d-flex flex-column align-center justify-center">
      <v-icon size="64" color="grey-lighten-1" class="mb-4 animate-pulse">mdi-printer-3d-nozzle-outline</v-icon>
      <div class="text-h6 text-grey-lighten-1 mb-2">Visor de Modelo 3D</div>
      <div class="text-body-2 text-grey-darken-1 text-center max-width-300">
        Carga un archivo STL para iniciar el análisis volumétrico en la Ender 3.
      </div>
    </div>

    <div v-else class="viewer-active-content">
      <div class="viewer-toolbar">
        <v-btn-toggle
          v-model="viewMode"
          mandatory
          variant="flat"
          density="compact"
          color="primary"
          class="glass-toggle"
        >
          <v-btn value="solid" size="small" prepend-icon="mdi-cube-outline">Sólido</v-btn>
          <v-btn value="wireframe" size="small" prepend-icon="mdi-iframe-outline">Malla</v-btn>
        </v-btn-toggle>

        <div class="glass-toggle-group ms-2">
          <v-btn
            :color="orientMode ? 'warning' : 'transparent'"
            variant="flat"
            size="small"
            class="action-btn-format"
            @click="toggleOrientMode"
            title="Alinear cara a la placa de impresión"
          >
            <v-icon size="16" class="me-2">{{ orientMode ? 'mdi-cursor-pointer' : 'mdi-tray-arrow-down' }}</v-icon>
            Alinear Cara
          </v-btn>

          <div class="inner-divider"></div>

          <v-btn
            color="transparent"
            variant="flat"
            size="small"
            class="action-btn-format"
            @click="resetCamera"
            title="Centrar Vista de la Cámara"
          >
            <v-icon size="16" class="me-2">mdi-camera-flip-outline</v-icon>
            Centrar Vista
          </v-btn>
        </div>
      </div>

      <div ref="canvasContainer" class="canvas-container" @click="handleCanvasClick"></div>

      <div ref="labelsContainer"></div>

      <v-fade-transition>
        <div v-if="autoScaledAlert" class="scale-warning-alert">
          <v-icon class="me-1" size="16">mdi-alert-circle-outline</v-icon>
          Modelo gigante autocomprimido para ajustarse a la cama.
        </div>
      </v-fade-transition>

      <div class="info-overlay-left">
        <span class="section-title">PIEZA ACTUAL</span>
        <div class="badge-row"><span class="lbl-x">X:</span> {{ currentModelDims.x.toFixed(1) }} mm</div>
        <div class="badge-row"><span class="lbl-y">Y:</span> {{ currentModelDims.y.toFixed(1) }} mm</div>
        <div class="badge-row"><span class="lbl-z">Z:</span> {{ currentModelDims.z.toFixed(1) }} mm</div>
      </div>

      <div class="info-overlay-right">
        <span class="section-title">VOLUMEN ÚTIL ENDER 3</span>
        <div class="badge-row-bed">220 mm <span class="lbl-bed">(Ancho)</span></div>
        <div class="badge-row-bed">220 mm <span class="lbl-bed">(Largo)</span></div>
        <div class="badge-row-bed">250 mm <span class="lbl-bed">(Alto Max)</span></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

const props = defineProps<{
  positions: Float32Array | null
  boundingBoxSize: { x: number; y: number; z: number } | null
  boundingBoxMin: { x: number; y: number; z: number } | null
  boundingBoxMax: { x: number; y: number; z: number } | null
}>()

const canvasContainer = ref<HTMLDivElement | null>(null)
const viewMode = ref<'solid' | 'wireframe'>('solid')
const orientMode = ref(false)
const autoScaledAlert = ref(false)

// Configuración de Costos y Material (Mapeado dinámico)
const PRECIO_POR_GRAMO_BOB = 1.0     
const CONFIG_WALL_THICKNESS = 1.2   
const CONFIG_MATERIAL_DENSITY = 1.24 
const CONFIG_INFILL_PERCENT = 15.0  

const currentModelDims = ref({ x: 0, y: 0, z: 0 })
const materialMetrics = ref({ peso: 0, costo: 0 })

// Instancias core de Three.js
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let labelRenderer: CSS2DRenderer | null = null
let controls: OrbitControls | null = null

let modelMesh: THREE.Mesh | null = null
let boxHelper: THREE.BoxHelper | null = null
let gridHelper: THREE.GridHelper | null = null
let animationFrameId: number | null = null

let labelX: CSS2DObject | null = null
let labelY: CSS2DObject | null = null
let labelZ: CSS2DObject | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

const BED_X = 220; const BED_Y = 220; const BED_Z = 250

const toggleOrientMode = () => { orientMode.value = !orientMode.value }

const initThree = () => {
  if (!canvasContainer.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0a0e17')
  scene.fog = new THREE.FogExp2('#0a0e17', 0.002)

  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  
  camera = new THREE.PerspectiveCamera(40, width / height, 1, 5000)
  camera.position.set(240, 200, 240)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true

  canvasContainer.value.innerHTML = ''
  canvasContainer.value.appendChild(renderer.domElement)

  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(width, height)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0px'
  labelRenderer.domElement.style.pointerEvents = 'none'
  canvasContainer.value.appendChild(labelRenderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2 - 0.01
  controls.minDistance = 30
  controls.maxDistance = 1200

  scene.add(new THREE.AmbientLight('#111827', 2.2))
  const sunLight = new THREE.DirectionalLight('#ffffff', 1.4)
  sunLight.position.set(160, 260, 110)
  scene.add(sunLight)

  gridHelper = new THREE.GridHelper(BED_X, 22, '#00e5ff', '#1e293b')
  scene.add(gridHelper)

  const volumeGeo = new THREE.BoxGeometry(BED_X, BED_Z, BED_Y)
  const volumeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(volumeGeo), 
    new THREE.LineBasicMaterial({ color: 'rgba(0, 229, 255, 0.12)' })
  )
  volumeLines.position.set(0, BED_Z / 2, 0)
  scene.add(volumeLines)

  labelX = createCotaDOM('cota-model-x')
  labelY = createCotaDOM('cota-model-y')
  labelZ = createCotaDOM('cota-model-z')

  window.addEventListener('resize', onWindowResize)
  animate()
}

const createCotaDOM = (className: string): CSS2DObject => {
  const div = document.createElement('div')
  div.className = `cota-label-3d ${className}`
  const obj = new CSS2DObject(div)
  scene?.add(obj)
  return obj
}

const animate = () => {
  animationFrameId = requestAnimationFrame(animate)
  if (controls) controls.update()

  if (renderer && scene && camera && labelRenderer) {
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
  }
}

const asentarModeloEnSuelo = () => {
  if (!modelMesh) return
  modelMesh.geometry.computeBoundingBox()
  const box = new THREE.Box3().setFromObject(modelMesh)
  modelMesh.position.y = (modelMesh.position.y - box.min.y)
}

const actualizarCotas3D = () => {
  if (!modelMesh) return

  const box = new THREE.Box3().setFromObject(modelMesh)
  const size = new THREE.Vector3()
  box.getSize(size)

  currentModelDims.value = { x: size.x, y: size.z, z: size.y }

  if (labelX) {
    labelX.position.set((box.max.x + box.min.x) / 2, box.min.y, box.max.z + 5)
    labelX.element.innerText = `X: ${size.x.toFixed(1)} mm`
  }
  if (labelY) {
    labelY.position.set(box.max.x + 5, box.min.y, (box.max.z + box.min.z) / 2)
    labelY.element.innerText = `Y: ${size.z.toFixed(1)} mm`
  }
  if (labelZ) {
    labelZ.position.set(box.min.x - 5, (box.max.y + box.min.y) / 2, box.min.z)
    labelZ.element.innerText = `Z: ${size.y.toFixed(1)} mm`
  }

  if (boxHelper) boxHelper.update()
}

const handleCanvasClick = (event: MouseEvent) => {
  if (!orientMode.value || !modelMesh || !camera) return

  const rect = renderer!.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObject(modelMesh)

  if (intersects.length > 0 && intersects[0].face) {
    const normal = intersects[0].face.normal.clone().applyQuaternion(modelMesh.quaternion)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, -1, 0))

    modelMesh.quaternion.premultiply(quaternion)
    asentarModeloEnSuelo()
    actualizarCotas3D()
    orientMode.value = false
  }
}

const calcularSlicerApproximation = (geometry: THREE.BufferGeometry) => {
  const position = geometry.attributes.position
  if (!position) return

  let volumeTotalMm3 = 0
  let areaSuperficialMm2 = 0

  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 3) {
    vA.fromBufferAttribute(position, i)
    vB.fromBufferAttribute(position, i + 1)
    vC.fromBufferAttribute(position, i + 2)

    const signedVolume = vA.dot(vB.cross(vC)) / 6.0
    volumeTotalMm3 += signedVolume

    const edge1 = new THREE.Vector3().subVectors(vB, vA)
    const edge2 = new THREE.Vector3().subVectors(vC, vA)
    const crossProduct = new THREE.Vector3().crossVectors(edge1, edge2)
    areaSuperficialMm2 += crossProduct.length() / 2.0
  }

  volumeTotalMm3 = Math.abs(volumeTotalMm3)

  let volumenCorazaMm3 = areaSuperficialMm2 * CONFIG_WALL_THICKNESS
  if (volumenCorazaMm3 > volumeTotalMm3) {
    volumenCorazaMm3 = volumeTotalMm3
  }

  const volumenNucleoMm3 = volumeTotalMm3 - volumenCorazaMm3
  const volumenPlasticoRealMm3 = volumenCorazaMm3 + (volumenNucleoMm3 * (CONFIG_INFILL_PERCENT / 100))
  
  const volumenCm3 = volumenPlasticoRealMm3 / 1000
  const pesoFinalGramos = volumenCm3 * CONFIG_MATERIAL_DENSITY
  const costoFinalBOB = pesoFinalGramos * PRECIO_POR_GRAMO_BOB

  materialMetrics.value = {
    peso: pesoFinalGramos,
    costo: costoFinalBOB
  }
}

const loadModel = () => {
  if (!scene || !props.positions || props.positions.length === 0) return

  autoScaledAlert.value = false

  if (modelMesh) {
    scene.remove(modelMesh)
    modelMesh.geometry.dispose()
  }
  if (boxHelper) scene.remove(boxHelper)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(props.positions, 3))
  geometry.computeVertexNormals()

  modelMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: '#00e5ff', roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide
  }))

  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  
  if (bbox) {
    const center = new THREE.Vector3()
    bbox.getCenter(center)
    geometry.translate(-center.x, -bbox.min.y, -center.z)

    const size = new THREE.Vector3()
    bbox.getSize(size)

    const maxAllowedDim = 180 
    const maxModelDim = Math.max(size.x, size.y, size.z)

    if (maxModelDim > BED_X) {
      const safetyScaleFactor = maxAllowedDim / maxModelDim
      modelMesh.scale.set(safetyScaleFactor, safetyScaleFactor, safetyScaleFactor)
      autoScaledAlert.value = true
      setTimeout(() => { autoScaledAlert.value = false }, 5000)
    }

    calcularSlicerApproximation(geometry)
  }

  scene.add(modelMesh)

  boxHelper = new THREE.BoxHelper(modelMesh, new THREE.Color('#ffb300'))
  scene.add(boxHelper)

  asentarModeloEnSuelo()
  actualizarCotas3D()
  resetCamera()
}

watch(viewMode, (newMode) => {
  if (!modelMesh) return
  const mat = modelMesh.material as THREE.MeshStandardMaterial
  mat.wireframe = newMode === 'wireframe'
  mat.opacity = newMode === 'wireframe' ? 0.25 : 1.0
})

watch(() => props.positions, (newVal) => {
  if (newVal && newVal.length > 0) {
    nextTick(() => {
      if (!scene) initThree()
      loadModel()
    })
  }
}, { immediate: true })

const resetCamera = () => {
  if (!camera || !controls || !props.boundingBoxSize) return
  camera.position.set(240, 200, 240)
  controls.target.set(0, props.boundingBoxSize.z / 4, 0)
  controls.update()
}

const onWindowResize = () => {
  if (!canvasContainer.value || !camera || !renderer || !labelRenderer) return
  const w = canvasContainer.value.clientWidth; const h = canvasContainer.value.clientHeight
  camera.aspect = w / h; camera.updateProjectionMatrix()
  renderer.setSize(w, h); labelRenderer.setSize(w, h)
}

onMounted(() => {
  setTimeout(() => {
    if (props.positions && props.positions.length > 0) {
      initThree()
      loadModel()
    }
  }, 350)
})

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('resize', onWindowResize)
  if (renderer) renderer.dispose()
  if (labelRenderer) labelRenderer.domElement.remove()
})
</script>

<style scoped>
.viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 520px;
  max-height: 82vh; 
  background-color: #0a0e17;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
}

.viewer-active-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-grow: 1;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.viewer-placeholder {
  width: 100%;
  height: 100%;
  background-color: #0a0e17;
  z-index: 5;
}

.viewer-toolbar {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
}

.glass-toggle {
  background: rgba(15, 23, 42, 0.8) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

/* Contenedor encapsulado para mantener el formato idéntico a v-btn-toggle */
.glass-toggle-group {
  display: flex;
  background: rgba(15, 23, 42, 0.8) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 4px; /* Alineado al radio por defecto de Vuetify */
  overflow: hidden;
}

/* Formato estricto para igualar altura, padding y fuente de los botones estándar */
.action-btn-format {
  height: 28px !important; /* Altura compact estándar de Vuetify */
  font-size: 0.75rem !important; /* Tamaño small (12px) */
  font-weight: 500;
  text-transform: none !important; /* Quita las mayúsculas forzadas */
  letter-spacing: 0.025em;
  border-radius: 0 !important;
  padding: 0 12px !important;
  color: #e6edf3 !important;
}

/* Separador sutil entre los dos nuevos botones */
.inner-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.12);
  align-self: center;
}



.scale-warning-alert {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid #ef4444;
  color: #fca5a5;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(8px);
  z-index: 20;
}

.info-overlay-left, .info-overlay-right {
  position: absolute; bottom: 12px; z-index: 10;
  display: flex; flex-direction: column; gap: 4px; pointer-events: none;
}
.info-overlay-left { left: 12px; }
.info-overlay-right { right: 12px; align-items: flex-end; }

.section-title {
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.badge-row, .badge-row-bed {
  background: rgba(15, 23, 42, 0.9); padding: 4px 10px; border-radius: 4px;
  font-size: 0.72rem; font-family: monospace;
}
.badge-row { color: #ffb300; border-left: 3px solid #ffb300; }
.badge-row-bed { color: #00e5ff; border-right: 3px solid #00e5ff; }

:deep(.cota-label-3d) {
  font-family: monospace;
  font-size: 11px;
  font-weight: bold;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid #ffb300;
  color: #ffb300;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  white-space: nowrap;
}

.animate-pulse { animation: pulse 2s infinite ease-in-out; }
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
</style>