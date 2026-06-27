<template>
  <v-app theme="dark" class="app-bg">
    <!-- BARRA DE NAVEGACIÓN SUPERIOR -->
    <v-app-bar flat class="glass-bar px-4">
      <div class="nav-logo d-flex align-center gap-2 cursor-pointer" role="button" aria-label="Ir al inicio"
        @click="goHome">
        <div class="logo-icon-wrap">
          <v-icon color="primary" size="26" class="animate-glow">mdi-printer-3d-nozzle</v-icon>
          <div class="logo-ring"></div>
        </div>
        <span class="logo-text">PRINT<span class="text-primary">FLOW</span></span>
      </div>

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
          class="text-none font-weight-bold nav-cta-btn" size="small" @click="showAuthDialog = true">
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

        <!-- ============================================================ -->
        <!-- HERO SECTION - FUTURISTIC AR UI                              -->
        <!-- ============================================================ -->
        <section class="section-hero">
          <!-- Canvas de Partículas de fondo -->
          <canvas ref="particleCanvas" class="particle-canvas"></canvas>

          <!-- Grid de perspectiva -->
          <div class="perspective-grid"></div>

          <!-- Nebula orbs -->
          <div class="nebula-orb nebula-1"></div>
          <div class="nebula-orb nebula-2"></div>
          <div class="nebula-orb nebula-3"></div>

          <!-- Scanline animada -->
          <div class="scanline-overlay"></div>

          <!-- Contenido del Hero -->
          <div class="hero-content d-flex flex-column align-center text-center px-4">

            <!-- Badge de estado del sistema -->
            <div class="system-badge mb-6">
              <span class="badge-dot"></span>
              <span class="badge-text">SISTEMA ACTIVO — IA ONLINE — v2.1.0</span>
            </div>

            <!-- Título principal con efecto glitch -->
            <div class="hero-title-wrap mb-2">
              <h1 class="hero-title" :data-text="glitchText">
                <span class="title-main">{{ glitchText }}</span>
              </h1>
            </div>

            <div class="hero-subtitle-wrap mb-3">
              <span class="hero-accent-word">MANUFACTURA ADITIVA</span>
              <span class="hero-accent-divider">//</span>
              <span class="hero-accent-word">ANÁLISIS IA</span>
              <span class="hero-accent-divider">//</span>
              <span class="hero-accent-word">WEBGL 3D</span>
            </div>

            <p class="hero-description mb-10">
              Plataforma de análisis geométrico avanzado, cotización de filamento en tiempo real<br
                class="d-none d-md-block">
              y asistencia de Inteligencia Artificial para impresión 3D de precisión industrial.
            </p>

            <!-- Botones CTA -->
            <div class="d-flex flex-wrap justify-center gap-4 mb-12">
              <button class="hud-btn-primary" id="btn-start" @click="showAuthDialog = true">
                <span class="hud-btn-bg"></span>
                <v-icon size="18" class="me-2">mdi-rocket-launch</v-icon>
                <span>COMENZAR AHORA</span>
                <div class="hud-btn-corner tl"></div>
                <div class="hud-btn-corner tr"></div>
                <div class="hud-btn-corner bl"></div>
                <div class="hud-btn-corner br"></div>
              </button>
              <button class="hud-btn-secondary" id="btn-guest" @click="enterAsGuest">
                <v-icon size="18" class="me-2">mdi-cube-outline</v-icon>
                <span>MODO INVITADO</span>
              </button>
            </div>

            <!-- Métricas flotantes tipo AR -->
            <div class="hero-metrics">
              <div class="metric-card" id="metric-accuracy">
                <div class="metric-label">PRECISIÓN GEOMÉTRICA</div>
                <div class="metric-value">99.7<span class="metric-unit">%</span></div>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: 99.7%"></div>
                </div>
              </div>
              <div class="metric-card" id="metric-formats">
                <div class="metric-label">FORMATOS STL</div>
                <div class="metric-value">ASCII <span class="metric-unit">+</span> BIN</div>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: 100%"></div>
                </div>
              </div>
              <div class="metric-card" id="metric-materials">
                <div class="metric-label">MATERIALES</div>
                <div class="metric-value">4<span class="metric-unit">tipos</span></div>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: 80%"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Indicador de scroll -->
          <div class="scroll-indicator">
            <div class="scroll-line"></div>
            <span class="scroll-label">EXPLORAR</span>
          </div>
        </section>

        <!-- ============================================================ -->
        <!-- SECCIÓN 1: VISUALIZACIÓN INTERACTIVA 3D                      -->
        <!-- ============================================================ -->
        <section class="hud-section py-16 px-6">
          <div class="section-line-accent"></div>
          <v-container>
            <v-row class="align-center">
              <v-col cols="12" md="6">
                <div class="pe-md-8">
                  <!-- Chip de feature -->
                  <div class="feature-badge mb-4">
                    <span class="feature-number">01</span>
                    <span class="feature-label">CARACTERÍSTICA</span>
                  </div>
                  <h2 class="section-title mb-4">Visualización<br><span class="text-neon">WebGL 3D</span> en Tiempo Real
                  </h2>
                  <p class="section-desc mb-6">
                    Renderiza tus archivos STL directamente en el navegador con aceleración por hardware. Examina la
                    pieza
                    desde cualquier ángulo, activa el modo de malla de alambre (wireframe) para inspeccionar la
                    topología de triángulos y encuadra el modelo sobre una cama caliente virtual de 220×220 mm.
                  </p>
                  <div class="feature-list">
                    <div class="feature-item">
                      <div class="fi-dot"></div>
                      <span>Controles orbitales intuitivos — giro, zoom y paneo.</span>
                    </div>
                    <div class="feature-item">
                      <div class="fi-dot"></div>
                      <span>Modos sólido, translúcido y malla estructural (wireframe).</span>
                    </div>
                    <div class="feature-item">
                      <div class="fi-dot"></div>
                      <span>Iluminación dinámica con sombras en tiempo real.</span>
                    </div>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <!-- HUD Viewer Card 1 -->
                <div class="hud-viewer-card" id="viewer-card-1">
                  <div class="hud-corner hud-tl"></div>
                  <div class="hud-corner hud-tr"></div>
                  <div class="hud-corner hud-bl"></div>
                  <div class="hud-corner hud-br"></div>
                  <div class="hud-top-bar">
                    <span class="hud-status-dot active"></span>
                    <span class="hud-label">MÓDULO 3D // TORUS KNOT</span>
                    <span class="hud-value text-neon">WEBGL LIVE</span>
                  </div>
                  <div ref="miniCanvas1" class="mini-canvas"></div>
                  <div class="hud-bottom-bar">
                    <span class="hud-data-item"><span class="hud-data-key">VTX</span> <span
                        class="hud-data-val">7.4K</span></span>
                    <span class="hud-data-item"><span class="hud-data-key">TRI</span> <span
                        class="hud-data-val">14.8K</span></span>
                    <span class="hud-data-item"><span class="hud-data-key">FPS</span> <span
                        class="hud-data-val text-neon">60</span></span>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </section>

        <!-- ============================================================ -->
        <!-- SECCIÓN 2: COTIZACIÓN INTELIGENTE DE MATERIAL                -->
        <!-- ============================================================ -->
        <section class="hud-section hud-section-alt py-16 px-6">
          <div class="section-line-accent accent-secondary"></div>
          <v-container>
            <v-row class="align-center flex-md-row-reverse">
              <v-col cols="12" md="6">
                <div class="ps-md-8">
                  <div class="feature-badge feature-badge-sec mb-4">
                    <span class="feature-number">02</span>
                    <span class="feature-label">CARACTERÍSTICA</span>
                  </div>
                  <h2 class="section-title mb-4">Cotización y<br><span class="text-neon-sec">Estimación
                      Inteligente</span>
                  </h2>
                  <p class="section-desc mb-6">
                    Calcula dinámicamente el peso neto del filamento en gramos, la longitud del hilo continuo de 1.75 mm
                    que consumirá la extrusora y el costo estimado en USD según el tipo de filamento seleccionado
                    (PLA, ABS, PETG o TPU). El rebanador matemático se adapta instantáneamente a tus cambios de relleno,
                    altura de capa y uso de soportes.
                  </p>
                  <div class="feature-list">
                    <div class="feature-item sec">
                      <div class="fi-dot sec"></div>
                      <span>Fórmulas basadas en volumetría y densidades físicas reales.</span>
                    </div>
                    <div class="feature-item sec">
                      <div class="fi-dot sec"></div>
                      <span>Precios e infill ajustables en tiempo real con recálculo dinámico.</span>
                    </div>
                    <div class="feature-item sec">
                      <div class="fi-dot sec"></div>
                      <span>Exporta cotizaciones detalladas con todos los parámetros.</span>
                    </div>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <!-- HUD Viewer Card 2 -->
                <div class="hud-viewer-card hud-viewer-sec" id="viewer-card-2">
                  <div class="hud-corner hud-tl sec"></div>
                  <div class="hud-corner hud-tr sec"></div>
                  <div class="hud-corner hud-bl sec"></div>
                  <div class="hud-corner hud-br sec"></div>
                  <div class="hud-top-bar">
                    <span class="hud-status-dot active sec"></span>
                    <span class="hud-label">MÓDULO SLICER // FLORERO</span>
                    <span class="hud-value text-neon-sec">ESTIMATING</span>
                  </div>
                  <div ref="miniCanvas2" class="mini-canvas"></div>
                  <div class="hud-bottom-bar">
                    <span class="hud-data-item"><span class="hud-data-key">INFILL</span> <span
                        class="hud-data-val">20%</span></span>
                    <span class="hud-data-item"><span class="hud-data-key">CAPA</span> <span
                        class="hud-data-val">0.2mm</span></span>
                    <span class="hud-data-item"><span class="hud-data-key">COSTO</span> <span
                        class="hud-data-val text-neon-sec">~$1.40</span></span>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </section>

        <!-- ============================================================ -->
        <!-- SECCIÓN 3: CÁLCULOS DE CARACTERÍSTICAS Y SLICER              -->
        <!-- ============================================================ -->
        <section class="hud-section py-16 px-6">
          <div class="section-line-accent accent-info"></div>
          <v-container>
            <v-row class="align-center">
              <v-col cols="12" md="6">
                <div class="pe-md-8">
                  <div class="feature-badge feature-badge-info mb-4">
                    <span class="feature-number">03</span>
                    <span class="feature-label">CARACTERÍSTICA</span>
                  </div>
                  <h2 class="section-title mb-4">Cálculos de<br><span class="text-neon-info">Dimensiones y
                      Volumen</span>
                  </h2>
                  <p class="section-desc mb-6">
                    El motor de parseo lee los bytes del archivo y extrae el volumen del sólido real en centímetros
                    cúbicos
                    sumando tetraedros en el espacio tridimensional. Identifica el tamaño exacto de la caja
                    delimitadora (Bounding Box X, Y, Z) para verificar si la pieza cabe físicamente en tu volumen de
                    impresión.
                  </p>
                  <div class="feature-list">
                    <div class="feature-item info">
                      <div class="fi-dot info"></div>
                      <span>Verificación de cotas y colisiones con el volumen límite de cama.</span>
                    </div>
                    <div class="feature-item info">
                      <div class="fi-dot info"></div>
                      <span>Detección y conteo exacto de facetas (triángulos geométricos).</span>
                    </div>
                    <div class="feature-item info">
                      <div class="fi-dot info"></div>
                      <span>Exporta análisis completo en tiempo real.</span>
                    </div>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <!-- HUD Viewer Card 3 -->
                <div class="hud-viewer-card hud-viewer-info" id="viewer-card-3">
                  <div class="hud-corner hud-tl info"></div>
                  <div class="hud-corner hud-tr info"></div>
                  <div class="hud-corner hud-bl info"></div>
                  <div class="hud-corner hud-br info"></div>
                  <div class="hud-top-bar">
                    <span class="hud-status-dot active info"></span>
                    <span class="hud-label">MÓDULO ANÁLISIS // ENGRANAJE</span>
                    <span class="hud-value text-neon-info">COMPUTING</span>
                  </div>
                  <div ref="miniCanvas3" class="mini-canvas"></div>
                  <div class="hud-bottom-bar">
                    <span class="hud-data-item"><span class="hud-data-key">VOL</span> <span class="hud-data-val">18.4
                        cm³</span></span>
                    <span class="hud-data-item"><span class="hud-data-key">BBOX</span> <span
                        class="hud-data-val">30×30×10</span></span>
                    <span class="hud-data-item"><span class="hud-data-key">FACES</span> <span
                        class="hud-data-val text-neon-info">576</span></span>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </section>

        <!-- ============================================================ -->
        <!-- CTA FINAL                                                     -->
        <!-- ============================================================ -->
        <section class="cta-section py-20 px-4 text-center">
          <!-- Decoraciones de fondo -->
          <div class="cta-ring cta-ring-1"></div>
          <div class="cta-ring cta-ring-2"></div>
          <div class="cta-ring cta-ring-3"></div>

          <div class="cta-content">
            <div class="cta-icon-wrap mb-6">
              <v-icon color="primary" size="40" class="animate-glow">mdi-lock-open-outline</v-icon>
              <div class="cta-icon-ring"></div>
            </div>

            <div class="system-badge mb-5">
              <span class="badge-dot"></span>
              <span class="badge-text">ACCESO COMPLETO DISPONIBLE</span>
            </div>

            <h2 class="cta-title mb-4">¿Listo para Optimizar<br>tus <span class="text-neon">Impresiones 3D</span>?</h2>
            <p class="cta-desc mb-10 mx-auto">
              Crea una cuenta en segundos para desbloquear el Dashboard de trabajo, subir tus propios archivos STL,
              analizar tus piezas con el Asistente de IA y registrar cotizaciones en Supabase.
            </p>

            <button class="hud-btn-primary hud-btn-lg" id="btn-cta-register" @click="showAuthDialog = true">
              <span class="hud-btn-bg"></span>
              <v-icon size="20" class="me-2">mdi-account-plus</v-icon>
              <span>REGISTRARSE / INICIAR SESIÓN</span>
              <div class="hud-btn-corner tl"></div>
              <div class="hud-btn-corner tr"></div>
              <div class="hud-btn-corner bl"></div>
              <div class="hud-btn-corner br"></div>
            </button>

            <!-- Stats row -->
            <div class="cta-stats mt-12">
              <div class="cta-stat">
                <div class="cta-stat-val">WebGL</div>
                <div class="cta-stat-label">Motor 3D</div>
              </div>
              <div class="cta-stat-divider"></div>
              <div class="cta-stat">
                <div class="cta-stat-val">Gemini</div>
                <div class="cta-stat-label">IA Asistente</div>
              </div>
              <div class="cta-stat-divider"></div>
              <div class="cta-stat">
                <div class="cta-stat-val">Supabase</div>
                <div class="cta-stat-label">Almacenamiento</div>
              </div>
              <div class="cta-stat-divider"></div>
              <div class="cta-stat">
                <div class="cta-stat-val">Vue 3</div>
                <div class="cta-stat-label">Framework</div>
              </div>
            </div>
          </div>
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
const particleCanvas = ref<HTMLCanvasElement | null>(null)

