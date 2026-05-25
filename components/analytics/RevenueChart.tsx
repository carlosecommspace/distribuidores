'use client'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

export function RevenueChart({ data }: { data: Array<{ date: string; usd: number }> }) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5A623" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#F5A623" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#242424" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#6B6560', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6B6560', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} width={48}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              background: '#1A1A1A',
              border: '1px solid #333',
              borderRadius: 10,
              fontFamily: 'DM Mono',
              color: '#F5F0E8',
            }}
            labelStyle={{ color: '#A8A29E', fontSize: 11 }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, 'Ingresos']}
          />
          <Area type="monotone" dataKey="usd" stroke="#F5A623" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
