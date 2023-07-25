import { NextResponse, type NextRequest } from 'next/server'
import { kv } from '@vercel/kv'

import bot from '@/bot'
import { TG_ID_CONTRACT_KEY } from '@/constants'

export async function POST(request: NextRequest) {
  const text = await request.text()
  const data = await kv.hgetall(TG_ID_CONTRACT_KEY)
  if (data && text) {
    await Promise.all(Object.keys(data).map((tg_id: any) => bot.sendMessage(tg_id, text)))
  }
  return NextResponse.json({})
}
