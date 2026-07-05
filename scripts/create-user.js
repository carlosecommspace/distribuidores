const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function ensureDemoUser() {
  const email = (process.env.SEED_EMAIL || 'demo@distribos.app').toLowerCase().trim()
  const password = process.env.SEED_PASSWORD || 'demo1234'
  const name = process.env.SEED_NAME || 'Demo'
  const hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, name },
    create: { email, password: hash, name },
  })
  console.log(`[create-user] demo ready: ${user.email} (id=${user.id})`)
}

async function ensureSuperadmin() {
  const email = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim()
  const password = process.env.SUPERADMIN_PASSWORD || ''
  const name = process.env.SUPERADMIN_NAME || 'System Admin'

  if (!email || !password) {
    console.log('[create-user] SUPERADMIN_EMAIL/PASSWORD no seteadas, salto el bootstrap del superadmin')
    return
  }

  // Verificar si ya existe un superadmin. Si si, no tocamos su password.
  const existingSuper = await prisma.user.findFirst({ where: { role: 'superadmin' } })
  if (existingSuper) {
    console.log(`[create-user] superadmin ya existe: ${existingSuper.email}`)
    return
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: 'superadmin', name, isActive: true },
    create: { email, password: hash, role: 'superadmin', name, isActive: true },
  })
  console.log(`[create-user] superadmin creado: ${user.email}`)
}

async function main() {
  await ensureDemoUser()
  await ensureSuperadmin()
}

main()
  .catch((e) => {
    console.error('[create-user] failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