// Estructuras de control para los visualizadores de la landing page
let miniScenes: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; mesh: THREE.Mesh }[] = []
let animationFrameId: number | null = null
let particleAnimId: number | null = null
let glitchInterval: ReturnType<typeof setInterval> | null = null

// Estado del efecto glitch
const glitchText = ref('PRINTFLOW')

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
      initParticles()
      startGlitchEffect()
    })
  }

  loadHistory()
})

onBeforeUnmount(() => {
  destroyLandingViewers()
  destroyParticles()
  stopGlitchEffect()
})

// Observar si el rol de usuario cambia (al loguearse o desloguearse)
watch(userRole, (newRole) => {
  if (newRole === 'guest' && !showGuestDashboard.value) {
    nextTick(() => {
      initLandingViewers()
      initParticles()
      startGlitchEffect()
    })
  } else {
    destroyLandingViewers()
    destroyParticles()
    stopGlitchEffect()
  }
  loadHistory()
})

// Regresar a la pantalla de inicio (landing o dashboard según rol)
const goHome = () => {
  if (userRole.value === 'guest') {
    // Volver a la landing page
    showGuestDashboard.value = false
    nextTick(() => {
      initLandingViewers()
      initParticles()
      startGlitchEffect()
    })
  } else {
    // Usuarios logueados van al dashboard
    activeView.value = 'dashboard'
  }
}

