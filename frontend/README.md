# WhatsApp Service Chatbot

A multilingual WhatsApp chatbot for service selection with support for Home Repair Services and Beauty Services. The bot supports English, Hindi, and Kannada languages with interactive button menus.

## Features

- 🌐 **Multilingual Support**: English, Hindi (हिंदी), and Kannada (ಕನ್ನಡ)
- 🔧 **Home Repair Services**: Plumbing, Electrical, Carpentry, Painting, AC Repair
- 💄 **Beauty Services**: Hair Cut & Styling, Facial Treatment, Massage Therapy, Manicure & Pedicure, Makeup Services
- 📱 **Interactive Buttons**: Easy navigation with WhatsApp button menus
- 💾 **Session Management**: Remembers user preferences and current menu state
- 🔄 **Language Switching**: Users can change language anytime
- 📊 **Health Monitoring**: Built-in health check and status endpoints

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- WhatsApp account
- Chrome/Chromium browser (for puppeteer)

## Installation

1. **Clone or create the project directory:**
   ```bash
   mkdir whatsapp-service-chatbot
   cd whatsapp-service-chatbot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the bot:**
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## Setup Instructions

1. **Run the application:**
   ```bash
   npm start
   ```

2. **Scan QR Code:**
   - A QR code will appear in your terminal
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices > Link a Device
   - Scan the QR code displayed in the terminal

3. **Bot is Ready:**
   - Once authenticated, the bot will be ready to receive messages
   - Send any message to the bot number to start the conversation

## Usage

### User Flow

1. **Language Selection:**
   - Users are greeted with language options: English, Hindi, Kannada
   - Select preferred language using buttons

2. **Main Menu:**
   - Choose between Home Repair Services or Beauty Services
   - Option to change language anytime

3. **Service Categories:**
   - **Home Repair Services:**
     - 🚿 Plumbing
     - ⚡ Electrical
     - 🪚 Carpentry
     - 🎨 Painting
     - ❄️ AC Repair
   
   - **Beauty Services:**
     - ✂️ Hair Cut & Styling
     - 🧴 Facial Treatment
     - 💆 Massage Therapy
     - 💅 Manicure & Pedicure
     - 💋 Makeup Services

4. **Service Details:**
   - Contact information for booking
   - Pricing information
   - Available hours

### API Endpoints

- **Health Check:** `GET /health`
  ```json
  {
    "status": "OK",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "whatsapp_ready": true
  }
  ```

- **Bot Status:** `GET /status`
  ```json
  {
    "ready": true,
    "info": { ... },
    "active_sessions": 5
  }
  ```

## Project Structure

```
whatsapp-service-chatbot/
├── config/
│   └── languages.js          # Language translations
├── utils/
│   └── messageHandler.js     # Message handling logic
├── server.js                 # Main application file
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Configuration

### Adding New Languages

1. Edit `config/languages.js`
2. Add new language object with all required translations
3. Update language selection buttons in `utils/messageHandler.js`

### Adding New Services

1. Add service translations to `config/languages.js`
2. Update button generation methods in `utils/messageHandler.js`
3. Add new service handling logic

### Customizing Contact Information

Edit the `serviceSelected` text in `config/languages.js` to update:
- Phone number
- Available hours
- Pricing information

## Environment Variables

- `PORT`: Server port (default: 3000)

## Troubleshooting

### Common Issues

1. **QR Code not appearing:**
   - Ensure you have a stable internet connection
   - Check if Chrome/Chromium is installed
   - Try restarting the application

2. **Authentication failed:**
   - Delete the `.wwebjs_auth` folder
   - Restart the application and scan QR code again

3. **Bot not responding:**
   - Check the console for error messages
   - Verify the bot is authenticated and ready
   - Check the `/health` endpoint

### Logs

The application provides detailed console logs:
- 🔗 QR code generation
- ✅ Ready status
- 📨 Incoming messages
- ❌ Error messages

## Development

### Adding Features

1. **New Service Categories:**
   - Add translations to `config/languages.js`
   - Create new button generation methods
   - Add handling logic in `messageHandler.js`

2. **Enhanced User Experience:**
   - Add media support (images, documents)
   - Implement booking system integration
   - Add user feedback collection

### Testing

Test the bot by:
1. Sending messages to the bot number
2. Testing all button interactions
3. Switching between languages
4. Testing error scenarios

## Security Considerations

- The bot only responds to private messages (not group messages)
- Session data is stored in memory (consider database for production)
- Implement rate limiting for production use
- Secure API endpoints if exposing publicly

## Production Deployment

For production deployment:

1. **Use Process Manager:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name whatsapp-bot
   ```

2. **Environment Setup:**
   - Set appropriate environment variables
   - Configure reverse proxy (nginx)
   - Set up SSL certificates

3. **Monitoring:**
   - Use the `/health` and `/status` endpoints
   - Set up logging and monitoring
   - Configure alerts for downtime

## License

MIT License - feel free to use and modify as needed.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review console logs for error messages
3. Ensure all dependencies are properly installed 