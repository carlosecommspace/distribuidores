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
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.password) return null
        const ok = await bcrypt.compare(password, user.password)
        if (!ok) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          role: user.role,
          clientId: user.clientId ?? undefined,
        } as { id: string; email: string; name: string; role: string; clientId?: string }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role?: string; clientId?: string }
        token.uid = u.id
        token.role = u.role || 'admin'
        token.clientId = u.clientId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const su = session.user as { id?: string; role?: string; clientId?: string }
        if (token.uid) su.id = String(token.uid)
        if (token.role) su.role = String(token.role)
        if (token.clientId) su.clientId = String(token.clientId)
      }
      return session
    },
  },
})
