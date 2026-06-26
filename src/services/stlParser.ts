export interface ParsedSTL {
  name: string
  volume: number // en cm3
  boundingBox: {
    min: { x: number; y: number; z: number }
    max: { x: number; y: number; z: number }
    size: { x: number; y: number; z: number }
  }
  positions: Float32Array // Vértices aplanados para Three.js
  triangleCount: number
}

export const parseSTL = (file: File): Promise<ParsedSTL> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      if (!buffer) {
        reject(new Error('No se pudo leer el archivo'))
        return
      }

      try {
        const isBinary = checkIfBinary(buffer)
        const result = isBinary ? parseBinary(buffer, file.name) : parseASCII(buffer, file.name)
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = () => reject(new Error('Error leyendo el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

// Determinar si el archivo STL es Binario o ASCII
const checkIfBinary = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 84) return false

  // Comprobar si el tamaño del buffer coincide exactamente con la cabecera + conteo + caras binarias
  const reader = new DataView(buffer)
  const faceCount = reader.getUint32(80, true)
  const expectedSize = 80 + 4 + faceCount * 50

  if (buffer.byteLength === expectedSize) {
    return true
  }

  // Fallback: comprobar los primeros 80 caracteres en busca de caracteres no imprimibles
  const header = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength))
  for (let i = 0; i < header.length; i++) {
    if (header[i] < 9 && header[i] !== 0) { // caracteres de control no estándar
      return true
    }
  }

  // Si los primeros caracteres son "solid", probablemente sea ASCII, a menos que sea un archivo binario mal formateado
  const textDecoder = new TextDecoder()
  const startText = textDecoder.decode(header.slice(0, 5))
  return startText !== 'solid'
}

// Analizador de STL Binario
const parseBinary = (buffer: ArrayBuffer, fileName: string): ParsedSTL => {
  const reader = new DataView(buffer)
  const triangleCount = reader.getUint32(80, true)

  // Cada triángulo contiene: normal (3*float), v1 (3*float), v2 (3*float), v3 (3*float), attribute (uint16) = 50 bytes
  // Guardaremos solo los vértices para renderizar (3 vértices * 3 coordenadas = 9 floats por triángulo)
  const positions = new Float32Array(triangleCount * 9)

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let totalVolume = 0

  let byteOffset = 84

  for (let i = 0; i < triangleCount; i++) {
    if (byteOffset + 50 > buffer.byteLength) {
      break // El archivo está truncado
    }

    // Saltar la normal (12 bytes)
    byteOffset += 12

    // Vértice 1
    const v1x = reader.getFloat32(byteOffset, true)
    const v1y = reader.getFloat32(byteOffset + 4, true)
    const v1z = reader.getFloat32(byteOffset + 8, true)
    byteOffset += 12

    // Vértice 2
    const v2x = reader.getFloat32(byteOffset, true)
    const v2y = reader.getFloat32(byteOffset + 4, true)
    const v2z = reader.getFloat32(byteOffset + 8, true)
    byteOffset += 12

    // Vértice 3
    const v3x = reader.getFloat32(byteOffset, true)
    const v3y = reader.getFloat32(byteOffset + 4, true)
    const v3z = reader.getFloat32(byteOffset + 8, true)
    byteOffset += 12

    // Saltar attribute byte count (2 bytes)
    byteOffset += 2

    // Guardar en posiciones aplanadas para Three.js
    const idx = i * 9
    positions[idx] = v1x
    positions[idx + 1] = v1y
    positions[idx + 2] = v1z
    positions[idx + 3] = v2x
    positions[idx + 4] = v2y
    positions[idx + 5] = v2z
    positions[idx + 6] = v3x
    positions[idx + 7] = v3y
    positions[idx + 8] = v3z

    // Actualizar Bounding Box
    minX = Math.min(minX, v1x, v2x, v3x)
    minY = Math.min(minY, v1y, v2y, v3y)
    minZ = Math.min(minZ, v1z, v2z, v3z)

    maxX = Math.max(maxX, v1x, v2x, v3x)
    maxY = Math.max(maxY, v1y, v2y, v3y)
    maxZ = Math.max(maxZ, v1z, v2z, v3z)

    // Calcular volumen con tetraedros firmados desde el origen
    totalVolume += signedVolumeOfTetrahedron(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z)
  }

  // Si no se leyó nada, resetear a 0
  if (triangleCount === 0) {
    minX = minY = minZ = maxX = maxY = maxZ = 0
  }

  return {
    name: fileName,
    volume: Math.abs(totalVolume) / 1000, // De mm3 a cm3
    boundingBox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    },
    positions,
    triangleCount
  }
}

// Analizador de STL ASCII
const parseASCII = (buffer: ArrayBuffer, fileName: string): ParsedSTL => {
  const textDecoder = new TextDecoder()
  const text = textDecoder.decode(buffer)

  const lines = text.split(/\r?\n/)
  const vertices: number[] = []

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let totalVolume = 0

  let currentTriangle: [number, number, number][] = []

  // Expresión regular rápida para encontrar vértices
  // vertex x y z
  const vertexRegex = /^\s*vertex\s+([eE0-9.-]+)\s+([eE0-9.-]+)\s+([eE0-9.-]+)\s*$/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(vertexRegex)

    if (match) {
      const x = parseFloat(match[1])
      const y = parseFloat(match[2])
      const z = parseFloat(match[3])

      vertices.push(x, y, z)
      currentTriangle.push([x, y, z])

      // Bounding Box
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      maxZ = Math.max(maxZ, z)

      if (currentTriangle.length === 3) {
        const [v1, v2, v3] = currentTriangle
        totalVolume += signedVolumeOfTetrahedron(
          v1[0], v1[1], v1[2],
          v2[0], v2[1], v2[2],
          v3[0], v3[1], v3[2]
        )
        currentTriangle = []
      }
    }
  }

  const triangleCount = Math.floor(vertices.length / 9)
  const positions = new Float32Array(vertices)

  if (triangleCount === 0) {
    minX = minY = minZ = maxX = maxY = maxZ = 0
  }

  return {
    name: fileName,
    volume: Math.abs(totalVolume) / 1000,
    boundingBox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
    },
    positions,
    triangleCount
  }
}

// Volumen firmado de un tetraedro formado por el origen (0,0,0) y 3 vértices A, B, C
const signedVolumeOfTetrahedron = (
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number
): number => {
  return (1.0 / 6.0) * (
    -cx * by * az +
     bx * cy * az +
     cx * ay * bz -
     ax * cy * bz -
     bx * ay * cz +
     ax * by * cz
  )
}
