'use client'
import { useState } from 'react'

interface Props {
  slug: string
}

export function ContactForm({ slug }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !message.trim()) return
    setStatus('sending')
    setErrorMsg('')
    try {
      const r = await fetch(`/api/sites/${slug}/leads`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email: email || null, phone: phone || null, message }),
      })
      if (!r.ok) {
        setStatus('error')
        setErrorMsg('No pudimos enviar el mensaje. Intenta de nuevo.')
        return
      }
      setStatus('sent')
      setName(''); setEmail(''); setPhone(''); setMessage('')
    } catch {
      setStatus('error')
      setErrorMsg('Error de conexión. Intenta de nuevo.')
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'var(--ms-primary)' }}>✓</div>
        <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '1.1rem' }}>¡Recibimos tu mensaje!</div>
        <p style={{ opacity: 0.7, margin: '0 0 1.5rem', fontSize: '0.95rem' }}>Nos pondremos en contacto muy pronto.</p>
        <button type="button" onClick={() => setStatus('idle')} className="ms-btn ms-btn-outline">Enviar otro</button>
      </div>
    )
  }

  return (
    <form className="ms-form" onSubmit={submit}>
      <div>
        <label htmlFor="ms-name">Nombre *</label>
        <input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label htmlFor="ms-email">Correo</label>
          <input id="ms-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
        </div>
        <div>
          <label htmlFor="ms-phone">Teléfono</label>
          <input id="ms-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        </div>
      </div>
      <div>
        <label htmlFor="ms-message">Mensaje *</label>
        <textarea id="ms-message" value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={2000} />
      </div>
      {errorMsg && <div style={{ color: '#c00', fontSize: '0.9rem' }}>{errorMsg}</div>}
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </form>
  )
}