// Permitir probar como invitado de manera local
const enterAsGuest = () => {
  showGuestDashboard.value = true
  destroyLandingViewers()
  destroyParticles()
  stopGlitchEffect()
}

// Al loguearse con éxito
const onAuthSuccess = () => {
  showGuestDashboard.value = false
  activeView.value = 'dashboard'
  loadHistory()
}

// ==========================================
// EFECTO GLITCH EN TÍTULO
// ==========================================

const glitchChars = '!<>-_\\/[]{}—=+*^?#ABCXZ0123456789'
const originalTitle = 'PRINTFLOW'

const startGlitchEffect = () => {
  glitchInterval = setInterval(() => {
    // Glitch rápido (duración corta, cada ~5s)
    if (Math.random() > 0.85) {
      let count = 0
      const glitchTimer = setInterval(() => {
        glitchText.value = originalTitle
          .split('')
          .map((char, i) => {
            if (char === ' ') return ' '
            if (Math.random() > 0.85) return glitchChars[Math.floor(Math.random() * glitchChars.length)]
            return char
          })
          .join('')
        count++
        if (count > 6) {
          clearInterval(glitchTimer)
          glitchText.value = originalTitle
        }
      }, 50)
    }
  }, 1500)
}

const stopGlitchEffect = () => {
  if (glitchInterval !== null) {
    clearInterval(glitchInterval)
    glitchInterval = null
  }
  glitchText.value = originalTitle
}

