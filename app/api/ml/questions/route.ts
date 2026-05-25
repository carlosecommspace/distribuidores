import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken, fetchUnansweredQuestions, answerMLQuestion } from '@/lib/ml-api'
import { generateMLAnswer } from '@/lib/claude'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'unanswered'

  const conn = await prisma.mLConnection.findUnique({ where: { userId } })
  if (!conn) return NextResponse.json([])

  const questions = await prisma.mLQuestion.findMany({
    where: {
      connectionId: conn.id,
      ...(status !== 'all' && { status }),
    },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(questions)
}

// Refresh from ML
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const conn = await prisma.mLConnection.findUnique({ where: { userId } })
  if (!conn) return NextResponse.json({ error: 'ML no conectado' }, { status: 400 })

  const token = await getValidAccessToken(userId)
  if (!token) return NextResponse.json({ error: 'token inválido' }, { status: 400 })

  try {
    const remote = await fetchUnansweredQuestions(token, conn.mlUserId)
    let added = 0
    for (const q of remote || []) {
      const exists = await prisma.mLQuestion.findUnique({ where: { mlQuestionId: String(q.id) } })
      if (exists) continue
      const product = await prisma.product.findFirst({ where: { userId, mlItemId: q.item_id } })
      await prisma.mLQuestion.create({
        data: {
          mlQuestionId: String(q.id),
          connectionId: conn.id,
          mlItemId: q.item_id,
          productId: product?.id,
          questionText: q.text,
          buyerNickname: q.from?.nickname,
          status: 'unanswered',
        },
      })
      added += 1
    }
    return NextResponse.json({ added })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

const ALLOWED = ['suggest', 'answer'] as const

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const { questionId, action, answerText } = await req.json()
  if (!ALLOWED.includes(action)) return NextResponse.json({ error: 'invalid action' }, { status: 400 })

  const conn = await prisma.mLConnection.findUnique({ where: { userId } })
  if (!conn) return NextResponse.json({ error: 'ML no conectado' }, { status: 400 })

  const question = await prisma.mLQuestion.findFirst({
    where: { id: questionId, connectionId: conn.id },
    include: { product: true },
  })
  if (!question) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (action === 'suggest') {
    if (!question.product) return NextResponse.json({ error: 'producto no vinculado' }, { status: 400 })
    const suggestion = await generateMLAnswer(question.questionText, {
      name: question.product.name,
      stock: question.product.stock,
      unit: question.product.unit,
      priceUSD: question.product.priceUSD,
      description: question.product.description,
    })
    await prisma.mLQuestion.update({ where: { id: question.id }, data: { aiSuggestion: suggestion } })
    return NextResponse.json({ suggestion })
  }

  if (action === 'answer') {
    if (!answerText || typeof answerText !== 'string') {
      return NextResponse.json({ error: 'answer requerido' }, { status: 400 })
    }
    const token = await getValidAccessToken(userId)
    if (token) {
      try {
        await answerMLQuestion(token, question.mlQuestionId, answerText)
      } catch {}
    }
    await prisma.mLQuestion.update({
      where: { id: question.id },
      data: {
        status: 'answered',
        answerText,
        answeredAt: new Date(),
        answeredBy: 'user',
      },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'noop' })
}
