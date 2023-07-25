import { NextResponse, type NextRequest } from 'next/server'
import { kv } from '@vercel/kv'
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { options, OnChainRegistry, signCertificate, PinkContractPromise } from '@phala/sdk'
import fs from 'fs'
import path from 'path'

import bot from '@/bot'
import { RPC_TESTNET_URL, TG_ID_CONTRACT_KEY, TG_ID_MINTING_KEY } from '@/constants'

export async function POST(request: NextRequest) {
  const { message } = await request.json()
  console.info(message)
  if (message && message.text === '/start') {
    const token = generateToken(16)
    const tg_id = message.from.id
    const result = await kv.hget(TG_ID_CONTRACT_KEY, tg_id)
    if (result) {
      const address = (result as string).split(':')[0]
      const contractId = (result as string).split(':')[1]
      await bot.sendMessage(
        tg_id as number,
        `Your wallet address:\n${'`' + address + '`'}\nYour Phat contract id:\n${'`' + contractId + '`'}`,
        {
          parse_mode : 'Markdown',
        },
      )
      return NextResponse.json({})
    }
    await kv.set(token, message.from.id, { ex: 3600, nx: true })
    await bot.sendMessage(message.chat.id, `Welcome ${message.from.first_name}\n⚡ Click the button below to redirect to the webpage and create a wallet. ⚡`, {
      parse_mode : 'Markdown',
      reply_markup : {
        inline_keyboard: [
          [
            {
              text: 'Create new wallet',
              url: `${request.nextUrl.protocol}//${request.headers.get('host')}/bind/${token}`
            }
          ]
        ]
      }
    })
  } else if (message && message.text === '/mint') {
    const tg_id = message.from.id
    const result = await kv.hget(TG_ID_CONTRACT_KEY, tg_id)
    if (!result) {
      await bot.sendMessage(tg_id as number, 'Please create wallet first')
      return NextResponse.json({})
    }
    const result2 = await kv.hget(TG_ID_MINTING_KEY, tg_id)
    if (result2) {
      await bot.sendMessage(tg_id as number, `minting...`)
      return NextResponse.json({})
    }
    await bot.sendMessage(tg_id as number, `minting...`)
    await kv.hset(TG_ID_MINTING_KEY, { [tg_id as number]: 1 })
    const data = await mint(process.env.CONTROLLER_CONTRACT_ID || '', (result as string).split(':')[1])
    await kv.hdel(TG_ID_MINTING_KEY, tg_id)
    if (data['err']) {
      await bot.sendMessage(tg_id as number, data['err'])
      return NextResponse.json({})
    }
    await bot.sendMessage(tg_id as number, `Successfully sent tx:\nhttps://mumbai.polygonscan.com/tx/${data['ok']}`)
  }
  return NextResponse.json({})
}

async function mint(contractId: string, phatbotProfile: string) {
  const api = await ApiPromise.create(options({
    provider: new WsProvider(RPC_TESTNET_URL),
    noInitWarn: true,
  }))
  const phatRegistry = await OnChainRegistry.create(api)
  const keyring = new Keyring({ type: 'sr25519' })
  const pair = keyring.addFromUri(process.env.POLKADOT_PRIMARY_KEY!)
  const abi = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/phatbot_controller.json'), 'utf-8')
  )
  const contractKey = await phatRegistry.getContractKeyOrFail(contractId)
  const contract = new PinkContractPromise(api, phatRegistry, abi, contractId, contractKey)
  const cert = await signCertificate({ pair, api });
  const { result, output } = await contract.query.mint(pair.address, { cert }, phatbotProfile, '100000')
  if (!result.isOk) {
    return { err: 'Server unreachable.' }
  }
  const data = output!.toJSON() as any
  return data['ok']
}

function generateToken(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    token += chars[randomIndex]
  }
  return token
}

