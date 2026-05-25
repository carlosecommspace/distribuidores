import axios from 'axios'

export interface BCVRate {
  rate: number
  date: string
  source: string
}

export async function fetchBCVRate(): Promise<BCVRate> {
  try {
    const { data } = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial', {
      timeout: 8000,
    })
    return {
      rate: Number(data.promedio) || 0,
      date: data.fechaActualizacion || new Date().toISOString(),
      source: 'bcv',
    }
  } catch {
    return { rate: 0, date: new Date().toISOString(), source: 'unavailable' }
  }
}
