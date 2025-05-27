const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const MessageHandler = require('./utils/messageHandler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize WhatsApp client with local authentication
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "service-chatbot"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// Initialize message handler
const messageHandler = new MessageHandler();

// Express middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        whatsapp_ready: client.info ? true : false
    });
});

// Get bot status
app.get('/status', (req, res) => {
    res.json({
        ready: client.info ? true : false,
        info: client.info || null,
        active_sessions: messageHandler.userSessions.size
    });
});

// WhatsApp client event handlers
client.on('qr', (qr) => {
    console.log('🔗 QR Code received, scan with your phone:');
    qrcode.generate(qr, { small: true });
    console.log('\n📱 Open WhatsApp on your phone and scan the QR code above');
});

client.on('ready', () => {
    console.log('✅ WhatsApp Service Chatbot is ready!');
    console.log(`📞 Bot Number: ${client.info.wid.user}`);
    console.log('🚀 Server is running and ready to receive messages');
    
    // Clean up old sessions every hour
    setInterval(() => {
        messageHandler.cleanupOldSessions();
    }, 60 * 60 * 1000);
});

client.on('authenticated', () => {
    console.log('🔐 WhatsApp client authenticated successfully');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('📱 WhatsApp client disconnected:', reason);
});

// Handle incoming messages
client.on('message_create', async (message) => {
    // Only respond to messages sent to the bot (not sent by the bot)
    if (message.fromMe) return;
    
    // Only handle private messages (not group messages)
    if (message.from.includes('@g.us')) return;
    
    try {
        console.log(`📨 Message from ${message.from}: ${message.body}`);
        await messageHandler.handleMessage(message, client);
    } catch (error) {
        console.error('❌ Error handling message:', error);
        
        // Send error message to user
        try {
            await client.sendMessage(message.from, 
                '⚠️ Sorry, something went wrong. Please try again.\n\n' +
                'क्षमा करें, कुछ गलत हुआ। कृपया पुनः प्रयास करें।\n\n' +
                'ಕ್ಷಮಿಸಿ, ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'
            );
        } catch (sendError) {
            console.error('❌ Error sending error message:', sendError);
        }
    }
});

// Handle button responses
client.on('message', async (message) => {
    if (message.fromMe) return;
    if (message.from.includes('@g.us')) return;
    
    // Handle button responses
    if (message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();
        if (quotedMsg && quotedMsg.hasMedia) return;
    }
    
    // Check if it's a button response by looking for specific patterns
    const buttonPatterns = [
        /^(lang_|service_|home_repair|beauty_services|change_language|back_to_main)/i
    ];
    
    const isButtonResponse = buttonPatterns.some(pattern => pattern.test(message.body));
    
    if (isButtonResponse) {
        try {
            await messageHandler.handleButtonResponse(message.body, message.from, client);
        } catch (error) {
            console.error('❌ Error handling button response:', error);
        }
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Start the server
app.listen(PORT, () => {
    console.log(`🌐 Express server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Status endpoint: http://localhost:${PORT}/status`);
});

// Initialize WhatsApp client
console.log('🚀 Starting WhatsApp Service Chatbot...');
console.log('📱 Initializing WhatsApp client...');
client.initialize(); 