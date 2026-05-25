import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PRODUCTS = [
  { sku: 'ACE-001', name: 'Aceite Mobil 1 5W-30 Synthetic 1L', category: 'Lubricantes', brand: 'Mobil', unit: 'unidad', cost: 8.5, price: 12.5, stock: 24, min: 6 },
  { sku: 'ACE-002', name: 'Aceite Castrol GTX 20W-50 4L', category: 'Lubricantes', brand: 'Castrol', unit: 'unidad', cost: 14, price: 19.9, stock: 12, min: 4 },
  { sku: 'FIL-101', name: 'Filtro de aceite Mann W712/52', category: 'Filtros', brand: 'Mann', unit: 'unidad', cost: 4.2, price: 7.5, stock: 60, min: 15 },
  { sku: 'FIL-102', name: 'Filtro de aire Toyota Corolla 2014-2018', category: 'Filtros', brand: 'OEM', unit: 'unidad', cost: 6, price: 11, stock: 18, min: 8 },
  { sku: 'BAT-201', name: 'Batería Duncan 22NF 700A', category: 'Baterías', brand: 'Duncan', unit: 'unidad', cost: 75, price: 110, stock: 8, min: 3 },
  { sku: 'BAT-202', name: 'Batería Titan 27R 950A', category: 'Baterías', brand: 'Titan', unit: 'unidad', cost: 105, price: 150, stock: 2, min: 3 },
  { sku: 'BUJ-301', name: 'Bujía NGK BKR5E-11 (x4)', category: 'Encendido', brand: 'NGK', unit: 'pack', cost: 7, price: 12, stock: 40, min: 10 },
  { sku: 'LIM-401', name: 'Detergente líquido Ariel 5L', category: 'Limpieza', brand: 'Ariel', unit: 'unidad', cost: 9, price: 14.5, stock: 30, min: 10 },
  { sku: 'LIM-402', name: 'Cloro Las Llaves galón', category: 'Limpieza', brand: 'Las Llaves', unit: 'galón', cost: 2.5, price: 4.5, stock: 80, min: 20 },
  { sku: 'LIM-403', name: 'Lavaplatos Axion 750g', category: 'Limpieza', brand: 'Axion', unit: 'unidad', cost: 1.8, price: 3.2, stock: 120, min: 30 },
  { sku: 'ALI-501', name: 'Arroz Mary 1kg (fardo 24)', category: 'Alimentos', brand: 'Mary', unit: 'caja', cost: 28, price: 42, stock: 15, min: 5 },
  { sku: 'ALI-502', name: 'Aceite vegetal Vatel 1L (caja 12)', category: 'Alimentos', brand: 'Vatel', unit: 'caja', cost: 30, price: 48, stock: 10, min: 4 },
  { sku: 'ALI-503', name: 'Harina PAN 1kg (fardo 20)', category: 'Alimentos', brand: 'PAN', unit: 'caja', cost: 22, price: 34, stock: 18, min: 6 },
  { sku: 'ALI-504', name: 'Azúcar refinada Santa Bárbara 1kg (saco 50kg)', category: 'Alimentos', brand: 'Santa Bárbara', unit: 'saco', cost: 38, price: 55, stock: 5, min: 2 },
  { sku: 'FER-601', name: 'Cemento Cemex gris 42.5kg', category: 'Ferretería', brand: 'Cemex', unit: 'saco', cost: 10, price: 15, stock: 4, min: 5 },
  { sku: 'FER-602', name: 'Tornillo autorroscante 6x1" caja 100', category: 'Ferretería', brand: 'Genérico', unit: 'caja', cost: 5, price: 9.5, stock: 22, min: 8 },
  { sku: 'FER-603', name: 'Pintura Montana blanco mate galón', category: 'Ferretería', brand: 'Montana', unit: 'galón', cost: 14, price: 22, stock: 14, min: 4 },
  { sku: 'PAP-701', name: 'Papel higiénico Rosal x12', category: 'Cuidado personal', brand: 'Rosal', unit: 'pack', cost: 4, price: 6.5, stock: 50, min: 15 },
  { sku: 'PAP-702', name: 'Toallas femeninas Always pack', category: 'Cuidado personal', brand: 'Always', unit: 'pack', cost: 2.2, price: 3.8, stock: 70, min: 20 },
  { sku: 'PAP-703', name: 'Pañales Pampers M (paquete 40)', category: 'Cuidado personal', brand: 'Pampers', unit: 'paquete', cost: 9, price: 14, stock: 0, min: 6 },
]

const CLIENTS = [
  { name: 'Bodega La Esquina', company: 'La Esquina C.A.', phone: '+584141234567', city: 'Maracaibo', type: 'wholesale' },
  { name: 'Carlos Rodríguez', phone: '+584246712345', city: 'Maracaibo', type: 'retail' },
  { name: 'María Pérez', phone: '+584122345678', city: 'Cabimas', type: 'retail' },
  { name: 'Distribuidora El Sol', company: 'El Sol Distribuciones', phone: '+584268765432', city: 'Punto Fijo', type: 'distributor' },
  { name: 'Auto Repuestos Zulia', company: 'ARZ C.A.', phone: '+584145556677', city: 'Maracaibo', type: 'wholesale' },
  { name: 'Pedro Marín', phone: '+584161112233', city: 'Maracaibo', type: 'retail' },
  { name: 'Supermercado Don Pancho', company: 'Don Pancho C.A.', phone: '+584249988776', city: 'Cabimas', type: 'wholesale' },
  { name: 'Ana Gutiérrez', phone: '+584144567890', city: 'Maracaibo', type: 'retail' },
  { name: 'Taller Mecánico La 5ta', company: 'La 5ta Taller', phone: '+584125678901', city: 'Maracaibo', type: 'wholesale' },
  { name: 'Ferretería El Maestro', company: 'El Maestro C.A.', phone: '+584263344556', city: 'Punto Fijo', type: 'distributor' },
]

