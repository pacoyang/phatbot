import { NextResponse, type NextRequest } from 'next/server'
import { kv } from '@vercel/kv'

import { requestDiscord } from '@/discord'
import { DC_ID_CONTRACT_KEY, DC_ID_MINTING_KEY } from '@/constants'
import { generateToken, mint } from '@/utils'

const respond = async (interaction_token: string, content: string) => {
  console.info(`/webhooks/${process.env.DISCORD_APP_ID}/${interaction_token}/messages/@original`)
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

const runStart = async ({ protocol, host, interaction_token, user_id, user_name }: any) => {
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

const runMint = async ({ interaction_token, user_id }: any) => {
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

export async function POST(request: NextRequest) {
  const { interaction_token, type, user_id, user_name } = await request.json()
  if (type === 'start') {
    const result = await kv.hget(DC_ID_CONTRACT_KEY, user_id)
    if (result) {
      const address = (result as string).split(':')[0]
      const contractId = (result as string).split(':')[1]
      await respond(interaction_token, `Your wallet address:\n${'`' + address + '`'}\nYour Phat contract id:\n${'`' + contractId + '`'}`)
      return NextResponse.json({})
    }
    const token = generateToken(16)
    await kv.set(token, `dc:${user_id}`, { ex: 3600, nx: true })
    await respond(interaction_token, `Welcome ${user_name}\n⚡ Click the link below to redirect to the webpage and create a wallet. ⚡\n${request.nextUrl.protocol}//${request.headers.get('host')}/bind/${token}`)
  } else if (type === 'mint') {
  }
  return NextResponse.json({})
}
