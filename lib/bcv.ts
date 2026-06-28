import axios from 'axios'

export type Currency = 'USD' | 'EUR'

export interface BCVRate {
  rate: number
  date: string
  source: string
  currency: Currency
}

const ENDPOINTS: Record<Currency, string[]> = {
  USD: [
    'https://ve.dolarapi.com/v1/dolares/oficial',
  ],
  EUR: [
    'https://ve.dolarapi.com/v1/euros/oficial',
    'https://pydolarvenezuela-api.vercel.app/api/v1/euro/bcv',
  ],
}

async function tryEndpoint(url: string): Promise<{ rate: number; date: string } | null> {
  try {
    const { data } = await axios.get(url, { timeout: 8000 })
    const rate = Number(
      data?.promedio ?? data?.price ?? data?.monitors?.bcv?.price ?? 0,
    )
    if (!rate || rate <= 0) return null
    const date =
      data?.fechaActualizacion ??
      data?.last_update ??
      data?.monitors?.bcv?.last_update ??
      new Date().toISOString()
    return { rate, date }
  } catch {
    return null
  }
}

export async function fetchBCVRate(currency: Currency = 'USD'): Promise<BCVRate> {
  for (const url of ENDPOINTS[currency]) {
    const r = await tryEndpoint(url)
    if (r) return { rate: r.rate, date: r.date, source: 'bcv', currency }
  }
  return { rate: 0, date: new Date().toISOString(), source: 'unavailable', currency }
}
