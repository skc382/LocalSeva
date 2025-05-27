const MessageHandler = require('./utils/messageHandler');

console.log('🎭 WhatsApp Service Chatbot Demo\n');
console.log('This demo simulates a user conversation with the chatbot\n');

const messageHandler = new MessageHandler();
const demoUserId = 'demo@c.us';

// Simulate client object for demo
const mockClient = {
  sendMessage: async (userId, message) => {
    console.log(`📤 Bot sends to ${userId}:`);
    if (message.text) {
      console.log(`   ${message.text}`);
      if (message.buttons && message.buttons.length > 0) {
        console.log('   Buttons:');
        message.buttons.forEach((btn, index) => {
          console.log(`   ${index + 1}. ${btn.buttonText.displayText}`);
        });
      }
    } else {
      console.log(`   ${message}`);
    }
    console.log('');
  }
};

async function simulateConversation() {
  console.log('🚀 Starting conversation simulation...\n');
  
  // Step 1: User sends first message
  console.log('📥 User sends: "Hello"');
  const firstMessage = {
    from: demoUserId,
    body: 'Hello',
    type: 'chat'
  };
  await messageHandler.handleMessage(firstMessage, mockClient);
  
  // Step 2: User selects Hindi language
  console.log('📥 User clicks: हिंदी');
  await messageHandler.handleButtonResponse('lang_hi', demoUserId, mockClient);
  
  // Step 3: User selects Home Repair Services
  console.log('📥 User clicks: घर की मरम्मत सेवाएं');
  await messageHandler.handleButtonResponse('home_repair', demoUserId, mockClient);
  
  // Step 4: User selects Plumbing service
  console.log('📥 User clicks: प्लंबिंग');
  await messageHandler.handleButtonResponse('service_plumbing', demoUserId, mockClient);
  
  // Step 5: User goes back to main menu
  console.log('📥 User clicks: मुख्य मेनू पर वापस');
  await messageHandler.handleButtonResponse('back_to_main', demoUserId, mockClient);
  
  // Step 6: User switches to Beauty Services
  console.log('📥 User clicks: सौंदर्य सेवाएं');
  await messageHandler.handleButtonResponse('beauty_services', demoUserId, mockClient);
  
  // Step 7: User selects Facial service
  console.log('📥 User clicks: फेशियल ट्रीटमेंट');
  await messageHandler.handleButtonResponse('service_facial', demoUserId, mockClient);
  
  console.log('✅ Demo conversation completed!\n');
  
  // Show session state
  const finalSession = messageHandler.getUserSession(demoUserId);
  console.log('📊 Final user session state:');
  console.log(JSON.stringify(finalSession, null, 2));
  console.log('');
  
  console.log('🎯 Key Features Demonstrated:');
  console.log('✅ Multilingual support (English → Hindi)');
  console.log('✅ Interactive button navigation');
  console.log('✅ Service category selection');
  console.log('✅ Individual service selection');
  console.log('✅ Navigation between menus');
  console.log('✅ Session state management');
  console.log('✅ Contact information display');
  console.log('');
  
  console.log('🚀 To run the actual bot:');
  console.log('1. npm start');
  console.log('2. Scan QR code with WhatsApp');
  console.log('3. Send any message to start!');
}

// Run the demo
simulateConversation().catch(console.error); 