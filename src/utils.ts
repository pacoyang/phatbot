import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { options, OnChainRegistry, signCertificate, PinkContractPromise } from '@phala/sdk'
import fs from 'fs'
import path from 'path'

import { RPC_TESTNET_URL } from '@/constants'

export function generateToken(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    token += chars[randomIndex]
  }
  return token
}

export async function mint(contractId: string, phatbotProfile: string) {
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

