import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server';
import { kv } from '@vercel/kv'
import {
  InteractionType,
  InteractionResponseType,
} from 'discord-interactions'

import { requestDiscord } from '@/discord'
import { DC_ID_CONTRACT_KEY, DC_ID_MINTING_KEY } from '@/constants'
import { generateToken, mint } from '@/utils'

export const config = {
  runtime: 'edge',
  unstable_allowDynamic: [
    '/node_modules/@phala/sdk/**',
  ],
}

export default async function handler(
  request: NextRequest,
  context: NextFetchEvent,
) {
  const json = await request.json()
  const { type, data, member, token } = json
  if (type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG })
  }
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data
    if (name === 'start') {
      context.waitUntil(runStart({
        protocol: request.nextUrl.protocol,
        host: request.headers.get('host')!,
        interaction_token: token,
        user_id: member.user.id,
        user_name: member.user.global_name,
      }))
      return NextResponse.json({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 1 << 6,
        }
      })
    } else if (name === 'mint') {
      context.waitUntil(runMint({
        interaction_token: token,
        user_id: member.user.id,
      }))
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


const respond = async (interaction_token: string, content: string) => {
  await requestDiscord(
    `/webhooks/${process.env.DISCORD_APP_ID}/${interaction_token}/messages/@original`,
    {
      method: 'PATCH',
      body: {
        content,
      }
    },
  )
}

const runStart = async ({
  protocol, host, interaction_token, user_id, user_name
}: {
  protocol: string, host: string, interaction_token: string,
  user_id: string, user_name: string
}) => {
  const result = await kv.hget(DC_ID_CONTRACT_KEY, user_id)
  if (result) {
    const address = (result as string).split(':')[0]
    const contractId = (result as string).split(':')[1]
    await respond(interaction_token, `Your wallet address:\n${'`' + address + '`'}\nYour Phat contract id:\n${'`' + contractId + '`'}`)
    return NextResponse.json({})
  }
  const token = generateToken(16)
  await kv.set(token, `dc:${user_id}`, { ex: 3600, nx: true })
  await respond(interaction_token, `Welcome ${user_name}\n⚡ Click the link below to redirect to the webpage and create a wallet. ⚡\n${protocol}//${host}/bind/${token}`)
}

const runMint = async ({
  interaction_token, user_id
}: {
  interaction_token: string, user_id: string
}) => {
  const result = await kv.hget(DC_ID_CONTRACT_KEY, user_id)
  if (!result) {
    await respond(interaction_token, 'Please create wallet first')
    return NextResponse.json({})
  }
  const result2 = await kv.hget(DC_ID_MINTING_KEY, user_id)
  if (result2) {
    await respond(interaction_token, 'minting...')
    return NextResponse.json({})
  }
  await kv.hset(DC_ID_MINTING_KEY, { [user_id]: 1 })
  const data = await mint(process.env.CONTROLLER_CONTRACT_ID || '', (result as string).split(':')[1])
  await kv.hdel(DC_ID_MINTING_KEY, user_id)
  if (data['err']) {
    await respond(interaction_token, data['err'])
    return NextResponse.json({})
  }
  await respond(interaction_token, `Successfully sent tx:\nhttps://mumbai.polygonscan.com/tx/${data['ok']}`)
}
