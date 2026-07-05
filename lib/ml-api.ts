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

// ----------------------------------------------------------------------------
// Categorias y atributos — helpers para publicacion masiva
// ----------------------------------------------------------------------------

/**
 * Usa el domain discovery de ML para predecir la categoria adecuada para un
 * producto a partir del titulo. Site = MLV (Venezuela).
 * Devuelve el mejor match o null si ML no sugiere nada.
 */
export async function predictMLCategory(
  token: string,
  title: string,
  site = 'MLV',
): Promise<{ categoryId: string; categoryName: string; predictionScore: number } | null> {
  try {
    const { data } = await axios.get(
      `${ML_BASE}/sites/${site}/domain_discovery/search`,
      {
        params: { q: title, limit: 1 },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    const first = Array.isArray(data) ? data[0] : null
    if (!first?.category_id) return null
    return {
      categoryId: first.category_id,
      categoryName: first.category_name || first.domain_name || '',
      predictionScore: typeof first.prediction_probability === 'number' ? first.prediction_probability : 0,
    }
  } catch {
    return null
  }
}

/**
 * Trae los atributos requeridos por una categoria (marca, modelo, tipo, etc).
 * Los usamos para armar el payload de publish y detectar si falta algo.
 */
export async function fetchMLCategoryAttributes(
  token: string,
  categoryId: string,
): Promise<Array<{ id: string; name: string; required: boolean; valueType: string; values: Array<{ id: string; name: string }> }>> {
  try {
    const { data } = await axios.get(`${ML_BASE}/categories/${categoryId}/attributes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!Array.isArray(data)) return []
    return data.map((a) => ({
      id: a.id,
      name: a.name,
      required: !!(a.tags?.required || a.tags?.catalog_required || a.value_type === 'list'
        && Array.isArray(a.tags) && a.tags.includes('required')),
      valueType: a.value_type,
      values: Array.isArray(a.values)
        ? a.values.slice(0, 20).map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }))
        : [],
    }))
  } catch {
    return []
  }
}

// ----------------------------------------------------------------------------
// Publish avanzado
// ----------------------------------------------------------------------------

interface PublishPayload {
  title: string
  categoryId: string
  priceUSD: number
  stock: number
  listingType: string
  description?: string
  pictures?: string[]
  attributes?: Array<{ id: string; value_name?: string; value_id?: string }>
}

interface PublishResult {
  ok: boolean
  mlItemId?: string
  status?: string
  permalink?: string
  error?: string
  errorCause?: unknown
}

export async function publishMLItemFull(token: string, payload: PublishPayload): Promise<PublishResult> {
  try {
    const { data } = await axios.post(
      `${ML_BASE}/items`,
      {
        title: payload.title.slice(0, 60), // ML max title = 60 chars
        category_id: payload.categoryId,
        price: payload.priceUSD,
        currency_id: 'USD',
        available_quantity: payload.stock,
        buying_mode: 'buy_it_now',
        listing_type_id: payload.listingType,
        condition: 'new',
        description: { plain_text: payload.description || '' },
        pictures: (payload.pictures || []).slice(0, 12).map((url) => ({ source: url })),
        attributes: payload.attributes,
      },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    return {
      ok: true,
      mlItemId: data.id as string,
      status: data.status as string,
      permalink: data.permalink as string,
    }
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const body = e.response?.data as { message?: string; cause?: unknown } | undefined
      return {
        ok: false,
        error: body?.message || e.message,
        errorCause: body?.cause,
      }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'error' }
  }
}

// ----------------------------------------------------------------------------
// Orders (webhook Fase 3)
// ----------------------------------------------------------------------------

export interface MLOrder {
  id: number
  status: string
  status_detail: string | null
  date_created: string
  total_amount: number
  currency_id: string
  paid_amount: number
  buyer: {
    id: number
    nickname?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: { area_code?: string; number?: string }
  }
  order_items: Array<{
    item: { id: string; title: string; seller_sku?: string; category_id?: string; variation_id?: number }
    quantity: number
    unit_price: number
    currency_id: string
  }>
  payments?: Array<{ id: number; status: string; payment_method_id?: string; payment_type?: string; transaction_amount: number }>
  shipping?: { id?: number }
}

export async function fetchMLOrder(token: string, orderId: string | number): Promise<MLOrder | null> {
  try {
    const { data } = await axios.get(`${ML_BASE}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return data as MLOrder
  } catch {
    return null
  }
}

export async function fetchMLQuestion(token: string, questionId: string | number) {
  try {
    const { data } = await axios.get(`${ML_BASE}/questions/${questionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return data as {
      id: number
      text: string
      status: string
      item_id: string
      date_created: string
      from: { id?: number; nickname?: string }
    }
  } catch {
    return null
  }
}
