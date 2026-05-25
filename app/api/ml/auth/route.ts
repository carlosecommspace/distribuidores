import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buildMLAuthURL } from '@/lib/ml-api'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!process.env.ML_CLIENT_ID) {
    return NextResponse.json({ error: 'ML no configurado en el servidor' }, { status: 500 })
  }
  const url = buildMLAuthURL((session.user as { id: string }).id)
  return NextResponse.redirect(url)
}
