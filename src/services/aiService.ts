import type { ModelData } from '../lib/supabase'

export interface AIResponse {
  content: string
  suggestions: string[]
}

// Configuración de filamentos sugerida
export const MATERIAL_SPECS: Record<string, { temp: string; bed: string; speed: string; density: number; desc: string }> = {
  PLA: {
    temp: '190°C - 210°C',
    bed: '50°C - 60°C',
    speed: '50 - 80 mm/s',
    density: 1.24,
    desc: 'Fácil de imprimir, excelente detalle, baja contracción térmica. Ideal para prototipos estéticos.'
  },
  ABS: {
    temp: '230°C - 250°C',
    bed: '90°C - 110°C',
    speed: '40 - 60 mm/s',
    density: 1.04,
    desc: 'Resistente al impacto y temperatura, alta contracción térmica. Requiere cama caliente y preferiblemente cámara cerrada para evitar warping.'
  },
  PETG: {
    temp: '220°C - 240°C',
    bed: '70°C - 85°C',
    speed: '40 - 60 mm/s',
    density: 1.27,
    desc: 'Excelente resistencia mecánica y química, duradero en exteriores. Termo-resistencia media, requiere buen enfriamiento de capa.'
  },
  TPU: {
    temp: '210°C - 230°C',
    bed: '40°C - 60°C',
    speed: '15 - 35 mm/s',
    density: 1.20,
    desc: 'Material flexible y elástico. Requiere extrusión directa y velocidades de impresión muy bajas.'
  }
}

