<template>
  <div class="p-6">
   
    <!-- Título principal -->
    <h1 class="text-2xl font-bold mb-4">Notas + Feedback IA</h1>

    <!-- Barra de acciones: Agregar estudiante y filtro por estado -->
    <div class="mb-4 flex gap-2">
      <button @click="addStudent" class="bg-black text-white px-4 py-2 rounded">+ Agregar</button>
      <select v-model="filter" class="border px-3 py-2 rounded">
        <option>Todos</option>
        <option>Aprobado</option>
        <option>Suspenso</option>
      </select>
    </div>

  <!-- Tabla de estudiantes -->
    <table class="w-full border">
      <!-- Encabezado de tabla con buen contraste -->
        <thead>
  <tr class="bg-blue-600 text-white">
    <th class="px-2 py-1">Nombre</th>
    <th class="px-2 py-1">Email</th>
    <th class="px-2 py-1">N1</th>
    <th class="px-2 py-1">N2</th>
    <th class="px-2 py-1">N3</th>
    <th class="px-2 py-1">Promedio</th>
    <th class="px-2 py-1">Estado</th>
    <th class="px-2 py-1">Acciones</th>
  </tr>
</thead>
      <tbody>
         <!-- Fila por cada estudiante filtrado -->
        <tr v-for="s in filtered" :key="s.id" class="border-t">
            <!-- Datos básicos -->
          <td>{{ s.name }}</td>
          <td>{{ s.email }}</td>
            <!-- Notas editables -->
          <td v-for="k in ['n1','n2','n3']" :key="k">
            <input type="number" min="0" max="20" step="0.5" v-model.number="s[k]" @input="updateScore(s)" class="border w-16 px-1" />
          </td>
           <!-- Promedio y estado -->
          <td>{{ s.average }}</td>
          <td>
            <span v-if="s.status === 'Aprobado'" class="text-green-600">✔</span>
            <span v-else class="text-red-600">✘</span>
            {{ s.status }}
          </td>
          <!-- Botones de acciones -->
          <td>
            <!-- Botón para generar feedback con IA -->
            <button @click="getFeedback(s)" :disabled="loadingId === s.id" class="border px-2 py-1 rounded">
              <span v-if="loadingId === s.id" class="animate-spin">⏳</span>
              <span v-else>✨</span>
            </button>
            <!-- Botón para ver último feedback guardado -->
            <button @click="showModal(s.last_feedback_text || 'Sin feedback')" class="ml-2 border px-2 py-1 rounded">📄</button>
          </td>
        </tr>
        <!-- Mensaje si no hay resultados -->
        <tr v-if="filtered.length === 0">
          <td colspan="8" class="text-center p-4 text-gray-500">No hay estudiantes para mostrar.</td>
        </tr>
      </tbody>
    </table>
    <!-- Modal para mostrar detalle del feedback -->
    <div v-if="modal.open" class="fixed inset-0 bg-black/60 flex items-center justify-center">
      <div class="bg-white p-4 rounded max-w-md w-full text-gray-800">
        <div class="flex justify-between mb-2">
          <h3 class="font-bold">Detalle</h3>
          <button @click="modal.open = false">❌</button>
        </div>
        <pre class="whitespace-pre-wrap text-gray-900">{{ modal.content }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
// Funciones utilitarias
function computeAverage(n1, n2, n3) { return Math.round(((n1||0)+(n2||0)+(n3||0))/3 * 10) / 10 }
function computeStatus(avg) { return avg >= 11 ? 'Aprobado' : 'Suspenso' }

// Estado inicial de estudiantes
const students = reactive([
  { id: '1', name: 'Ana Pérez', email: 'ana@demo.com', n1: 9, n2: 12, n3: 14 },
  { id: '2', name: 'Luis Rojas', email: 'luis@demo.com', n1: 7, n2: 8, n3: 10 },
  { id: '3', name: 'María Díaz', email: 'maria@demo.com', n1: 15, n2: 14, n3: 16 }
].map(s => ({ ...s, average: computeAverage(s.n1,s.n2,s.n3), status: computeStatus(computeAverage(s.n1,s.n2,s.n3)) })))

// Filtros y estados
const filter = ref('Todos')
const loadingId = ref(null)
const modal = reactive({ open: false, content: null })

// Lista filtrada por estado
const filtered = computed(() => students.filter(s => filter.value === 'Todos' || s.status === filter.value))

// Actualizar promedio y estado cuando cambian las notas
function updateScore(s) {
  s.average = computeAverage(s.n1, s.n2, s.n3)
  s.status = computeStatus(s.average)
}

// Agregar estudiante vacío
function addStudent() {
  const id = Date.now().toString()
  students.unshift({ id, name: 'Nuevo', email: `nuevo${id}@demo.com`, n1: 0, n2: 0, n3: 0, average: 0, status: 'Suspenso' })
}

// Obtener feedback real desde Gemini
async function getFeedback(s) {
  loadingId.value = s.id;
  try {
    const r = await fetch("http://localhost:3001/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: s.name,
        average: s.average,
        status: s.status,
      }),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "Error en el servidor IA");

    s.last_feedback_text = data.feedback.map(b => `• ${b}`).join("\n");
    showModal(s.last_feedback_text);
  } catch (e) {
    console.error(e);
    showModal("No se pudo generar feedback en este momento. Inténtalo más tarde.");
  } finally {
    loadingId.value = null;
  }
}

// Mostrar modal con contenido
function showModal(content) {
  modal.content = content
  modal.open = true
}

/* async function mockAIFeedback(s) {
  await new Promise(r => setTimeout(r, 800))
  const avg = s.average
  if (avg < 10) return ["Haz 30 preguntas diarias y revisa errores", "Estudia 45 min de farmacología", "Simulacro de 50 preguntas"]
  if (avg < 13) return ["20 preguntas/día en áreas débiles", "Un simulacro semanal", "Practica técnica de descarte"]
  return ["20 preguntas/día y registra errores", "Simulacro quincenal", "Refuerza ciencias básicas"]
} */

</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg) }
  to { transform: rotate(360deg) }
}
</style>