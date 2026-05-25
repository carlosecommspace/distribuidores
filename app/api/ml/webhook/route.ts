import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  // ML expects a 200 OK ASAP. Acknowledge first, then process async.
  let body: { topic?: string; resource?: string; user_id?: number } = {}
  try {
    body = await req.json()
  } catch {}

  ;(async () => {
    try {
      if (!body.topic || !body.user_id) return
      const conn = await prisma.mLConnection.findFirst({ where: { mlUserId: String(body.user_id) } })
      if (!conn) return

      if (body.topic === 'questions' && body.resource) {
        // resource example: /questions/12345
        const id = body.resource.split('/').pop()
        if (!id) return
        const exists = await prisma.mLQuestion.findUnique({ where: { mlQuestionId: id } })
        if (!exists) {
          // Best-effort placeholder; full hydration in /api/ml/questions POST
          await prisma.mLQuestion.create({
            data: {
              mlQuestionId: id,
              connectionId: conn.id,
              mlItemId: 'pending',
              questionText: 'Pregunta entrante — actualice la lista',
              status: 'unanswered',
            },
          }).catch(() => {})
        }
      }
    } catch {}
  })()

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
