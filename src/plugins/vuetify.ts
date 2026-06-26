/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com
 */

// Composables
import { createVuetify } from 'vuetify'
// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Configuración de Tema Oscuro Premium Personalizado
const premiumDarkTheme = {
  dark: true,
  colors: {
    background: '#0a0e17', // Fondo ultra oscuro
    surface: '#121926',    // Superficie de tarjetas
    'surface-bright': '#1d273a',
    'surface-light': '#172237',
    primary: '#00e5ff',    // Cian neón principal
    'primary-darken-1': '#00b2cc',
    secondary: '#9c27b0',  // Violeta de acento
    'secondary-darken-1': '#7b1fa2',
    error: '#ff5252',      // Rojo pastel
    info: '#2196f3',       // Azul
    success: '#4caf50',    // Verde
    warning: '#fb8c00',    // Naranja/Ámbar
  },
  variables: {
    'border-color': '#ffffff',
    'border-opacity': 0.08,
    'high-emphasis-opacity': 0.9,
    'medium-emphasis-opacity': 0.6,
  }
}

export default createVuetify({
  theme: {
    defaultTheme: 'premiumDarkTheme',
    themes: {
      premiumDarkTheme,
    },
  },
})
