<template>
  <v-card class="glass-card flex-grow-1 d-flex flex-column h-100" min-height="450">
    <!-- Cabecera de la IA -->
    <v-card-item class="pb-2">
      <template v-slot:prepend>
        <div class="ai-status-container">
          <div class="ai-avatar-glow" :class="{ 'ai-thinking': thinking }">
            <v-icon color="white" size="20">mdi-robot-vacuum</v-icon>
          </div>
          <span class="status-dot" :class="thinking ? 'pulse-yellow' : 'active-green'"></span>
        </div>
      </template>
      <v-card-title class="font-weight-bold">Asistente Generativo IA</v-card-title>
      <v-card-subtitle>{{ thinking ? 'La IA está analizando...' : 'Conectado y listo para asesorar' }}</v-card-subtitle>
    </v-card-item>

    <v-divider class="mx-4 border-opacity-25"></v-divider>

    <!-- Historial de Conversación -->
    <div ref="chatContainer" class="chat-timeline px-4 py-3 flex-grow-1">
      <div v-if="!activeModel" class="d-flex flex-column align-center justify-center h-100 text-center py-8">
        <v-icon size="48" color="grey-darken-2" class="mb-3">mdi-message-lock</v-icon>
        <span class="text-subtitle-2 text-grey-darken-1">Conversación bloqueada</span>
        <span class="text-caption text-grey-darken-2 max-width-250 mt-1">
          Sube un archivo 3D en el panel izquierdo para abrir un canal seguro con el Asistente de IA.
        </span>
      </div>

      <div v-else>
        <!-- Mensajes del chat -->
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="message-wrapper d-flex mb-4"
          :class="msg.sender === 'user' ? 'justify-end' : 'justify-start'"
        >
          <!-- Avatar del Asistente -->
          <div v-if="msg.sender === 'assistant'" class="avatar-assistant me-2 mt-1">
            <v-icon size="16" color="primary">mdi-robot</v-icon>
          </div>

          <!-- Burbuja de texto -->
          <div
            class="message-bubble py-2 px-3"
            :class="msg.sender === 'user' ? 'bubble-user' : 'bubble-assistant'"
          >
            <!-- Renderizado de Markdown simple hecho en HTML -->
            <div class="markdown-content" v-html="renderMarkdown(msg.content)"></div>
            <span class="message-time block mt-1">{{ formatMsgTime(msg.created_at) }}</span>
          </div>
        </div>

        <!-- Burbuja de Pensamiento (Thinking) -->
        <div v-if="thinking" class="d-flex mb-4 justify-start">
          <div class="avatar-assistant me-2 mt-1">
            <v-icon size="16" color="primary">mdi-robot</v-icon>
          </div>
          <div class="message-bubble bubble-assistant py-3 px-4">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sugerencias rápidas contextualmente dinámicas -->
    <div v-if="activeModel && suggestions.length > 0 && !thinking" class="suggestions-bar px-4 py-2">
      <div class="d-flex flex-wrap gap-2">
        <button
          v-for="(sug, idx) in suggestions"
          :key="idx"
          class="sug-badge text-none text-caption"
          @click="sendPresetQuestion(sug)"
        >
          💡 {{ sug }}
        </button>
      </div>
    </div>

    <!-- Caja de Entrada de Texto -->
    <v-card-actions v-if="activeModel" class="px-4 pb-4 pt-1">
      <v-text-field
        v-model="userInput"
        placeholder="Pregunta a la IA sobre relleno, soportes, warping..."
        density="compact"
        variant="outlined"
        hide-details
        class="chat-input me-2"
        color="primary"
        @keyup.enter="sendMessage"
        :disabled="thinking"
      >
        <template v-slot:append-inner>
          <v-icon color="grey-darken-1" size="20">mdi-text-box-search-outline</v-icon>
        </template>
      </v-text-field>
      <v-btn
        color="primary"
        variant="flat"
        icon="mdi-send"
        density="comfortable"
        @click="sendMessage"
        :disabled="!userInput.trim() || thinking"
        class="send-btn"
      ></v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { dbService } from '../lib/supabase'
import type { ModelData, AIMessage } from '../lib/supabase'
import { aiService } from '../services/aiService'