export const aiService = {
  // Genera un análisis inicial cuando el modelo es cargado
  generateInitialAnalysis(model: ModelData): AIResponse {
    const { name, volume_cm3, bounding_box_x, bounding_box_y, bounding_box_z, filament_type } = model

    const sizeX = Math.round(bounding_box_x)
    const sizeY = Math.round(bounding_box_y)
    const sizeZ = Math.round(bounding_box_z)

    const specs = MATERIAL_SPECS[filament_type] || MATERIAL_SPECS.PLA

    // Analizar proporciones físicas
    const isTall = sizeZ > Math.max(sizeX, sizeY) * 1.5
    const isFlat = sizeZ < Math.min(sizeX, sizeY) * 0.2
    const isVeryLarge = Math.max(sizeX, sizeY, sizeZ) > 200
    const isVerySmall = Math.max(sizeX, sizeY, sizeZ) < 15

    let physicalAnalysis = ''
    let suggestions: string[] = []

    if (isTall) {
      physicalAnalysis = `El modelo **"${name}"** es marcadamente **alto y esbelto** (${sizeZ}mm de altura). Debido a su baja superficie de contacto relativa con la cama, existe un alto riesgo de balanceo o desprendimiento durante las capas superiores.`
      suggestions = [
        '¿Cómo puedo mejorar la adhesión a la cama para este modelo alto?',
        '¿Qué velocidad de impresión me recomiendas para evitar balanceos?',
        '¿Debo usar soportes para evitar que vibre la parte superior?'
      ]
    } else if (isFlat) {
      physicalAnalysis = `El modelo **"${name}"** tiene un perfil **plano y ancho** (${sizeX}x${sizeY}mm, con solo ${sizeZ}mm de altura). Esto lo hace excelente para la adhesión a la cama, pero propenso a tensiones internas de contracción.`
      suggestions = [
        '¿Cómo evito el warping en las esquinas de esta pieza ancha?',
        '¿Qué porcentaje de relleno es óptimo para evitar deformaciones?',
        '¿Recomiendas activar ventilación de capa para las primeras capas?'
      ]
    } else if (isVeryLarge) {
      physicalAnalysis = `El modelo **"${name}"** es de **gran tamaño** (${sizeX}x${sizeY}x${sizeZ}mm), ocupando un volumen significativo (${Math.round(volume_cm3)} cm³). El tiempo de impresión y el consumo de filamento serán elevados.`
      suggestions = [
        '¿Cómo puedo reducir el tiempo de impresión de esta pieza grande?',
        '¿Qué patrón de relleno ahorra más material manteniendo la resistencia?',
        '¿Puedo ahuecar el modelo para gastar menos filamento?'
      ]
    } else if (isVerySmall) {
      physicalAnalysis = `El modelo **"${name}"** es **miniatura** (${sizeX}x${sizeY}x${sizeZ}mm). Requerirá un enfriamiento excelente de capa y una altura de capa muy baja para conservar los detalles finos.`
      suggestions = [
        '¿Qué altura de capa y diámetro de boquilla debo usar para esta miniatura?',
        '¿Cómo evito que el calor de la boquilla derrita las capas pequeñas?',
        '¿A qué velocidad debo imprimir para detalles de alta definición?'
      ]
    } else {
      physicalAnalysis = `El modelo **"${name}"** presenta proporciones físicas **equilibradas y estables** (${sizeX}x${sizeY}x${sizeZ}mm). Es un modelo excelente para impresión estándar.`
      suggestions = [
        '¿Cuál es la orientación recomendada para imprimir este modelo?',
        '¿Qué configuraciones de relleno me darán el mejor acabado superficial?',
        '¿Necesito soportes en los voladizos de este diseño?'
      ]
    }

    const content = `### 🤖 Análisis Geométrico Inteligente: **${name}**

He procesado el archivo 3D y extraído su geometría física:
- **Dimensiones:** ${sizeX} mm (X) × ${sizeY} mm (Y) × ${sizeZ} mm (Z)
- **Volumen Real de Sólido:** **${volume_cm3.toFixed(2)} cm³**
- **Material seleccionado:** **${filament_type}** (Densidad: ${specs.density} g/cm³)

#### 🔍 Diagnóstico Físico y Estabilidad:
${physicalAnalysis}

#### ⚙️ Parámetros de Impresión Recomendados para **${filament_type}**:
1. **Temperatura del Extrusor:** \`${specs.temp}\` (Tu filamento requiere este rango para fluir sin atascos).
2. **Temperatura de la Cama:** \`${specs.bed}\` (Esencial para mantener la adhesión inicial).
3. **Velocidad Sugerida:** \`${specs.speed}\` (Optimiza el tiempo versus calidad de acabado).
4. **Adhesión a la cama:** ${isTall ? 'Se recomienda fuertemente usar **Brim** (borde de 8mm) o **Raft**.' : isFlat && filament_type === 'ABS' ? 'Se sugiere usar **Brim** y adhesivo adhesivo (Laca/Pegamento) para evitar el desprendimiento de esquinas.' : 'Falda (**Skirt**) estándar de 3 líneas es suficiente.'}
5. **Relleno (*Infill*):** Para este volumen, un relleno de **${model.infill_percent}%** con patrón **Giroide (Gyroid)** ofrecerá la máxima resistencia mecánica multidireccional utilizando la mínima cantidad de plástico.

¿Qué aspecto te gustaría optimizar o analizar más a fondo?`

    return { content, suggestions }
  },

  // Genera respuestas a preguntas personalizadas del usuario basadas en el modelo
  generateResponse(prompt: string, model: ModelData): AIResponse {
    const p = prompt.toLowerCase()
    const name = model.name
    const sizeX = Math.round(model.bounding_box_x)
    const sizeY = Math.round(model.bounding_box_y)
    const sizeZ = Math.round(model.bounding_box_z)
    const mat = model.filament_type
    const specs = MATERIAL_SPECS[mat] || MATERIAL_SPECS.PLA

    let content = ''
    let suggestions: string[] = []

    if (p.includes('warping') || p.includes('desprende') || p.includes('esquinas') || p.includes('adhesión') || p.includes('pega')) {
      content = `### 🌡️ Cómo Evitar el Warping y Mejorar la Adhesión de **${name}**

El desprendimiento de esquinas (*warping*) ocurre por la contracción térmica desigual del filamento a medida que se enfría. Dado que tu pieza tiene dimensiones de **${sizeX}x${sizeY}mm**, las tensiones térmicas en los extremos pueden ser significativas (especialmente si usas **${mat}**).

#### Soluciones Técnicas Recomendadas:
1. **Tipo de Adhesión (Brim/Borde):** Configura en tu rebanador un **Brim** con un ancho de \`6 a 10 mm\`. Esto expande el área del primer estrato y sujeta las esquinas firmemente.
2. **Temperatura de la Cama:** Ajusta la temperatura a **${specs.bed}**. Si estás usando ABS, asegúrate de alcanzar los **100°C** y mantén la impresora en un gabinete cerrado (sin corrientes de aire).
3. **Flujo de Aire (Ventilador de Capa):** 
   - Para **PLA**: Ventilador al 100% después de la capa 2.
   - Para **PETG**: Ventilador al 30-50% para equilibrar transparencia y adhesión de capa.
   - Para **ABS**: **¡Apaga el ventilador de capa!** El aire frío provocará que la pieza se agriete y se curve.
4. **Primera Capa Lenta:** Reduce la velocidad de la primera capa a **15 - 20 mm/s** y aumenta el flujo de la primera capa a **105%** para asegurar que el plástico sea presionado firmemente contra la cama.`

      suggestions = [
        '¿Cómo configuro la altura de capa del primer estrato?',
        '¿Qué adhesivos (laca, cinta) funcionan mejor con este material?',
        '¿Cuáles son los parámetros de velocidad óptimos?'
      ]
    } else if (p.includes('tiempo') || p.includes('rápido') || p.includes('acelerar') || p.includes('demora') || p.includes('tarda')) {
      const estimatedHrs = (model.estimated_time_min / 60).toFixed(1)
      content = `### ⚡ Estrategias para Reducir el Tiempo de Impresión de **${name}**

Actualmente, el tiempo estimado para imprimir este modelo es de aproximadamente **${estimatedHrs} horas** (${model.estimated_time_min} minutos) con una altura de capa de **${model.layer_height_mm}mm** y **${model.infill_percent}%** de relleno.

Aquí tienes técnicas seguras para acelerar el proceso sin comprometer la resistencia estructural:

#### 1. Altura de Capa Adaptativa o Mayor
- Cambiar la altura de capa de **${model.layer_height_mm}mm** a **0.28mm** (utilizando una boquilla estándar de 0.4mm) reducirá el tiempo de impresión en casi un **40%**. Los detalles verticales se notarán un poco más ásperos, pero para piezas mecánicas es ideal.

#### 2. Optimización del Relleno (*Infill*)
- **Relleno Relámpago (*Lightning Infill*):** Este patrón genera relleno denso solo cerca del techo del modelo (donde se necesita para soportar las capas superiores) y deja el interior casi vacío. Puede ahorrar hasta un **30% de tiempo y filamento** en modelos estéticos.
- Reduce el relleno al **8% - 10%**. Para la gran mayoría de figuras y soportes decorativos, 10% de relleno es más que suficiente.

#### 3. Ancho de Línea de Extrusión
- Si aumentas el ancho de línea de **0.4mm a 0.6mm** (incluso con boquilla de 0.4mm), el rebanador necesitará menos perímetros para lograr el mismo espesor de pared, reduciendo el recorrido drásticamente.

#### 4. Velocidad de Relleno Alta
- Mantén los perímetros externos lentos (ej. 45 mm/s) para un acabado estético impecable, pero aumenta la velocidad del relleno interno a **80 - 100 mm/s** si tu extrusor lo permite.`

      suggestions = [
        '¿Qué es la altura de capa adaptativa?',
        '¿Cuántas paredes (perímetros) me recomiendas para este modelo?',
        '¿Cómo afecta el patrón Giroide al tiempo total?'
      ]
    } else if (p.includes('relleno') || p.includes('infill') || p.includes('patrón') || p.includes('resistencia') || p.includes('fuerte')) {
      content = `### 🦾 Optimización de Resistencia y Patrón de Relleno para **${name}**

Para una pieza de volumen **${model.volume_cm3.toFixed(1)} cm³**, la configuración del relleno es vital. El relleno no solo soporta el modelo por dentro, sino que define su tenacidad mecánica.

#### Recomendaciones de Patrones de Relleno:
1. **Giroide (Gyroid):** *¡El más recomendado!* Distribuye la fuerza equitativamente en las tres dimensiones físicas (ejes X, Y, Z) y no tiene líneas cruzadas en la misma capa, lo que evita atascos de la boquilla y vibración. Excelente resistencia con solo **12% a 15%** de densidad.
2. **Cúbico (Cubic):** Excelente para resistencia a la compresión en modelos de ingeniería. Varía su patrón tridimensional en cada capa.
3. **Rejilla / Cuadrícula (Grid / Triangles):** Rápido de imprimir, pero genera intersecciones donde la boquilla pasa sobre plástico ya depositado en la misma capa, lo que puede causar golpeteo a altas velocidades.

#### ¿Cómo lograr una pieza indestructible sin subir el relleno al 100%?
- **Aumenta el número de Perímetros (Paredes):** Es mucho más eficiente aumentar las paredes de **2 a 4** que aumentar el relleno de 15% a 50%. El 90% de la resistencia a la flexión de una pieza de plástico proviene de sus paredes exteriores.
- **Aumenta las capas superiores e inferiores:** Configura al menos **4 capas superiores y 4 inferiores** para evitar agujeros y debilidad estructural.`

      suggestions = [
        '¿Por qué el patrón Giroide es mejor que el Rectilíneo?',
        '¿Cómo configuro perímetros dinámicos en Cura o PrusaSlicer?',
        '¿Qué material es el más resistente al impacto?'
      ]
    } else if (p.includes('soporte') || p.includes('colgar') || p.includes('overhang') || p.includes('puente')) {
      const height = Math.round(model.bounding_box_z)
      content = `### 🌲 Análisis de Soportes y Voladizos para **${name}**

El modelo tiene una altura de **${height}mm**. Para evaluar la necesidad de soportes, debemos fijarnos en los ángulos de inclinación (voladizos) con respecto a la cama vertical.

#### Regla de Oro: La Regla de los 45 Grados
- Cualquier ángulo inferior a **45°** con la vertical se puede imprimir en el aire sin soportes gracias al solapamiento de capas.
- Ángulos entre **45° y 60°** requieren un enfriamiento de capa muy agresivo (100% ventilador) y reducir la velocidad para no descolgarse.
- Ángulos mayores a **60°** requieren soporte obligatoriamente.

#### Recomendación de Configuración de Soportes:
1. **Soportes de Árbol (Tree Supports):** *Altamente sugeridos.* En lugar de columnas rectas pesadas, los soportes de árbol crecen desde la placa de construcción rodeando el modelo y solo tocan la pieza en las zonas necesarias. 
   - **Ventajas:** Se retiran con extrema facilidad con la mano, no dejan marcas en el modelo y ahorran hasta un **50% de material** en comparación con el soporte estándar.
2. **Distancia de Contacto Z:** Configura la distancia Z del soporte a exactamente **0.2mm** (o igual a la altura de tu capa). Si es menor, el soporte se soldará a la pieza; si es mayor, el filamento del voladizo se descolgará.
3. **Soportes solo desde la Cama:** Si es posible, activa "Únicamente desde la base de impresión" en tu rebanador para evitar que los soportes se construyan encima de superficies del propio modelo, minimizando cicatrices estéticas.`

      suggestions = [
        '¿Cómo configuro la interfaz de soporte para un acabado suave?',
        '¿Cómo puedo rotar el modelo para no usar soportes?',
        '¿Qué velocidad de impresión se usa para los soportes?'
      ]
    } else {
      // Respuesta por defecto con toques contextuales
      content = `### 💡 Consulta del Operador sobre **${name}**

¡Hola! He recibido tu consulta. Con base en los parámetros actuales del modelo:
- **Modelo:** ${name} (${sizeX}x${sizeY}x${sizeZ} mm)
- **Volumen de plástico:** ${model.volume_cm3.toFixed(2)} cm³
- **Material configurado:** ${mat} (${specs.temp} / ${specs.bed})

Para responder a tu pregunta sobre: "${prompt}":

En el ámbito de la impresión 3D, estos parámetros físicos determinan que la pieza de **${mat}** responderá mejor si mantienes un control estricto sobre las temperaturas y la calibración de la primera capa. Dado que la pieza tiene un volumen de **${model.volume_cm3.toFixed(1)} cm³**, te sugiero mantener el relleno en **${model.infill_percent}%** con un patrón Giroide, lo que mantendrá el consumo del material en torno a los **${model.estimated_weight_g.toFixed(1)} gramos** y un costo de producción muy bajo.

Si tienes alguna pregunta específica sobre la configuración de retracciones para evitar hilos (*stringing*), calibración de flujo, o nivelación de la cama térmica, dime y te guiaré paso a paso con las configuraciones exactas para tu rebanador (Cura, PrusaSlicer o Bambu Studio).`

      suggestions = [
        '¿Cómo calibro la retracción para evitar hilos?',
        '¿Cuál es el mejor software rebanador para este modelo?',
        '¿Cómo configuro el flujo de extrusión óptimo?'
      ]
    }

    return { content, suggestions }
  }
}
