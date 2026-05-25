import { NextResponse } from 'next/server'

export async function POST(_req: Request) {
  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('hub.challenge')
  if (challenge) return new Response(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}
