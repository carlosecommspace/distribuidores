import axios from 'axios'
import { prisma } from './prisma'

const ML_BASE = 'https://api.mercadolibre.com'

export function buildMLAuthURL(state?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ML_CLIENT_ID || '',
    redirect_uri: process.env.ML_REDIRECT_URI || '',
  })
  if (state) params.set('state', state)
  return `https://auth.mercadolibre.com.ve/authorization?${params.toString()}`
}

export async function exchangeCodeForToken(code: string) {
  const { data } = await axios.post(`${ML_BASE}/oauth/token`, {
    grant_type: 'authorization_code',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    code,
    redirect_uri: process.env.ML_REDIRECT_URI,
  })
  return data as {
    access_token: string
    refresh_token: string
    expires_in: number
    user_id: number
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const { data } = await axios.post(`${ML_BASE}/oauth/token`, {
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    refresh_token: refreshToken,
  })
  return data as { access_token: string; refresh_token: string; expires_in: number }
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const conn = await prisma.mLConnection.findUnique({ where: { userId } })
  if (!conn) return null
  if (conn.tokenExpiry.getTime() > Date.now() + 60_000) return conn.accessToken
  try {
    const refreshed = await refreshAccessToken(conn.refreshToken)
    await prisma.mLConnection.update({
      where: { userId },
      data: {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        tokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    })
    return refreshed.access_token
  } catch {
    return null
  }
}

export async function updateMLItemPrice(token: string, mlItemId: string, priceUSD: number) {
  return axios.put(
    `${ML_BASE}/items/${mlItemId}`,
    { price: priceUSD, currency_id: 'USD' },
    { headers: { Authorization: `Bearer ${token}` } },
  )
}

export async function updateMLItemStock(token: string, mlItemId: string, quantity: number) {
  return axios.put(
    `${ML_BASE}/items/${mlItemId}`,
    { available_quantity: quantity },
    { headers: { Authorization: `Bearer ${token}` } },
  )
}

export async function publishMLItem(token: string, payload: {
  title: string
  categoryId: string
  priceUSD: number
  stock: number
  listingType: string
  description?: string
  pictures?: string[]
}): Promise<string> {
  const { data } = await axios.post(
    `${ML_BASE}/items`,
    {
      title: payload.title,
      category_id: payload.categoryId,
      price: payload.priceUSD,
      currency_id: 'USD',
      available_quantity: payload.stock,
      buying_mode: 'buy_it_now',
      listing_type_id: payload.listingType,
      condition: 'new',
      description: { plain_text: payload.description || '' },
      pictures: payload.pictures?.map((url) => ({ source: url })) || [],
    },
    { headers: { Authorization: `Bearer ${token}` } },
  )
  return data.id as string
}

export async function fetchUnansweredQuestions(token: string, mlUserId: string) {
  const { data } = await axios.get(`${ML_BASE}/questions/search`, {
    params: { seller_id: mlUserId, status: 'UNANSWERED' },
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.questions as Array<{
    id: number
    text: string
    item_id: string
    from: { nickname?: string }
    date_created: string
  }>
}

export async function answerMLQuestion(token: string, questionId: string, text: string) {
  return axios.post(
    `${ML_BASE}/answers`,
    { question_id: questionId, text },
    { headers: { Authorization: `Bearer ${token}` } },
  )
}
