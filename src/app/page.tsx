export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between py-12 px-24">
      <div className="z-10 w-full max-w-5xl font-mono text-sm gap-2 flex flex-col">
        <p>PhatBot</p>
        <p>tg: <a className="text-blue-500 underline" href="https://t.me/PacoPhatBot" target="_blank">t.me/PacoPhatBot</a></p>
        <p>dc: <a className="text-blue-500 underline" href="https://discord.com/api/oauth2/authorize?client_id=1133642080661545060&permissions=2048&scope=bot%20applications.commands" target="_blank">Add to your server</a></p>
      </div>
    </main>
  )
}