async function main() {
  const password = await bcrypt.hash('demo1234', 10)
  const user = await prisma.user.upsert({
    where: { email: 'demo@distribos.app' },
    update: {},
    create: {
      email: 'demo@distribos.app',
      password,
      name: 'Carlos Sánchez',
      company: 'Distribuidora Ejemplo C.A.',
      phone: '+584124441122',
      slug: 'demo',
    },
  })

  const rate = 38.5
  await prisma.settings.upsert({
    where: { userId: user.id },
    update: { exchangeRate: rate },
    create: {
      userId: user.id,
      exchangeRate: rate,
      autoUpdateRate: true,
      waPhoneNumber: '+584124441122',
      mlAutoSync: true,
      mlSyncInterval: 60,
    },
  })

  // Productos
  await prisma.product.deleteMany({ where: { userId: user.id } })
  for (const p of PRODUCTS) {
    await prisma.product.create({
      data: {
        userId: user.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        brand: p.brand,
        unit: p.unit,
        costUSD: p.cost,
        priceUSD: p.price,
        priceBs: p.price * rate,
        marginPercent: ((p.price - p.cost) / p.cost) * 100,
        stock: p.stock,
        stockMin: p.min,
        images: [],
      },
    })
  }

  // Clientes
  await prisma.client.deleteMany({ where: { userId: user.id } })
  const clientRecords: { id: string }[] = []
  for (const c of CLIENTS) {
    const cr = await prisma.client.create({
      data: {
        userId: user.id,
        name: c.name,
        company: c.company,
        phone: c.phone,
        city: c.city,
        type: c.type,
      },
    })
    clientRecords.push({ id: cr.id })
  }

  // Ventas — últimos 30 días
  await prisma.sale.deleteMany({ where: { userId: user.id } })
  const allProducts = await prisma.product.findMany({ where: { userId: user.id } })
  const channels = ['direct', 'whatsapp', 'mercadolibre', 'phone', 'whatsapp']
  const payments = ['cash_usd', 'zelle', 'binance', 'cash_bs', 'transfer_usd', 'cash_usd']

  const now = Date.now()
  for (let i = 0; i < 35; i++) {
    const date = new Date(now - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 12) * 3600 * 1000)
    const useClient = Math.random() > 0.25
    const clientId = useClient ? clientRecords[Math.floor(Math.random() * clientRecords.length)].id : null
    const itemCount = 1 + Math.floor(Math.random() * 3)
    const items: { productId: string; quantity: number; priceUSD: number; subtotalUSD: number }[] = []
    const used = new Set<string>()
    for (let j = 0; j < itemCount; j++) {
      const p = allProducts[Math.floor(Math.random() * allProducts.length)]
      if (used.has(p.id)) continue
      used.add(p.id)
      const qty = 1 + Math.floor(Math.random() * 3)
      items.push({ productId: p.id, quantity: qty, priceUSD: p.priceUSD, subtotalUSD: qty * p.priceUSD })
    }
    const subtotal = items.reduce((s, x) => s + x.subtotalUSD, 0)
    await prisma.sale.create({
      data: {
        userId: user.id,
        clientId,
        channel: channels[Math.floor(Math.random() * channels.length)],
        paymentMethod: payments[Math.floor(Math.random() * payments.length)],
        paymentStatus: 'paid',
        exchangeRate: rate,
        subtotalUSD: subtotal,
        totalUSD: subtotal,
        totalBs: subtotal * rate,
        createdAt: date,
        items: { create: items },
      },
    })
  }

  // Update client totals
  for (const c of clientRecords) {
    const agg = await prisma.sale.aggregate({
      where: { clientId: c.id, userId: user.id },
      _sum: { totalUSD: true },
      _max: { createdAt: true },
    })
    await prisma.client.update({
      where: { id: c.id },
      data: { totalPurchases: agg._sum.totalUSD || 0, lastPurchase: agg._max.createdAt },
    })
  }

  // Quick replies
  await prisma.quickReply.deleteMany({ where: { userId: user.id } })
  await prisma.quickReply.createMany({
    data: [
      { userId: user.id, trigger: 'precio', reply: 'Hola, gracias por escribir. El precio actual es $X. Aceptamos efectivo USD, Zelle, Binance y transferencia Bs.' },
      { userId: user.id, trigger: 'despacho', reply: 'Hacemos despacho a nivel nacional vía MRW o Zoom. El costo lo cubre el cliente.' },
      { userId: user.id, trigger: 'disponibilidad', reply: 'Sí, tenemos disponible. ¿Cuántas unidades necesitas?' },
    ],
  })

  console.log('Seed completado.')
  console.log('Login: demo@distribos.app / demo1234')
  console.log(`Catálogo público: /catalogo/demo`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
