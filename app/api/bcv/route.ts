import { NextResponse } from 'next/server'
import { fetchBCVRate, type Currency } from '@/lib/bcv'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

function parseCurrency(value: string | null): Currency {
  return value === 'EUR' ? 'EUR' : 'USD'
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const currency = parseCurrency(searchParams.get('currency'))
  const data = await fetchBCVRate(currency)
  if (data.rate > 0) {
    await prisma.exchangeRateLog.create({
      data: { rate: data.rate, source: data.source, currency },
    })
  }
  return NextResponse.json(data)
}

/**
 * POST /api/bcv → deprecado. La tasa la gestiona el superadmin en
 * /superadmin/exchange-rate. Los merchants no pueden cambiarla desde su
 * panel. Este endpoint responde 403 para cualquier merchant. Se mantiene
 * en el path por retrocompat con clientes viejos.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'La tasa la gestiona el administrador de la plataforma.' },
    { status: 403 },
  )
}
