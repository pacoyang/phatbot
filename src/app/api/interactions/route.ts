import { NextResponse, type NextRequest } from 'next/server'
import { kv } from '@vercel/kv'
import {
  InteractionType,
  InteractionResponseType,
} from 'discord-interactions'

export async function POST(request: NextRequest) {
  const json = await request.json()
  console.info(json)
  const { type, data, member, token } = json
  if (type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG })
  }
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data
    if (name === 'start') {
      // await Promise.race([
      //   fetch(
      //     `${request.nextUrl.protocol}//${request.headers.get('host')}/api/run`,
      //     {
      //       method: 'POST',
      //       headers: {
      //         'Content-Type': 'application/json',
      //       },
      //       body: JSON.stringify({
      //         interaction_token: token,
      //         type: 'start',
      //         user_id: member.user.id,
      //         user_name: member.user.global_name,
      //       })
      //     }
      //   ),
      //   new Promise((resolve) => setTimeout(resolve, 5000))
      // ])
      return NextResponse.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 1 << 6,
        }
      })
    } else if (name === 'mint') {
      fetch(
        `${request.nextUrl.protocol}//${request.headers.get('host')}/api/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            interaction_token: token,
            type: 'mint',
            user_id: member.user.id,
          })
        }
      )
      return NextResponse.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 1 << 6,
        }
      })
    }
  }
  return NextResponse.json({})
}
