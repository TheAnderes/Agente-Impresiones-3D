<template>
  <div class="viewer-container">
    <!-- Controles flotantes sobre el visor -->
    <div class="viewer-toolbar">
      <v-btn-toggle
        v-model="viewMode"
        mandatory
        variant="flat"
        density="compact"
        color="primary"
        class="glass-toggle"
      >
        <v-btn value="solid" size="small" prepend-icon="mdi-cube">Sólido</v-btn>
        <v-btn value="wireframe" size="small" prepend-icon="mdi-grid">Malla</v-btn>
      </v-btn-toggle>

      <v-btn
        :color="autoRotate ? 'primary' : 'grey-darken-3'"
        variant="flat"
        density="compact"
        icon="mdi-rotate-3d"
        class="ms-2"
        @click="autoRotate = !autoRotate"
        title="Rotación Automática"
      ></v-btn>

      <v-btn
        color="grey-darken-3"
        variant="flat"
        density="compact"
        icon="mdi-focus-field"
        class="ms-2"
        @click="resetCamera"
        title="Centrar Cámara"
      ></v-btn>
    </div>

    <!-- Indicador de carga / sin modelo -->
    <div v-if="!positions || positions.length === 0" class="viewer-placeholder d-flex flex-column align-center justify-center">
      <v-icon size="64" color="grey-lighten-1" class="mb-4 animate-pulse">mdi-printer-3d-nozzle-outline</v-icon>
      <div class="text-h6 text-grey-lighten-1 mb-2">Visor de Modelo 3D</div>
      <div class="text-body-2 text-grey-darken-1 text-center max-width-300">
        Arrastra o selecciona un archivo STL en el panel izquierdo para visualizarlo e iniciar el análisis.
      </div>
    </div>

    <!-- El lienzo de Three.js -->
    <div ref="canvasContainer" class="canvas-container"></div>

    <!-- Leyenda de dimensiones en las esquinas -->
    <div v-if="boundingBoxSize && positions && positions.length > 0" class="dimensions-overlay">
      <div class="dim-badge">X: {{ Math.round(boundingBoxSize.x) }} mm</div>
      <div class="dim-badge">Y: {{ Math.round(boundingBoxSize.y) }} mm</div>
      <div class="dim-badge">Z: {{ Math.round(boundingBoxSize.z) }} mm</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps<{
  positions: Float32Array | null
  boundingBoxSize: { x: number; y: number; z: number } | null
  boundingBoxMin: { x: number; y: number; z: number } | null
  boundingBoxMax: { x: number; y: number; z: number } | null
}>()

const canvasContainer = ref<HTMLDivElement | null>(null)
const viewMode = ref<'solid' | 'wireframe'>('solid')
const autoRotate = ref(true)

// Variables de Three.js
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let modelMesh: THREE.Mesh | null = null
let boxHelper: THREE.BoxHelper | null = null
let gridHelper: THREE.GridHelper | null = null
let animationFrameId: number | null = null

// Inicializar la escena de Three.js
const initThree = () => {
  if (!canvasContainer.value) return

  // 1. Escena
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0a0e17') // Fondo oscuro premium
  scene.fog = new THREE.FogExp2('#0a0e17', 0.0025)

  // 2. Cámara
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000)
  camera.position.set(150, 150, 150)

  // 3. Renderizador con antialiasing
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Limpiar contenedor y añadir canvas
  canvasContainer.value.innerHTML = ''
  canvasContainer.value.appendChild(renderer.domElement)

  // 4. Controles orbitales
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.maxPolarAngle = Math.PI / 2 - 0.01 // Evitar pasar por debajo del suelo
  controls.minDistance = 20
  controls.maxDistance = 500

  // 5. Luces premium
  const ambientLight = new THREE.AmbientLight('#182235', 1.5)
  scene.add(ambientLight)

  // Luz direccional principal (sol) con sombras
  const dirLight = new THREE.DirectionalLight('#ffffff', 1.8)
  dirLight.position.set(120, 200, 100)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  dirLight.shadow.camera.near = 0.5
  dirLight.shadow.camera.far = 500
  const d = 150
  dirLight.shadow.camera.left = -d
  dirLight.shadow.camera.right = d
  dirLight.shadow.camera.top = d
  dirLight.shadow.camera.bottom = -d
  dirLight.shadow.bias = -0.0005
  scene.add(dirLight)

  // Luz de acento cian
  const cyanLight = new THREE.PointLight('#00d2ff', 2, 150)
  cyanLight.position.set(-80, 50, -80)
  scene.add(cyanLight)

  // Luz de acento violeta
  const purpleLight = new THREE.PointLight('#9c27b0', 1.5, 150)
  purpleLight.position.set(80, 20, -80)
  scene.add(purpleLight)

  // 6. Cama caliente virtual de la impresora (Suelo / Grid)
  const bedSize = 220
  gridHelper = new THREE.GridHelper(bedSize, 22, '#2196f3', '#1a237e')
  // Mover el grid para que esté centrado
  gridHelper.position.y = 0
  scene.add(gridHelper)

  // Subsuelo reflectante/sombra
  const floorGeo = new THREE.PlaneGeometry(bedSize, bedSize)
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#0d1321',
    roughness: 0.8,
    metalness: 0.2
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.1
  floor.receiveShadow = true
  scene.add(floor)

  // Evento de redimensionamiento
  window.addEventListener('resize', onWindowResize)

  // Iniciar bucle de animación
  animate()
}

