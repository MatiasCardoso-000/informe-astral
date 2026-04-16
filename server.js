import express from 'express'
import cors from 'cors'
import Groq from 'groq-sdk'
import rateLimit from 'express-rate-limit'
import 'dotenv/config'

const app = express()
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

app.use(cors())
app.use(express.json())
app.set('trust proxy', 1)

// Global: 60 req / 15 min por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intentá de nuevo en 15 minutos.' }
})

// Generación: 3 informes / hora por IP
const informeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Alcanzaste el límite de 3 informes por hora. Intentá más tarde.' },
})

app.use(globalLimiter)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.post('/api/carta-natal', informeLimiter, async (req, res) => {
  const { nombre, fecha, hora, lugar, foco, nivel } = req.body

  if (!nombre || !fecha || !lugar) {
    return res.status(400).json({ error: 'nombre, fecha y lugar son requeridos.' })
  }

  const focoMap = {
    completo:  'un informe completo: identidad, emociones, amor, misión y talentos',
    amor:      'el mundo amoroso: Venus, vínculos, Casa VII y patrones relacionales',
    mision:    'misión de vida, carrera, Medio Cielo y Nodo Norte',
    emocional: 'mundo emocional, Luna, necesidades internas y patrones de seguridad',
    talentos:  'talentos naturales, dones, recursos internos y potencial creativo',
  }

  const nivelMap = {
    accesible:  'lenguaje cálido y accesible, sin tecnicismos, con metáforas cotidianas',
    intermedio: 'lenguaje claro que combina lo emocional con referencias astrológicas básicas',
    tecnico:    'lenguaje técnico con posiciones planetarias estimadas, casas y aspectos clave',
  }

  const prompt = `Sos una astróloga profesional con 15 años de experiencia. Tu estilo es cálido, profundo, poético pero concreto. No hacés predicciones — interpretás energías y patrones psicológicos.

Datos de la clienta:
- Nombre: ${nombre}
- Fecha de nacimiento: ${fecha}
- Hora: ${hora || 'desconocida — usá mediodía como referencia'}
- Lugar: ${lugar}
- Enfoque: ${focoMap[foco] || focoMap.completo}
- Nivel de lenguaje: ${nivelMap[nivel] || nivelMap.accesible}

Generá un informe de carta natal COMPLETO Y PERSONALIZADO usando EXACTAMENTE esta estructura. Cada sección DEBE comenzar con su marcador entre corchetes en una línea sola:

[SOL]
Interpretá en profundidad el signo solar estimado según la fecha de nacimiento, la identidad esencial, el propósito vital y cómo se expresa esta persona en el mundo. Mínimo 4 párrafos.

[LUNA]
Interpretá el mundo emocional, necesidades internas, cómo se siente segura y sus patrones familiares. Mínimo 3 párrafos.

[ASCENDENTE]
Interpretá la energía con que se presenta al mundo. Si no tenés la hora, ofrecé 2-3 posibilidades. Mínimo 3 párrafos.

[AMOR]
Interpretá el lenguaje del amor, lo que busca en vínculos y cómo construye intimidad. Mínimo 3 párrafos.

[MISION]
Interpretá la misión de vida, vocación y llamado profesional. Mínimo 3 párrafos.

[TALENTOS]
Interpretá los dones naturales, talentos dormidos y potencial único. Mínimo 3 párrafos.

[MENSAJE]
Carta del alma en primera persona (el alma hablándole a ${nombre}). Poética y emocionalmente honesta. 2-3 párrafos.

[AFIRMACIONES]
Exactamente 5 afirmaciones personalizadas, una por línea, comenzando cada una con "✦ ".

IMPORTANTE: Cada marcador como [SOL], [LUNA], etc. debe estar en su propia línea, sin texto antes ni después en esa misma línea. Escribí con profundidad real para ${nombre} específicamente.`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.85,
      stream: false,
    })

    const texto = completion.choices[0]?.message?.content || ''
    res.json({ texto })

  } catch (err) {
    console.error('Groq error:', err)
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`✦ Servidor carta natal en http://localhost:${PORT}`))