import { NextResponse, type NextRequest } from 'next/server'

import bot from '@/bot'

export async function GET(request: NextRequest) {
  await bot.setMyCommands([
    { command: 'start', description:'Set up your wallet' },
    { command: 'mint', description:'Send mint tx' }
  ])
  return NextResponse.json({})
}
