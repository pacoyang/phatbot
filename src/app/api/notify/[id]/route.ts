import { NextResponse, type NextRequest } from 'next/server'
import { kv } from '@vercel/kv'

import bot from '@/bot'
import { TG_ID_CONTRACT_KEY } from '@/constants'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const text = await request.text()
  await bot.sendMessage(params.id, text)
  return NextResponse.json({})
}
