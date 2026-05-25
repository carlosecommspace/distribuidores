const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.SEED_EMAIL || 'demo@distribos.app').toLowerCase().trim()
  const password = process.env.SEED_PASSWORD || 'demo1234'
  const name = process.env.SEED_NAME || 'Demo'

  const hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, name },
    create: { email, password: hash, name },
  })

  console.log(`[create-user] ready: ${user.email} (id=${user.id})`)
}

main()
  .catch((e) => {
    console.error('[create-user] failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
