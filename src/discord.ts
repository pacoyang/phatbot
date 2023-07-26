import { fetch, ProxyAgent, setGlobalDispatcher } from 'undici'

if (process.env.PROXY_AGENT) {
  const proxyAgent = new ProxyAgent(process.env.PROXY_AGENT)
  setGlobalDispatcher(proxyAgent)
}

export async function requestDiscord(uri: string, options: any) {
  const url = `https://discord.com/api/v10${uri}`
  if (options.body) {
    options.body = JSON.stringify(options.body)
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...options
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(JSON.stringify(data))
  }
  return res
}