const props = defineProps<{
  activeModel: ModelData | null
}>()

const messages = ref<AIMessage[]>([])
const suggestions = ref<string[]>([])
const userInput = ref('')
const thinking = ref(false)
const chatContainer = ref<HTMLDivElement | null>(null)

let currentChatId = ''

// ==========================================
// CICLO DE CONVERSACIÓN / CARGA DE HILO
// ==========================================

const initChatForModel = async (model: ModelData) => {
  thinking.value = true
  messages.value = []
  suggestions.value = []

  try {
    // 1. Crear o buscar un chat para este modelo
    // Para simplificar, creamos un nuevo hilo de chat por cada archivo subido
    const chatId = await dbService.createChat(model.id || '')
    currentChatId = chatId

    // 2. Generar el análisis geométrico inicial con IA
    const initialAnalysis = aiService.generateInitialAnalysis(model)
    
    // Guardar en Base de Datos
    const welcomeMsg: AIMessage = {
      chat_id: currentChatId,
      sender: 'assistant',
      content: initialAnalysis.content,
      created_at: new Date().toISOString()
    }
    
    const savedWelcome = await dbService.saveChatMessage(welcomeMsg)
    messages.value = [savedWelcome]
    suggestions.value = initialAnalysis.suggestions
  } catch (err) {
    console.error('Error inicializando chat con IA:', err)
  } finally {
    thinking.value = false
    scrollToBottom()
  }
}

// Observar cuando cambia el modelo activo para recargar el asistente
watch(() => props.activeModel, (newModel) => {
  if (newModel) {
    initChatForModel(newModel)
  } else {
    messages.value = []
    suggestions.value = []
    currentChatId = ''
  }
})

// ==========================================
// ENVÍO DE MENSAJES
// ==========================================

const sendMessage = async () => {
  const text = userInput.value.trim()
  if (!text || !props.activeModel || !currentChatId || thinking.value) return

  userInput.value = ''
  await handleUserMessage(text)
}

const sendPresetQuestion = async (question: string) => {
  if (!props.activeModel || !currentChatId || thinking.value) return
  
  // Remover la pregunta de las sugerencias para evitar duplicados
  suggestions.value = suggestions.value.filter(s => s !== question)
  await handleUserMessage(question)
}

const handleUserMessage = async (text: string) => {
  // 1. Añadir y guardar mensaje de usuario
  const userMsg: AIMessage = {
    chat_id: currentChatId,
    sender: 'user',
    content: text,
    created_at: new Date().toISOString()
  }

  thinking.value = true
  
  try {
    const savedUserMsg = await dbService.saveChatMessage(userMsg)
    messages.value.push(savedUserMsg)
    scrollToBottom()

    // 2. Simular tiempo de procesamiento de la IA (entre 1.2 y 2 segundos)
    const delay = 1200 + Math.random() * 800
    await new Promise(resolve => setTimeout(resolve, delay))

    // 3. Generar respuesta contextual de IA
    const aiResponse = aiService.generateResponse(text, props.activeModel!)

    const assistantMsg: AIMessage = {
      chat_id: currentChatId,
      sender: 'assistant',
      content: aiResponse.content,
      created_at: new Date().toISOString()
    }

    const savedAssistantMsg = await dbService.saveChatMessage(assistantMsg)
    messages.value.push(savedAssistantMsg)
    suggestions.value = aiResponse.suggestions
  } catch (err) {
    console.error('Error al procesar mensaje con la IA:', err)
  } finally {
    thinking.value = false
    scrollToBottom()
  }
}

// ==========================================
// RENDERIZADO Y UTILIDADES DE TEXTO
// ==========================================

