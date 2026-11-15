const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');

const PHONE_NUMBER = '18092508472';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS('Safari'),
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(PHONE_NUMBER);
                console.log('====================================');
                console.log('MEN KOD OU A POU WHATSAPP : ' + code);
                console.log('====================================');
                console.log('Ale nan WhatsApp > Appareils liés > Lier un appareil > Lier avec numéro de téléphone');
            } catch (e) {
                console.log('Erè kòd :', e);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksyon fèmen, ap rekonekte...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ BOT KONEKTE SOU WHATSAPP!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;
            if (text.toLowerCase() === 'bonjour' || text.toLowerCase() === 'hi' || text.toLowerCase() === '!menu') {
                await sock.sendMessage(from, { text: 'Bonjour! Mwen se bot ou a 🤖. Mwen konekte!' });
            }
        } catch (e) { console.log(e); }
    });
}

startBot();
