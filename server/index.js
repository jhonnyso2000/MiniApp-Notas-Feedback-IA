import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();

// CORS — ajusta a tu origen del Vite dev server
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// Rate limit (evita abuso y cobros sorpresa)
app.use("/api/", rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,             // 20 req/min
}));

// Validación del payload
const FeedbackSchema = z.object({
  name: z.string().min(1).max(80),
  average: z.number().min(0).max(20),
  status: z.enum(["Aprobado", "Suspenso"]),
});

// Inicializa Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ Falta GEMINI_API_KEY en .env");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
// Modelo rápido y económico; puedes cambiar a "gemini-1.5-pro" si necesitas más razonamiento
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Utilidad para intentar extraer arreglo desde el texto de salida
function extractBullets(text) {
  if (!text) return [];

  // 0) Limpiar etiquetas ``` y posibles lenguajes
  const cleaned = text
    .replace(/```[\s\S]*?```/g, match => match.replace(/```(json)?/gi, "").replace(/```$/, "").trim())
    .replace(/^```(json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  // 1) Intento parsear como JSON
  try {
    const maybe = JSON.parse(cleaned);
    if (Array.isArray(maybe)) return maybe.map(String).slice(0, 6);
  } catch {}

  // 2) Split por líneas, quitando viñetas o numeración
  const lines = cleaned
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*[-*•\d.)\]]\s*/, "").trim())
    .filter(Boolean);

  return lines.slice(0, 4);
}

app.post("/api/feedback", async (req, res) => {
  try {
    const parsed = FeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }

    const { name, average, status } = parsed.data;

    const prompt = `
Eres un tutor académico de medicina. Genera recomendaciones **concretas y accionables** en español,
personalizadas para el estudiante **${name}**, con promedio **${average}** (0–20) y estado **${status}**.
Considera que:
- Si el promedio < 11 (Suspenso), enfoca en recuperación con micro-hábitos diarios, técnicas de estudio y priorización de áreas débiles.
- Si 11 ≤ promedio < 14, refuerza práctica guiada, simulacros y revisión de errores.
- Si promedio ≥ 14, mantén ritmo, simulacros periódicos y consolidación.
Devuelve **exclusivamente** un arreglo JSON de cadenas (3 a 4 ítems), sin texto adicional.
Ejemplo de formato:
["20 preguntas/día en banco de cardio", "Revisa errores en un cuaderno", "Simulacro breve cada 3 días"]
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result?.response?.text?.() ?? "";
    const bullets = extractBullets(text);

    if (!bullets.length) {
  return res.json({
    feedback: [
      "Simulado: 20 preguntas/día en banco de cardio",
      "Simulado: Revisión de errores semanal",
      "Simulado: Simulacro cada 3 días"
    ]
  });
}

    return res.json({ feedback: bullets });
  } catch (err) {
    console.error("Gemini error:", err);
    return res.status(500).json({ error: "Error generando feedback" });
  }
});

// Salud
app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`✅ Servidor IA (Gemini) escuchando en http://localhost:${PORT}`);
});