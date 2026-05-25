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
        return { id: user.id, email: user.email, name: user.name || user.email }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = (user as { id: string }).id
      return token
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        ;(session.user as { id?: string }).id = String(token.uid)
      }
      return session
    },
  },
})
