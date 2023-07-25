import TelegramBot from 'node-telegram-bot-api'

const bot = new TelegramBot(process.env.NEXT_TELEGRAM_TOKEN || '')

export default bot
