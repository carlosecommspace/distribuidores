import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ProductContext {
  name: string
  stock: number
  unit: string
  priceUSD: number
  description?: string | null
}

export async function generateMLAnswer(question: string, product: ProductContext): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return ''
  }
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Eres el vendedor de una distribuidora venezolana profesional.

Producto: ${product.name}
Stock disponible: ${product.stock} ${product.unit}
Precio: $${product.priceUSD} USD
${product.description ? `Descripción: ${product.description}` : ''}

Pregunta del comprador en MercadoLibre: "${question}"

Responde de forma amigable, profesional y breve (máximo 3 oraciones).
Si preguntan por precio, incluye el precio en USD.
Si preguntan por disponibilidad, confirma el stock.
No inventes información que no tienes.`,
      },
    ],
  })
  const first = response.content[0]
  return first && first.type === 'text' ? first.text : ''
}