// Formateador markdown básico e inofensivo para la interfaz
const renderMarkdown = (text: string): string => {
  let html = text
    // Escapar HTML para evitar XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
  // Encabezados (### y ####)
  html = html.replace(/^### (.*?)$/gm, '<h4 class="text-subtitle-1 font-weight-black text-primary mt-2 mb-1">$1</h4>')
  html = html.replace(/^#### (.*?)$/gm, '<h5 class="text-subtitle-2 font-weight-bold text-white mt-2 mb-1">$1</h5>')

  // Negritas (**texto**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary font-weight-bold">$1</strong>')

  // Código en línea (`código`)
  html = html.replace(/`(.*?)`/g, '<code class="code-inline">$1</code>')

  // Listas con viñetas (- viñeta o 1. viñeta)
  html = html.replace(/^\s*-\s+(.*?)$/gm, '<div class="list-bullet-item"><span class="bullet-dot">•</span> $1</div>')
  html = html.replace(/^\s*\d+\.\s+(.*?)$/gm, '<div class="list-bullet-item"><span class="bullet-number">$1</span></div>')

  // Saltos de línea
  html = html.replace(/\n/g, '<br/>')

  return html
}

const formatMsgTime = (timestamp?: string): string => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

onMounted(() => {
  if (props.activeModel) {
    initChatForModel(props.activeModel)
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

.ai-status-container {
  position: relative;
  margin-right: 8px;
}

.ai-avatar-glow {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2196f3, #00d2ff);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(0, 210, 255, 0.4);
}

.ai-thinking {
  animation: pulse-glow 1.5s infinite ease-in-out;
  background: linear-gradient(135deg, #ff9800, #ffc107);
  box-shadow: 0 0 15px rgba(255, 152, 0, 0.6);
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid #0a0e17;
}

.active-green {
  background-color: #4caf50;
}

.pulse-yellow {
  background-color: #ffc107;
  animation: blink 1s infinite;
}

.chat-timeline {
  overflow-y: auto;
  max-height: calc(100vh - 310px);
}

.avatar-assistant {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(33, 150, 243, 0.15);
  border: 1px solid rgba(33, 150, 243, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-bubble {
  max-width: 85%;
  border-radius: 12px;
  font-size: 0.85rem;
  line-height: 1.45;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.bubble-user {
  background: #2196f3;
  color: #ffffff;
  border-top-right-radius: 2px;
  border-bottom-left-radius: 12px;
}

.bubble-assistant {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  border-top-left-radius: 2px;
  border-bottom-right-radius: 12px;
}

.message-time {
  font-size: 0.65rem;
  opacity: 0.5;
  text-align: right;
}

.bubble-user .message-time {
  color: #e0f2fe;
}

.suggestions-bar {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

.sug-badge {
  background: rgba(33, 150, 243, 0.08);
  border: 1px solid rgba(33, 150, 243, 0.25);
  color: #90caf9;
  border-radius: 16px;
  padding: 4px 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sug-badge:hover {
  background: rgba(33, 150, 243, 0.18);
  border-color: #2196f3;
  color: #ffffff;
  transform: translateY(-1px);
}

.chat-input {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
}

.send-btn {
  background: linear-gradient(135deg, #2196f3, #00d2ff) !important;
  color: white !important;
}

.max-width-250 {
  max-width: 250px;
}

/* Indicador de escritura animado */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background-color: #94a3b8;
  border-radius: 50%;
  display: inline-block;
  animation: bounce-dots 1.4s infinite both;
}

.typing-indicator span:nth-child(2) { animation-delay: .2s; }
.typing-indicator span:nth-child(3) { animation-delay: .4s; }

@keyframes bounce-dots {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(1); box-shadow: 0 0 10px rgba(255, 152, 0, 0.4); }
  50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(255, 152, 0, 0.8); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

<!-- Estilos globales inyectados para el marcado HTML dentro del Markdown -->
<style>
.markdown-content h4 {
  margin-top: 10px;
  margin-bottom: 6px;
}
.markdown-content h5 {
  margin-top: 8px;
  margin-bottom: 4px;
}
.markdown-content code.code-inline {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8rem;
  color: #00e5ff;
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.bubble-user .markdown-content code.code-inline {
  background: rgba(0, 0, 0, 0.2);
  color: #ffffff;
}
.markdown-content .list-bullet-item {
  display: flex;
  align-items: flex-start;
  margin-left: 4px;
  margin-bottom: 3px;
}
.markdown-content .bullet-dot {
  color: #00e5ff;
  font-weight: bold;
  margin-right: 6px;
  font-size: 1.1rem;
  line-height: 1;
}
.bubble-user .markdown-content .bullet-dot {
  color: #ffffff;
}
</style>
