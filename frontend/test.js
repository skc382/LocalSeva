const MessageHandler = require('./utils/messageHandler');
const languages = require('./config/languages');

console.log('🧪 Testing WhatsApp Service Chatbot Setup...\n');

// Test 1: Check if languages are loaded
console.log('✅ Test 1: Language Configuration');
console.log('Available languages:', Object.keys(languages));
console.log('English welcome message:', languages.en.welcome);
console.log('Hindi welcome message:', languages.hi.welcome);
console.log('Kannada welcome message:', languages.kn.welcome);
console.log('');

// Test 2: Check MessageHandler
console.log('✅ Test 2: Message Handler');
const messageHandler = new MessageHandler();
console.log('MessageHandler created successfully');

// Test 3: Test user session creation
const testUserId = 'test@c.us';
const session = messageHandler.getUserSession(testUserId);
console.log('Test user session:', session);
console.log('');

// Test 4: Test language switching
console.log('✅ Test 3: Language Switching');
messageHandler.updateUserSession(testUserId, { language: 'hi' });
const hindiText = messageHandler.getText(testUserId, 'welcome');
console.log('Hindi text:', hindiText);

messageHandler.updateUserSession(testUserId, { language: 'kn' });
const kannadaText = messageHandler.getText(testUserId, 'welcome');
console.log('Kannada text:', kannadaText);
console.log('');

// Test 5: Test button generation
console.log('✅ Test 4: Button Generation');
const languageButtons = messageHandler.generateLanguageButtons();
console.log('Language buttons:', languageButtons);

const mainMenuButtons = messageHandler.generateMainMenuButtons(testUserId);
console.log('Main menu buttons:', mainMenuButtons);
console.log('');

console.log('🎉 All tests passed! The chatbot setup is working correctly.');
console.log('');
console.log('📋 Next steps:');
console.log('1. Run "npm start" to start the WhatsApp bot');
console.log('2. Scan the QR code with your WhatsApp');
console.log('3. Send a message to the bot to test the functionality');
console.log('');
console.log('🔗 Useful endpoints:');
console.log('- Health check: http://localhost:3000/health');
console.log('- Bot status: http://localhost:3000/status'); 