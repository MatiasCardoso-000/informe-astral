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

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intentá de nuevo en 15 minutos.' }
})

const informeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Alcanzaste el límite de 3 informes por hora. Intentá más tarde.' }
})

app.use(globalLimiter)
app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.post('/api/carta-natal', informeLimiter, async (req, res) => {
  const { nombre, fecha, hora, lugar, foco, nivel } = req.body

  if (!nombre || !fecha || !lugar) {
    return res.status(400).json({ error: 'nombre, fecha y lugar son requeridos.' })
  }

  const nivelMap = {
    accesible:  'lenguaje cálido y accesible, sin tecnicismos, con metáforas cotidianas',
    intermedio: 'lenguaje claro que combina lo emocional con referencias astrológicas básicas',
    tecnico:    'lenguaje técnico con posiciones planetarias estimadas, casas y aspectos clave',
  }

  const estructuras = {
    completo: `
[SOL]
Interpretá en profundidad el signo solar estimado según la fecha, la identidad esencial, el propósito vital y cómo se expresa en el mundo. Mínimo 4 párrafos.

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
Carta del alma en primera persona. Poética y emocionalmente honesta. 2-3 párrafos.

[AFIRMACIONES]
Exactamente 5 afirmaciones personalizadas, una por línea, comenzando con "✦ ".`,

    amor: `
[SOL]
Breve síntesis del signo solar y cómo influye en su forma de amar. 2 párrafos.

[LUNA]
Interpretá en profundidad el mundo emocional, sus necesidades afectivas y cómo se siente amada. Mínimo 4 párrafos.

[AMOR]
Este es el corazón del informe. Interpretá en profundidad su lenguaje del amor, patrones relacionales, lo que busca en una pareja, cómo construye intimidad, sus miedos en el amor y su potencial de conexión. Mínimo 5 párrafos.

[MENSAJE]
Carta del alma enfocada en el amor y los vínculos. 2-3 párrafos potentes.

[AFIRMACIONES]
Exactamente 5 afirmaciones sobre el amor y los vínculos, una por línea, comenzando con "✦ ".`,

    mision: `
[SOL]
Interpretá el signo solar en relación con el propósito de vida y la identidad vocacional. Mínimo 3 párrafos.

[MISION]
Este es el corazón del informe. Interpretá en profundidad la misión de vida, el Nodo Norte kármico, la vocación, el llamado profesional y cómo superar los bloqueos para avanzar. Mínimo 5 párrafos.

[TALENTOS]
Interpretá los dones naturales aplicados a la carrera y misión. Mínimo 3 párrafos.

[MENSAJE]
Carta del alma enfocada en la misión y el llamado profesional. 2-3 párrafos.

[AFIRMACIONES]
Exactamente 5 afirmaciones sobre misión y carrera, una por línea, comenzando con "✦ ".`,

    emocional: `
[LUNA]
Este es el corazón del informe. Interpretá en profundidad el mundo emocional, necesidades internas, ritmos emocionales, patrones familiares heredados y cómo nutrirse. Mínimo 5 párrafos.

[ASCENDENTE]
Interpretá cómo el ascendente afecta su mundo emocional y su forma de reaccionar. Si no tenés la hora, ofrecé 2-3 posibilidades. Mínimo 3 párrafos.

[MENSAJE]
Carta del alma enfocada en el mundo emocional e interior. 2-3 párrafos.

[AFIRMACIONES]
Exactamente 5 afirmaciones sobre el mundo emocional, una por línea, comenzando con "✦ ".`,

    talentos: `
[SOL]
Interpretá el signo solar en relación con los dones y la expresión creativa. Mínimo 3 párrafos.

[TALENTOS]
Este es el corazón del informe. Interpretá en profundidad los dones naturales, talentos dormidos, habilidades únicas y el potencial sin explotar. Mínimo 5 párrafos.

[MISION]
Cómo sus talentos se conectan con su misión de vida. Mínimo 2 párrafos.

[MENSAJE]
Carta del alma enfocada en los dones y talentos únicos. 2-3 párrafos.

[AFIRMACIONES]
Exactamente 5 afirmaciones sobre talentos y potencial, una por línea, comenzando con "✦ ".`
  }

  const estructura = estructuras[foco] || estructuras.completo

  const prompt = `Sos una astróloga profesional con 15 años de experiencia. Tu estilo es cálido, profundo, poético pero concreto. No hacés predicciones — interpretás energías y patrones psicológicos.

Datos de la clienta:
- Nombre: ${nombre}
- Fecha de nacimiento: ${fecha}
- Hora: ${hora || 'desconocida — usá mediodía como referencia'}
- Lugar: ${lugar}
- Nivel de lenguaje: ${nivelMap[nivel] || nivelMap.accesible}

Generá el informe usando EXACTAMENTE esta estructura. Cada marcador debe estar en su propia línea sola:

${estructura}

IMPORTANTE: Escribí con profundidad real. Cada párrafo debe sentirse escrito para ${nombre} específicamente. Evitá frases genéricas.`

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