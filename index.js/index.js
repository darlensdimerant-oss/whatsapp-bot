const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const pino = require('pino')
const qrcode = require('qrcode-terminal')

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            console.log('SCANNE QR SA A :')
            qrcode.generate(qr, { small: true })
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Koneksyon fèmen, ap rekonekte...', shouldReconnect)
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log('✅ BOT KONEKTE SOU WHATSAPP!')
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const isGroup = from.endsWith('@g.us')
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ''
        if (!body.startsWith('.')) return

        const args = body.slice(1).trim().split(' ')
        const cmd = args[0].toLowerCase()
        const text = args.slice(1).join(' ')
        const sender = m.key.participant || m.key.remoteJid

        const reply = (txt) => sock.sendMessage(from, { text: txt }, { quoted: m })

        // MENU
        if (cmd === 'menu' || cmd === 'help') {
            return reply(`🤖 *MENU BOT - DARLENS BOT*\n\n` +
            `*.menu* - Wè meni sa a\n` +
            `*.view* - Wè foto pwofil moun\n` +
            `*.tagall* - Tag tout moun nan gwoup\n` +
            `*.kick* - Retire moun nan gwoup\n` +
            `*.promote* - Fè moun admin\n` +
            `*.demote* - Retire admin\n` +
            `*.info* - Info sou gwoup la\n` +
            `*.sticker* - Fè sticker\n\n` +
            `Bot pa Darlens 🔥`)
        }

        // VIEW - Wè foto pwofil
        if (cmd === 'view') {
            let target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || m.message.extendedTextMessage?.contextInfo?.participant || sender
            if (args[0] && args[0].includes('@')) target = args[0].replace('@','') + '@s.whatsapp.net'
            try {
                const pp = await sock.profilePictureUrl(target, 'image')
                return sock.sendMessage(from, { image: { url: pp }, caption: `📸 *Foto pwofil :* @${target.split('@')[0]}` , mentions: [target] }, { quoted: m })
            } catch { return reply('❌ Moun sa pa gen foto pwofil ou m pa ka wè l.') }
        }

        // TAGALL
        if (cmd === 'tagall') {
            if (!isGroup) return reply('❌ Kòmand sa sèlman nan gwoup!')
            const metadata = await sock.groupMetadata(from)
            const members = metadata.participants.map(p => p.id)
            let txt = `📢 *TAGALL - ${metadata.subject}*\n\n${text || 'Tout moun vini!'}\n\n`
            members.forEach((id, i) => txt += `${i+1}. @${id.split('@')[0]}\n`)
            return sock.sendMessage(from, { text: txt, mentions: members }, { quoted: m })
        }

        // KICK
        if (cmd === 'kick') {
            if (!isGroup) return reply('❌ Sèlman nan gwoup!')
            const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
            if (!target) return reply('❌ Tag moun ou vle retire a. Eg: .kick @moun')
            await sock.groupParticipantsUpdate(from, [target], 'remove')
            return reply(`✅ @${target.split('@')[0]} retire nan gwoup la.`)
        }

        // PROMOTE / DEMOTE
        if (cmd === 'promote' || cmd === 'demote') {
            if (!isGroup) return reply('❌ Sèlman nan gwoup!')
            const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
            if (!target) return reply('❌ Tag moun nan. Eg: .promote @moun')
            await sock.groupParticipantsUpdate(from, [target], cmd === 'promote' ? 'promote' : 'demote')
            return reply(cmd === 'promote' ? `✅ @${target.split('@')[0]} vin Admin! 👑` : `❌ @${target.split('@')[0]} pa Admin ankò.`)
        }

        // INFO GROUP
        if (cmd === 'info') {
            if (!isGroup) return reply('❌ Sèlman nan gwoup!')
            const metadata = await sock.groupMetadata(from)
            return reply(`📋 *INFO GWOUP*\n\nNon: ${metadata.subject}\nMoun: ${metadata.participants.length}\nKreye: ${new Date(metadata.creation * 1000).toLocaleDateString()}\n\nDeskripsyon: ${metadata.desc || 'Pa gen deskripsyon'}`)
        }

        // STICKER
        if (cmd === 'sticker' || cmd === 's') {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage
            if (!quoted?.imageMessage) return reply('❌ Reponn sou yon foto ak .sticker')
            return reply('⏳ Ap fè sticker la... (vèsyon sa ap vini nan Render)')
        }
    })
}
startBot()
