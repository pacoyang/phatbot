import { NextResponse, type NextRequest } from 'next/server'

import bot from '@/bot'
import { requestDiscord } from '@/discord'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  if (type === 'tg') {
    await bot.setMyCommands([
      { command: 'start', description:'Set up your wallet' },
      { command: 'mint', description:'Send mint tx' }
    ])
  } else if (type === 'discord') {
    const commands = [
      {
        name: 'start',
        description: 'Set up your wallet',
        type: 1,
      },
      {
        name: 'mint',
        description: 'Send mint tx',
        type: 1,
      },
    ]
    await requestDiscord(`/applications/${process.env.DISCORD_APP_ID}/commands`, { method: 'PUT', body: commands })
  }
  return NextResponse.json({})
}

