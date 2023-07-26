import { NextResponse, type NextRequest } from 'next/server'
import { kv } from '@vercel/kv'
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { options, OnChainRegistry, signCertificate, PinkContractPromise } from '@phala/sdk'
import fs from 'fs'
import path from 'path'

import { requestDiscord } from '@/discord'
import bot from '@/bot'
import { RPC_TESTNET_URL, TG_ID_CONTRACT_KEY, DC_ID_CONTRACT_KEY } from '@/constants'

const get_evm_address = async (contractId: string) => {
  const api = await ApiPromise.create(options({
    provider: new WsProvider(RPC_TESTNET_URL),
    noInitWarn: true,
  }))
  const phatRegistry = await OnChainRegistry.create(api)
  const keyring = new Keyring({ type: 'sr25519' })
  const pair = keyring.addFromUri(process.env.POLKADOT_PRIMARY_KEY!)
  const abi = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/phatbot_profile.json'), 'utf-8')
  )
  const contractKey = await phatRegistry.getContractKeyOrFail(contractId)
  const contract = new PinkContractPromise(api, phatRegistry, abi, contractId, contractKey)
  const cert = await signCertificate({ pair, api });
  const { result, output } = await contract.query.getEvmAccountAddress(pair.address, { cert })
  if (!result.isOk) {
    throw new Error('Server unreachable.')
  }
  const data = output!.toJSON() as any
  if (data['ok']['err']) {
    throw new Error(data['ok'])
  }
  return data['ok']['ok']
}

export async function POST(request: NextRequest) {
  const { token, contractId } = await request.json()
  const raw = await kv.get(token)
  if (!raw) {
    return NextResponse.json({ message: 'tg_id not found.' }, { status: 404 })
  }
  try {
    const address = await get_evm_address(contractId)
    await kv.del(token)
    if ((raw as string).startsWith('dc:')) {
      const dc_id = (raw as string).replace('dc:', '')
      await kv.hset(DC_ID_CONTRACT_KEY, { [dc_id]: `${address}:${contractId}` })
      const res = await requestDiscord(
        '/users/@me/channels',
        {
          method: 'POST',
          body: {
            recipient_id: dc_id
          }
        }
      )
      const channel: any = await res.json()
      await requestDiscord(
        `/channels/${channel.id}/messages`,
        {
          method: 'POST',
          body: {
            content: `Your wallet address:\n${'`' + address + '`'}\nYour Phat contract id:\n${'`' + contractId + '`'}`,
          }
        },
      )
    } else {
      const tg_id = raw as string
      await bot.sendMessage(
        tg_id,
        `Your wallet address:\n${'`' + address + '`'}\nYour Phat contract id:\n${'`' + contractId + '`'}`,
        {
          parse_mode : 'Markdown',
        },
      )
      await kv.hset(TG_ID_CONTRACT_KEY, { [tg_id]: `${address}:${contractId}` })
    }
    return NextResponse.json({
      address,
    })
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
