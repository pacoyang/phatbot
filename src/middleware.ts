import { NextRequest, NextResponse } from 'next/server'
import { verifyKey } from 'discord-interactions'

export const config = {
  matcher: '/api/interactions',
}

export async function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  const signature = headers.get('X-Signature-Ed25519')
  const timestamp = headers.get('X-Signature-Timestamp')
  const text = await request.text()
  const isValidRequest = verifyKey(text, signature!, timestamp!, process.env.DISCORD_PUBLIC_KEY!)
  if (!isValidRequest) {
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Bad request signature' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    )
  }
}

