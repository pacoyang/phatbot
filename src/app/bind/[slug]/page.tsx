import { kv } from '@vercel/kv'
import { Section } from './_components'

export default async function Page({ params }: { params: { slug: string } }) {
  let tg_id = await kv.get(params.slug)
  if (!tg_id) {
    return (
      <main className="min-h-screenw-full max-w-3xl mx-auto py-16 px-8">
        The link has expired
      </main>
    )
  }
  tg_id = (tg_id as string).replace('dc:', '')
  return (
    <main className="min-h-screenw-full max-w-3xl mx-auto py-16 px-8">
      <Section tg_id={parseInt(tg_id as string, 10)} token={params.slug} />
    </main>
  )
}
