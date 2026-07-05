import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const email = String(creds?.email || '').toLowerCase().trim()
        const password = String(creds?.password || '')
        if (!email || !password) return null
        const user = await prisma.user.findUnique({
          where: { email },
          include: { sellerProfile: { select: { id: true, ownerId: true, isActive: true } } },
        })
        if (!user || !user.password) return null
        const ok = await bcrypt.compare(password, user.password)
        if (!ok) return null

        // Gate global: usuarios suspendidos por el superadmin no logean
        if (!user.isActive) return null

        // Vendedor suspendido no puede loguear
        if (user.role === 'seller' && user.sellerProfile && !user.sellerProfile.isActive) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          role: user.role,
          clientId: user.clientId ?? undefined,
          sellerId: user.sellerProfile?.id ?? undefined,
          sellerOwnerId: user.sellerProfile?.ownerId ?? undefined,
        } as {
          id: string
          email: string
          name: string
          role: string
          clientId?: string
          sellerId?: string
          sellerOwnerId?: string
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string
          role?: string
          clientId?: string
          sellerId?: string
          sellerOwnerId?: string
        }
        token.uid = u.id
        token.role = u.role || 'admin'
        token.clientId = u.clientId
        token.sellerId = u.sellerId
        token.sellerOwnerId = u.sellerOwnerId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const su = session.user as {
          id?: string
          role?: string
          clientId?: string
          sellerId?: string
          sellerOwnerId?: string
        }
        if (token.uid) su.id = String(token.uid)
        if (token.role) su.role = String(token.role)
        if (token.clientId) su.clientId = String(token.clientId)
        if (token.sellerId) su.sellerId = String(token.sellerId)
        if (token.sellerOwnerId) su.sellerOwnerId = String(token.sellerOwnerId)
      }
      return session
    },
  },
})
