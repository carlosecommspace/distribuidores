import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

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

  console.log(`✓ User ready: ${user.email} (id=${user.id})`)
  console.log(`  password: ${password}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