// ==========================================
// CANVAS DE PARTÍCULAS DEL HERO
// ==========================================

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  color: string
}

let particles: Particle[] = []

const initParticles = () => {
  const canvas = particleCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const resize = () => {
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const particleColors = ['rgba(0, 229, 255,', 'rgba(100, 180, 255,', 'rgba(156, 100, 255,']
  const count = 80
  particles = []

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 1.8 + 0.3,
      alpha: Math.random() * 0.6 + 0.1,
      color: particleColors[Math.floor(Math.random() * particleColors.length)]
    })
  }

  const draw = () => {
    particleAnimId = requestAnimationFrame(draw)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    particles.forEach((p, i) => {
      // Mover
      p.x += p.vx
      p.y += p.vy

      // Rebotar en bordes
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1

      // Dibujar punto
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `${p.color}${p.alpha})`
      ctx.fill()

      // Conectar partículas cercanas
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[j].x - p.x
        const dy = particles[j].y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120) {
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.strokeStyle = `rgba(0, 229, 255, ${0.08 * (1 - dist / 120)})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    })
  }

  draw()
}

const destroyParticles = () => {
  if (particleAnimId !== null) {
    cancelAnimationFrame(particleAnimId)
    particleAnimId = null
  }
  particles = []
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
  const colors = ['#00e5ff', '#ce93d8', '#64b5f6'] // Cian, Violeta claro, Azul claro

  canvases.forEach((container, idx) => {
    if (!container) return

    const w = container.clientWidth || 340
    const h = container.clientHeight || 260

    const scene = new THREE.Scene()
    scene.background = null // Fondo transparente para que se vea el glass del card

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 100)
    camera.position.set(0, 5, 38)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Luces
    const ambientLight = new THREE.AmbientLight('#1a2040', 1.5)
    scene.add(ambientLight)

    const dirLight1 = new THREE.DirectionalLight('#ffffff', 2)
    dirLight1.position.set(10, 20, 15)
    scene.add(dirLight1)

    const pointLight = new THREE.PointLight(colors[idx], 3, 60)
    pointLight.position.set(-10, -5, 10)
    scene.add(pointLight)

    const rimLight = new THREE.PointLight(colors[idx], 1.5, 40)
    rimLight.position.set(15, 10, -15)
    scene.add(rimLight)

    // Material holográfico con efecto neón
    const material = new THREE.MeshStandardMaterial({
      color: colors[idx],
      roughness: 0.05,
      metalness: 0.7,
      emissive: new THREE.Color(colors[idx]),
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometries[idx], material)
    mesh.position.y = idx === 1 ? -2 : 0
    scene.add(mesh)

    miniScenes.push({ scene, camera, renderer, mesh })
  })

  // Animar los mini visualizadores
  const animateLanding = () => {
    animationFrameId = requestAnimationFrame(animateLanding)

    miniScenes.forEach((s) => {
      // Rotación constante en ejes Y y X
      s.mesh.rotation.y += 0.01
      s.mesh.rotation.x += 0.003
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
/* ============================================================
   VARIABLES Y BASE
   ============================================================ */
:root {
  --neon-cyan: #00e5ff;
  --neon-violet: #ce93d8;
  --neon-blue: #64b5f6;
  --neon-cyan-glow: rgba(0, 229, 255, 0.35);
  --neon-violet-glow: rgba(206, 147, 216, 0.35);
  --neon-blue-glow: rgba(100, 181, 246, 0.35);
  --dark-base: #020510;
  --dark-card: rgba(4, 10, 28, 0.75);
  --glass-border: rgba(0, 229, 255, 0.12);
  --glass-border-sec: rgba(206, 147, 216, 0.12);
  --glass-border-info: rgba(100, 181, 246, 0.12);
}

/* ============================================================
   TIPOGRAFÍA
   ============================================================ */
.nav-logo {
  position: relative;
  transition: opacity 0.2s ease;
  user-select: none;
}

.nav-logo:hover {
  opacity: 0.82;
}

.nav-logo:active {
  opacity: 0.65;
  transform: scale(0.98);
}

.logo-text {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 1.2rem;
  letter-spacing: 2px;
  color: #fff;
}


.hero-title {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: clamp(3.2rem, 9vw, 7rem);
  line-height: 1;
  letter-spacing: 4px;
  color: #fff;
  text-transform: uppercase;
  position: relative;
}

.section-title {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  line-height: 1.15;
  color: #fff;
  letter-spacing: 1px;
}

.section-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.95rem;
  line-height: 1.7;
  color: rgba(180, 195, 220, 0.85);
}

/* ============================================================
   FONDO DE LA APP
   ============================================================ */
.landing-container {
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--dark-base);
  font-family: 'Inter', sans-serif;
}

/* ============================================================
   NAVBAR
   ============================================================ */
.glass-bar {
  background: rgba(2, 5, 16, 0.85) !important;
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 229, 255, 0.1) !important;
  box-shadow: 0 0 30px rgba(0, 229, 255, 0.04) !important;
}

.nav-cta-btn {
  background: linear-gradient(135deg, rgba(0, 180, 220, 0.9), rgba(0, 80, 200, 0.9)) !important;
  box-shadow: 0 0 16px rgba(0, 229, 255, 0.3) !important;
}

.logo-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
}

.logo-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1px solid rgba(0, 229, 255, 0.4);
  animation: logo-pulse 2.5s ease-in-out infinite;
}

@keyframes logo-pulse {

  0%,
  100% {
    opacity: 0.4;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* ============================================================
   HERO SECTION
   ============================================================ */
.section-hero {
  position: relative;
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(ellipse 80% 60% at 50% 20%, rgba(0, 80, 140, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 70%, rgba(80, 0, 140, 0.1) 0%, transparent 50%),
    var(--dark-base);
}

/* Canvas de Partículas */
.particle-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

/* Grid de perspectiva */
.perspective-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(0, 229, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.04) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 80%);
  pointer-events: none;
}

/* Nebula Orbs */
.nebula-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}

.nebula-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(0, 120, 200, 0.12) 0%, transparent 70%);
  top: -100px;
  left: -100px;
  animation: nebula-drift 15s ease-in-out infinite;
}

.nebula-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(100, 0, 200, 0.1) 0%, transparent 70%);
  bottom: 0;
  right: -80px;
  animation: nebula-drift 18s ease-in-out infinite reverse;
}

.nebula-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(0, 229, 255, 0.06) 0%, transparent 70%);
  top: 50%;
  right: 20%;
  animation: nebula-drift 12s ease-in-out infinite 3s;
}

@keyframes nebula-drift {

  0%,
  100% {
    transform: translate(0, 0);
  }

  33% {
    transform: translate(30px, -20px);
  }

  66% {
    transform: translate(-20px, 30px);
  }
}

/* Scanline overlay */
.scanline-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: repeating-linear-gradient(0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.03) 2px,
      rgba(0, 0, 0, 0.03) 4px);
}

/* ============================================================
   HERO CONTENT
   ============================================================ */
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 900px;
  width: 100%;
  padding: 2rem 1rem;
}

/* Badge de sistema activo */
.system-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  background: rgba(0, 229, 255, 0.06);
  border: 1px solid rgba(0, 229, 255, 0.25);
  border-radius: 999px;
  backdrop-filter: blur(8px);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00e5ff;
  box-shadow: 0 0 8px #00e5ff;
  animation: blink-dot 1.5s ease-in-out infinite;
}

@keyframes blink-dot {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

.badge-text {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 2px;
  color: rgba(0, 229, 255, 0.9);
}

/* Título Hero */
.hero-title-wrap {
  position: relative;
}

/* Efecto glitch */
.hero-title::before,
.hero-title::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.hero-title::before {
  color: #00e5ff;
  clip-path: polygon(0 30%, 100% 30%, 100% 50%, 0 50%);
  transform: translateX(-3px);
  animation: glitch-1 4s infinite linear;
}

.hero-title::after {
  color: #ce93d8;
  clip-path: polygon(0 60%, 100% 60%, 100% 70%, 0 70%);
  transform: translateX(3px);
  animation: glitch-2 4s infinite linear;
}

@keyframes glitch-1 {

  0%,
  90%,
  100% {
    transform: translateX(0);
    opacity: 0;
  }

  92% {
    transform: translateX(-4px);
    opacity: 0.6;
  }

  94% {
    transform: translateX(4px);
    opacity: 0.4;
  }

  96% {
    transform: translateX(-2px);
    opacity: 0.5;
  }

  98% {
    transform: translateX(0);
    opacity: 0;
  }
}

@keyframes glitch-2 {

  0%,
  88%,
  100% {
    transform: translateX(0);
    opacity: 0;
  }

  90% {
    transform: translateX(4px);
    opacity: 0.5;
  }

  93% {
    transform: translateX(-3px);
    opacity: 0.4;
  }

  96% {
    transform: translateX(2px);
    opacity: 0.3;
  }

  98% {
    transform: translateX(0);
    opacity: 0;
  }
}

/* Subtítulo de palabras clave */
.hero-subtitle-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.hero-accent-word {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 3px;
  color: rgba(0, 229, 255, 0.7);
}

.hero-accent-divider {
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.9rem;
}

/* Descripción del hero */
.hero-description {
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  line-height: 1.75;
  color: rgba(160, 185, 220, 0.85);
  max-width: 680px;
}

/* ============================================================
   BOTONES HUD
   ============================================================ */
.hud-btn-primary {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 36px;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 2px;
  color: #fff;
  background: transparent;
  border: 1px solid rgba(0, 229, 255, 0.5);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
  clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
}

.hud-btn-primary .hud-btn-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 100, 200, 0.5), rgba(0, 200, 255, 0.3));
  transition: opacity 0.3s ease;
}

.hud-btn-primary:hover .hud-btn-bg {
  background: linear-gradient(135deg, rgba(0, 130, 230, 0.7), rgba(0, 229, 255, 0.5));
}

.hud-btn-primary:hover {
  box-shadow: 0 0 30px rgba(0, 229, 255, 0.4), inset 0 0 20px rgba(0, 229, 255, 0.05);
  border-color: rgba(0, 229, 255, 0.9);
  transform: translateY(-1px);
}

.hud-btn-primary span:not(.hud-btn-bg) {
  position: relative;
  z-index: 1;
}

.hud-btn-primary .v-icon {
  position: relative;
  z-index: 1;
}

/* Corners decorativos del botón */
.hud-btn-corner {
  position: absolute;
  width: 6px;
  height: 6px;
  border-color: rgba(0, 229, 255, 0.8);
  border-style: solid;
}

.hud-btn-corner.tl {
  top: 2px;
  left: 2px;
  border-width: 1px 0 0 1px;
}

.hud-btn-corner.tr {
  top: 2px;
  right: 2px;
  border-width: 1px 1px 0 0;
}

.hud-btn-corner.bl {
  bottom: 2px;
  left: 2px;
  border-width: 0 0 1px 1px;
}

.hud-btn-corner.br {
  bottom: 2px;
  right: 2px;
  border-width: 0 1px 1px 0;
}

.hud-btn-lg {
  padding: 16px 52px;
  font-size: 1rem;
  letter-spacing: 3px;
}

.hud-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 13px 32px;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 2px;
  color: rgba(180, 210, 255, 0.85);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: all 0.3s ease;
  clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
}

.hud-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
  transform: translateY(-1px);
}

/* ============================================================
   HERO MÉTRICAS
   ============================================================ */
.hero-metrics {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.metric-card {
  background: rgba(0, 229, 255, 0.04);
  border: 1px solid rgba(0, 229, 255, 0.15);
  padding: 14px 20px;
  min-width: 150px;
  position: relative;
  backdrop-filter: blur(8px);
}

.metric-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.6), transparent);
}

.metric-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 2px;
  color: rgba(0, 229, 255, 0.6);
  margin-bottom: 6px;
}

.metric-value {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 1.4rem;
  color: #fff;
  line-height: 1;
  margin-bottom: 8px;
}

.metric-unit {
  font-size: 0.75rem;
  color: rgba(0, 229, 255, 0.7);
  margin-left: 2px;
}

.metric-bar {
  height: 2px;
  background: rgba(0, 229, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.5), rgba(0, 229, 255, 1));
  position: relative;
}

/* ============================================================
   SCROLL INDICATOR
   ============================================================ */
.scroll-indicator {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 2;
}

.scroll-line {
  width: 1px;
  height: 40px;
  background: linear-gradient(to bottom, transparent, rgba(0, 229, 255, 0.6));
  animation: scroll-pulse 2s ease-in-out infinite;
}

@keyframes scroll-pulse {

  0%,
  100% {
    opacity: 0.3;
    transform: scaleY(0.7);
  }

  50% {
    opacity: 1;
    transform: scaleY(1);
  }
}

.scroll-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 3px;
  color: rgba(0, 229, 255, 0.5);
}

/* ============================================================
   FEATURE SECTIONS
   ============================================================ */
.hud-section {
  position: relative;
  background: var(--dark-base);
  border-top: 1px solid rgba(0, 229, 255, 0.06);
}

.hud-section-alt {
  background: rgba(4, 2, 14, 0.95);
}

.section-line-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, rgba(0, 229, 255, 0.7) 40%, rgba(0, 229, 255, 0.1) 100%);
}

.section-line-accent.accent-secondary {
  background: linear-gradient(90deg, transparent 0%, rgba(206, 147, 216, 0.7) 40%, rgba(206, 147, 216, 0.1) 100%);
}

.section-line-accent.accent-info {
  background: linear-gradient(90deg, transparent 0%, rgba(100, 181, 246, 0.7) 40%, rgba(100, 181, 246, 0.1) 100%);
}

/* Feature badges */
.feature-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.feature-number {
  font-family: 'Share Tech Mono', monospace;
  font-size: 2rem;
  font-weight: 700;
  color: rgba(0, 229, 255, 0.25);
  line-height: 1;
}

.feature-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 3px;
  color: rgba(0, 229, 255, 0.6);
  border-left: 2px solid rgba(0, 229, 255, 0.3);
  padding-left: 10px;
}

.feature-badge-sec .feature-number {
  color: rgba(206, 147, 216, 0.25);
}

.feature-badge-sec .feature-label {
  color: rgba(206, 147, 216, 0.6);
  border-color: rgba(206, 147, 216, 0.3);
}

.feature-badge-info .feature-number {
  color: rgba(100, 181, 246, 0.25);
}

.feature-badge-info .feature-label {
  color: rgba(100, 181, 246, 0.6);
  border-color: rgba(100, 181, 246, 0.3);
}

/* Feature list */
.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: rgba(160, 185, 220, 0.85);
  line-height: 1.5;
}

.fi-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(0, 229, 255, 0.8);
  box-shadow: 0 0 6px rgba(0, 229, 255, 0.6);
  margin-top: 5px;
}

.fi-dot.sec {
  background: rgba(206, 147, 216, 0.8);
  box-shadow: 0 0 6px rgba(206, 147, 216, 0.6);
}

.fi-dot.info {
  background: rgba(100, 181, 246, 0.8);
  box-shadow: 0 0 6px rgba(100, 181, 246, 0.6);
}

/* ============================================================
   HUD VIEWER CARDS (3D)
   ============================================================ */
.hud-viewer-card {
  position: relative;
  height: 320px;
  background: rgba(3, 8, 25, 0.8);
  border: 1px solid rgba(0, 229, 255, 0.15);
  backdrop-filter: blur(10px);
  overflow: hidden;
  transition: all 0.4s ease;
}

.hud-viewer-card:hover {
  border-color: rgba(0, 229, 255, 0.4);
  box-shadow: 0 0 40px rgba(0, 229, 255, 0.1), inset 0 0 40px rgba(0, 229, 255, 0.02);
  transform: translateY(-3px);
}

.hud-viewer-sec {
  border-color: rgba(206, 147, 216, 0.15);
}

.hud-viewer-sec:hover {
  border-color: rgba(206, 147, 216, 0.4);
  box-shadow: 0 0 40px rgba(206, 147, 216, 0.1), inset 0 0 40px rgba(206, 147, 216, 0.02);
}

.hud-viewer-info {
  border-color: rgba(100, 181, 246, 0.15);
}

.hud-viewer-info:hover {
  border-color: rgba(100, 181, 246, 0.4);
  box-shadow: 0 0 40px rgba(100, 181, 246, 0.1), inset 0 0 40px rgba(100, 181, 246, 0.02);
}

/* HUD Corners (decorativos) */
.hud-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: rgba(0, 229, 255, 0.7);
  border-style: solid;
  z-index: 5;
}

.hud-corner.sec {
  border-color: rgba(206, 147, 216, 0.7);
}

.hud-corner.info {
  border-color: rgba(100, 181, 246, 0.7);
}

.hud-tl {
  top: 6px;
  left: 6px;
  border-width: 2px 0 0 2px;
}

.hud-tr {
  top: 6px;
  right: 6px;
  border-width: 2px 2px 0 0;
}

.hud-bl {
  bottom: 6px;
  left: 6px;
  border-width: 0 0 2px 2px;
}

.hud-br {
  bottom: 6px;
  right: 6px;
  border-width: 0 2px 2px 0;
}

/* HUD Top/Bottom bars */
.hud-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  border-bottom: 1px solid rgba(0, 229, 255, 0.1);
  backdrop-filter: blur(4px);
}

.hud-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  border-top: 1px solid rgba(0, 229, 255, 0.1);
  backdrop-filter: blur(4px);
}

.hud-status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(0, 229, 255, 0.5);
}

.hud-status-dot.active {
  background: #00e5ff;
  box-shadow: 0 0 6px #00e5ff;
  animation: blink-dot 1.5s ease-in-out infinite;
}

.hud-status-dot.active.sec {
  background: #ce93d8;
  box-shadow: 0 0 6px #ce93d8;
}

.hud-status-dot.active.info {
  background: #64b5f6;
  box-shadow: 0 0 6px #64b5f6;
}

.hud-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 1.5px;
  color: rgba(180, 200, 240, 0.7);
  flex: 1;
}

.hud-value {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 1px;
  color: rgba(180, 200, 240, 0.5);
}

.hud-data-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hud-data-key {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 1px;
  color: rgba(140, 160, 200, 0.5);
}

.hud-data-val {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 0.8rem;
  color: rgba(200, 220, 255, 0.9);
}

.mini-canvas {
  position: absolute;
  top: 36px;
  bottom: 36px;
  left: 0;
  right: 0;
}

/* ============================================================
   COLORES NEÓN
   ============================================================ */
.text-neon {
  color: #00e5ff;
  text-shadow: 0 0 20px rgba(0, 229, 255, 0.5);
}

.text-neon-sec {
  color: #ce93d8;
  text-shadow: 0 0 20px rgba(206, 147, 216, 0.5);
}

.text-neon-info {
  color: #64b5f6;
  text-shadow: 0 0 20px rgba(100, 181, 246, 0.5);
}

/* ============================================================
   CTA SECTION
   ============================================================ */
.cta-section {
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0, 50, 120, 0.15) 0%, transparent 70%),
    var(--dark-base);
  border-top: 1px solid rgba(0, 229, 255, 0.08);
}

/* Rings de fondo del CTA */
.cta-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(0, 229, 255, 0.06);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.cta-ring-1 {
  width: 400px;
  height: 400px;
  animation: ring-pulse 4s ease-in-out infinite;
}

.cta-ring-2 {
  width: 650px;
  height: 650px;
  animation: ring-pulse 4s ease-in-out infinite 1.3s;
}

.cta-ring-3 {
  width: 900px;
  height: 900px;
  animation: ring-pulse 4s ease-in-out infinite 2.6s;
}

@keyframes ring-pulse {

  0%,
  100% {
    opacity: 0.3;
  }

  50% {
    opacity: 0.8;
  }
}

.cta-content {
  position: relative;
  z-index: 2;
  max-width: 700px;
  margin: 0 auto;
}

.cta-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cta-icon-ring {
  position: absolute;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: 1px solid rgba(0, 229, 255, 0.3);
  animation: ring-pulse 2s ease-in-out infinite;
}

.cta-title {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: clamp(1.9rem, 4vw, 2.8rem);
  line-height: 1.2;
  color: #fff;
  letter-spacing: 1px;
}

.cta-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.95rem;
  line-height: 1.75;
  color: rgba(160, 185, 220, 0.8);
  max-width: 580px;
}

/* CTA Stats */
.cta-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  flex-wrap: wrap;
}

.cta-stat {
  padding: 12px 28px;
  text-align: center;
}

.cta-stat-val {
  font-family: 'Rajdhani', sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 1px;
  color: rgba(0, 229, 255, 0.9);
}

.cta-stat-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 2px;
  color: rgba(140, 160, 200, 0.6);
  margin-top: 4px;
}

.cta-stat-divider {
  width: 1px;
  height: 36px;
  background: rgba(255, 255, 255, 0.08);
}

/* ============================================================
   GLOW ANIMATIONS
   ============================================================ */
.animate-glow {
  animation: icon-glow 2.5s ease-in-out infinite;
}

@keyframes icon-glow {

  0%,
  100% {
    filter: drop-shadow(0 0 4px rgba(0, 229, 255, 0.4));
  }

  50% {
    filter: drop-shadow(0 0 12px rgba(0, 229, 255, 0.9));
  }
}

/* ============================================================
   COMPONENTES DE TRABAJO (Dashboard, Historial)
   ============================================================ */
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
  font-family: 'Share Tech Mono', monospace !important;
}

.max-width-300 {
  max-width: 300px;
}
</style>
