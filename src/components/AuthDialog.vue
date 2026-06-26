<template>
  <v-dialog v-model="dialogModel" max-width="480" persistent>
    <v-card class="glass-dialog-card">
      <v-card-title class="d-flex justify-space-between align-center px-6 pt-6">
        <span class="font-weight-black text-h5 tracking-wide text-white">
          PAPOIS <span class="text-primary">EN 3D</span>
        </span>
        <v-btn icon="mdi-close" variant="text" color="grey" density="comfortable" @click="closeDialog" :disabled="loading"></v-btn>
      </v-card-title>

      <v-card-text class="px-6 pb-6 pt-2">
        <!-- Indicador modo simulación -->
        <v-alert
          v-if="isLocalMode"
          type="info"
          variant="tonal"
          color="warning"
          density="compact"
          class="text-caption mb-4"
          prepend-icon="mdi-test-tube"
        >
          <strong>Modo Local Activo:</strong> Puedes usar <code class="text-white">admin@papois.com</code> para Administrador o <code class="text-white">operator@papois.com</code> para Operador (cualquier contraseña), o registrar una cuenta nueva.
        </v-alert>

        <v-tabs v-model="activeTab" grow color="primary" class="mb-4" :disabled="loading">
          <v-tab value="login" class="text-none font-weight-bold">Iniciar Sesión</v-tab>
          <v-tab value="register" class="text-none font-weight-bold">Registrarse</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <!-- VENTANA DE LOGIN -->
          <v-window-item value="login">
            <v-form ref="loginForm" @submit.prevent="handleLogin">
              <v-text-field
                v-model="loginEmail"
                label="Correo Electrónico"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                :rules="[rules.required, rules.email]"
                required
                :disabled="loading"
              ></v-text-field>

              <v-text-field
                v-model="loginPassword"
                label="Contraseña"
                type="password"
                prepend-inner-icon="mdi-lock-outline"
                variant="outlined"
                density="comfortable"
                class="mb-4"
                :rules="[rules.required]"
                required
                :disabled="loading"
              ></v-text-field>

              <v-alert
                v-if="errorMessage"
                type="error"
                variant="tonal"
                density="compact"
                class="text-caption mb-4"
              >
                {{ errorMessage }}
              </v-alert>

              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                variant="flat"
                class="font-weight-bold text-none"
                :loading="loading"
              >
                Ingresar a la Plataforma
              </v-btn>
            </v-form>
          </v-window-item>

          <!-- VENTANA DE REGISTRO -->
          <v-window-item value="register">
            <v-form ref="registerForm" @submit.prevent="handleRegister">
              <v-text-field
                v-model="regFullName"
                label="Nombre Completo"
                type="text"
                prepend-inner-icon="mdi-account-outline"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                :rules="[rules.required]"
                required
                :disabled="loading"
              ></v-text-field>

              <v-text-field
                v-model="regUsername"
                label="Nombre de Usuario"
                type="text"
                prepend-inner-icon="mdi-at"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                :rules="[rules.required, rules.username]"
                required
                :disabled="loading"
              ></v-text-field>

              <v-text-field
                v-model="regEmail"
                label="Correo Electrónico"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                variant="outlined"
                density="comfortable"
                class="mb-3"
                :rules="[rules.required, rules.email]"
                required
                :disabled="loading"
              ></v-text-field>

              <v-text-field
                v-model="regPassword"
                label="Contraseña (Mín. 6 caracteres)"
                type="password"
                prepend-inner-icon="mdi-lock-outline"
                variant="outlined"
                density="comfortable"
                class="mb-4"
                :rules="[rules.required, rules.minLength]"
                required
                :disabled="loading"
              ></v-text-field>

              <v-alert
                v-if="errorMessage"
                type="error"
                variant="tonal"
                density="compact"
                class="text-caption mb-4"
              >
                {{ errorMessage }}
              </v-alert>

              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                variant="flat"
                class="font-weight-bold text-none"
                :loading="loading"
              >
                Crear Cuenta Nueva
              </v-btn>
            </v-form>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'success'): void
}>()

const authStore = useAuthStore()

// Sincronizar modelValue con diálogo
const dialogModel = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Estado
const activeTab = ref<'login' | 'register'>('login')
const isLocalMode = computed(() => authStore.isLocalMode)
const loading = computed(() => authStore.loading)
const errorMessage = ref('')

// Formularios
const loginForm = ref<any>(null)
const registerForm = ref<any>(null)

// Campos Login
const loginEmail = ref('')
const loginPassword = ref('')

// Campos Registro
const regFullName = ref('')
const regUsername = ref('')
const regEmail = ref('')
const regPassword = ref('')

// Reglas de Validación
const rules = {
  required: (v: any) => !!v || 'Este campo es obligatorio',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Ingresa un correo electrónico válido',
  username: (v: string) => v.length >= 3 || 'Debe tener al menos 3 caracteres',
  minLength: (v: string) => v.length >= 6 || 'Debe tener al menos 6 caracteres'
}

// Limpiar estados al cambiar de tab o abrir
watch(activeTab, () => {
  errorMessage.value = ''
})

const closeDialog = () => {
  if (loading.value) return
  dialogModel.value = false
  errorMessage.value = ''
}

// Iniciar sesión
const handleLogin = async () => {
  const { valid } = await loginForm.value?.validate()
  if (!valid) return

  errorMessage.value = ''
  const res = await authStore.login(loginEmail.value, loginPassword.value)
  
  if (res.success) {
    emit('success')
    closeDialog()
    // Resetear formulario
    loginEmail.value = ''
    loginPassword.value = ''
  } else {
    errorMessage.value = res.error || 'Error al iniciar sesión'
  }
}

// Registrar usuario
const handleRegister = async () => {
  const { valid } = await registerForm.value?.validate()
  if (!valid) return

  errorMessage.value = ''
  const res = await authStore.register(
    regEmail.value,
    regPassword.value,
    regUsername.value,
    regFullName.value
  )

  if (res.success) {
    emit('success')
    closeDialog()
    // Resetear formulario
    regEmail.value = ''
    regPassword.value = ''
    regUsername.value = ''
    regFullName.value = ''
  } else {
    errorMessage.value = res.error || 'Error al registrarse'
  }
}
</script>

<style scoped>
.glass-dialog-card {
  background: rgba(15, 23, 42, 0.8) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 16px !important;
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4) !important;
}

code {
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
}
</style>
