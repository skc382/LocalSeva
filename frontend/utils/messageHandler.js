const languages = require('../config/languages');

class MessageHandler {
  constructor() {
    this.userSessions = new Map();
  }

  // Initialize or get user session
  getUserSession(userId) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        language: 'en',
        currentMenu: 'language',
        lastActivity: Date.now()
      });
    }
    return this.userSessions.get(userId);
  }

  // Update user session
  updateUserSession(userId, updates) {
    const session = this.getUserSession(userId);
    Object.assign(session, updates, { lastActivity: Date.now() });
    this.userSessions.set(userId, session);
  }

  // Get text in user's preferred language
  getText(userId, key, replacements = {}) {
    const session = this.getUserSession(userId);
    let text = languages[session.language][key] || languages.en[key] || key;
    
    // Replace placeholders
    Object.keys(replacements).forEach(placeholder => {
      text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    });
    
    return text;
  }

  // Generate language selection buttons
  generateLanguageButtons() {
    return [
      { id: 'lang_en', title: '🇺🇸 English' },
      { id: 'lang_hi', title: '🇮🇳 हिंदी' },
      { id: 'lang_kn', title: '🇮🇳 ಕನ್ನಡ' }
    ];
  }

  // Generate main menu buttons
  generateMainMenuButtons(userId) {
    return [
      { id: 'home_repair', title: this.getText(userId, 'homeRepair') },
      { id: 'beauty_services', title: this.getText(userId, 'beautyServices') },
      { id: 'change_language', title: this.getText(userId, 'selectLanguage') }
    ];
  }

  // Generate home repair service buttons
  generateHomeRepairButtons(userId) {
    return [
      { id: 'service_plumbing', title: this.getText(userId, 'plumbing') },
      { id: 'service_electrical', title: this.getText(userId, 'electrical') },
      { id: 'service_carpentry', title: this.getText(userId, 'carpentry') },
      { id: 'service_painting', title: this.getText(userId, 'painting') },
      { id: 'service_ac_repair', title: this.getText(userId, 'acRepair') },
      { id: 'back_to_main', title: this.getText(userId, 'backToMain') }
    ];
  }

  // Generate beauty service buttons
  generateBeautyServiceButtons(userId) {
    return [
      { id: 'service_haircut', title: this.getText(userId, 'haircut') },
      { id: 'service_facial', title: this.getText(userId, 'facial') },
      { id: 'service_massage', title: this.getText(userId, 'massage') },
      { id: 'service_manicure', title: this.getText(userId, 'manicure') },
      { id: 'service_makeup', title: this.getText(userId, 'makeup') },
      { id: 'back_to_main', title: this.getText(userId, 'backToMain') }
    ];
  }

  // Create interactive message with buttons
  createInteractiveMessage(text, buttons, footer = '') {
    return {
      text: text,
      footer: footer,
      buttons: buttons.map((button, index) => ({
        buttonId: button.id,
        buttonText: { displayText: button.title },
        type: 1
      }))
    };
  }

  // Handle incoming messages
  async handleMessage(message, client) {
    const userId = message.from;
    const messageBody = message.body.toLowerCase().trim();
    const session = this.getUserSession(userId);

    // Handle button responses
    if (message.type === 'buttons_response') {
      return await this.handleButtonResponse(message.selectedButtonId, userId, client);
    }

    // Handle text messages
    switch (session.currentMenu) {
      case 'language':
        return await this.showLanguageSelection(userId, client);
      
      case 'main':
        return await this.showMainMenu(userId, client);
      
      default:
        return await this.showLanguageSelection(userId, client);
    }
  }

  // Handle button responses
  async handleButtonResponse(buttonId, userId, client) {
    const session = this.getUserSession(userId);

    // Language selection
    if (buttonId.startsWith('lang_')) {
      const language = buttonId.replace('lang_', '');
      this.updateUserSession(userId, { language, currentMenu: 'main' });
      return await this.showMainMenu(userId, client);
    }

    // Main menu actions
    switch (buttonId) {
      case 'home_repair':
        this.updateUserSession(userId, { currentMenu: 'home_repair' });
        return await this.showHomeRepairMenu(userId, client);
      
      case 'beauty_services':
        this.updateUserSession(userId, { currentMenu: 'beauty_services' });
        return await this.showBeautyServicesMenu(userId, client);
      
      case 'change_language':
        this.updateUserSession(userId, { currentMenu: 'language' });
        return await this.showLanguageSelection(userId, client);
      
      case 'back_to_main':
        this.updateUserSession(userId, { currentMenu: 'main' });
        return await this.showMainMenu(userId, client);
    }

    // Service selection
    if (buttonId.startsWith('service_')) {
      const serviceName = buttonId.replace('service_', '').replace(/_/g, ' ');
      return await this.showServiceDetails(userId, serviceName, client);
    }

    return await this.showMainMenu(userId, client);
  }

  // Show language selection
  async showLanguageSelection(userId, client) {
    const buttons = this.generateLanguageButtons();
    const message = this.createInteractiveMessage(
      "🙏 Welcome! Please select your preferred language:\n\nस्वागत है! कृपया अपनी भाषा चुनें:\n\nಸ್ವಾಗತ! ದಯವಿಟ್ಟು ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ:",
      buttons
    );
    
    return await client.sendMessage(userId, message);
  }

  // Show main menu
  async showMainMenu(userId, client) {
    const buttons = this.generateMainMenuButtons(userId);
    const text = this.getText(userId, 'mainMenu');
    const message = this.createInteractiveMessage(text, buttons);
    
    return await client.sendMessage(userId, message);
  }

  // Show home repair menu
  async showHomeRepairMenu(userId, client) {
    const buttons = this.generateHomeRepairButtons(userId);
    const text = this.getText(userId, 'homeRepairMenu');
    const message = this.createInteractiveMessage(text, buttons);
    
    return await client.sendMessage(userId, message);
  }

  // Show beauty services menu
  async showBeautyServicesMenu(userId, client) {
    const buttons = this.generateBeautyServiceButtons(userId);
    const text = this.getText(userId, 'beautyMenu');
    const message = this.createInteractiveMessage(text, buttons);
    
    return await client.sendMessage(userId, message);
  }

  // Show service details
  async showServiceDetails(userId, serviceName, client) {
    const session = this.getUserSession(userId);
    const serviceKey = serviceName.replace(/ /g, '');
    const serviceDisplayName = this.getText(userId, serviceKey) || serviceName;
    
    const text = this.getText(userId, 'serviceSelected', { service: serviceDisplayName });
    
    // Create back button
    const buttons = [
      { id: 'back_to_main', title: this.getText(userId, 'backToMain') }
    ];
    
    const message = this.createInteractiveMessage(text, buttons);
    return await client.sendMessage(userId, message);
  }

  // Clean up old sessions (call periodically)
  cleanupOldSessions() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [userId, session] of this.userSessions.entries()) {
      if (now - session.lastActivity > maxAge) {
        this.userSessions.delete(userId);
      }
    }
  }
}

module.exports = MessageHandler; 