// Bucle de animación
const animate = () => {
  animationFrameId = requestAnimationFrame(animate)

  if (controls) controls.update()

  if (autoRotate.value && modelMesh) {
    modelMesh.rotation.y += 0.005
    if (boxHelper) boxHelper.update()
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// Cargar la geometría del modelo en la escena
const loadModel = () => {
  if (!scene || !props.positions || props.positions.length === 0) return

  // Limpiar modelo anterior
  if (modelMesh) {
    scene.remove(modelMesh)
    if (modelMesh.geometry) modelMesh.geometry.dispose()
    if (Array.isArray(modelMesh.material)) {
      modelMesh.material.forEach(m => m.dispose())
    } else {
      modelMesh.material.dispose()
    }
    modelMesh = null
  }

  if (boxHelper) {
    scene.remove(boxHelper)
    boxHelper = null
  }

  // Crear geometría desde el Float32Array
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(props.positions, 3))
  geometry.computeVertexNormals()

  // Material premium reflectante (Plástico brillante translúcido)
  const material = new THREE.MeshStandardMaterial({
    color: '#00e5ff', // Cian brillante
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: viewMode.value === 'solid' ? 0.9 : 0.2,
    wireframe: viewMode.value === 'wireframe',
    side: THREE.DoubleSide
  })

  modelMesh = new THREE.Mesh(geometry, material)
  modelMesh.castShadow = true
  modelMesh.receiveShadow = true

  // Centrar el modelo en la cama (X e Y) y asentarlo en el suelo (Z = 0)
  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox

  if (bbox) {
    const center = new THREE.Vector3()
    bbox.getCenter(center)

    // Desplazar los vértices para centrar el modelo en el origen del Mesh
    geometry.translate(-center.x, -bbox.min.y, -center.z)

    // Colocar el Mesh en el centro de la cama caliente (0, 0, 0)
    modelMesh.position.set(0, 0, 0)
  }

  scene.add(modelMesh)

  // Agregar caja delimitadora premium
  boxHelper = new THREE.BoxHelper(modelMesh, new THREE.Color('#00e5ff'))
  scene.add(boxHelper)

  // Ajustar cámara para encuadrar el modelo
  resetCamera()
}

// Resetear y enfocar la cámara al modelo
const resetCamera = () => {
  if (!camera || !controls || !props.boundingBoxSize) return

  const size = props.boundingBoxSize
  const maxDim = Math.max(size.x, size.y, size.z)

  // Calcular distancia de cámara adecuada
  const distance = maxDim * 2.2 || 120

  camera.position.set(distance, distance * 0.8, distance)
  controls.target.set(0, size.z / 2 || 20, 0)
  controls.update()
}

// Manejar redimensionamiento
const onWindowResize = () => {
  if (!canvasContainer.value || !camera || !renderer) return
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// Observar cambios en el modo de visualización (sólido vs malla)
watch(viewMode, (newMode) => {
  if (!modelMesh) return
  const mat = modelMesh.material as THREE.MeshStandardMaterial

  if (newMode === 'wireframe') {
    mat.wireframe = true
    mat.opacity = 0.4
  } else {
    mat.wireframe = false
    mat.opacity = 0.9
  }
  mat.needsUpdate = true
})

// Observar cambios en la geometría cargada
watch(() => props.positions, () => {
  nextTick(() => {
    if (!scene) {
      initThree()
    }
    loadModel()
  })
})

onMounted(() => {
  // Retraso ligero para permitir que la Grid de Vuetify se asiente en el DOM y tome las medidas correctas
  setTimeout(() => {
    initThree()
    if (props.positions && props.positions.length > 0) {
      loadModel()
    }
  }, 300)
})

onBeforeUnmount(() => {
  // Detener bucle
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }

  // Quitar listener de redimensión
  window.removeEventListener('resize', onWindowResize)

  // Liberar recursos de Three.js
  if (modelMesh) {
    if (modelMesh.geometry) modelMesh.geometry.dispose()
    if (Array.isArray(modelMesh.material)) {
      modelMesh.material.forEach(m => m.dispose())
    } else {
      modelMesh.material.dispose()
    }
  }

  if (gridHelper) {
    gridHelper.geometry.dispose()
    if (Array.isArray(gridHelper.material)) {
      gridHelper.material.forEach(m => m.dispose())
    } else {
      gridHelper.material.dispose()
    }
  }

  if (renderer) {
    renderer.dispose()
  }

  if (controls) {
    controls.dispose()
  }

  scene = null
  camera = null
  renderer = null
  controls = null
})
</script>

<style scoped>
.viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 450px;
  background-color: #0a0e17;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.canvas-container {
  width: 100%;
  height: 100%;
  min-height: 450px;
}

.viewer-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background-color: #0a0e17;
  pointer-events: none;
}

.viewer-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
}

.glass-toggle {
  background: rgba(15, 23, 42, 0.6) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 8px;
  overflow: hidden;
}

.dimensions-overlay {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}

.dim-badge {
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  border-left: 3px solid #00e5ff;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #00e5ff;
  font-family: monospace;
}

.max-width-300 {
  max-width: 300px;
}

.animate-pulse {
  animation: pulse 2s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.98); }
  50% { opacity: 0.8; transform: scale(1.02); }
}
</style>
