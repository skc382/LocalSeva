const languages = {
  en: {
    welcome: "🙏 Welcome! Please select your preferred language:",
    mainMenu: "🏠 Welcome to our Service Center!\nPlease select a service:",
    homeRepair: "🔧 Home Repair Services",
    beautyServices: "💄 Beauty Services",
    backToMain: "⬅️ Back to Main Menu",
    selectLanguage: "🌐 Change Language",
    
    // Home Repair Services
    homeRepairMenu: "🔧 Home Repair Services\nPlease select:",
    plumbing: "🚿 Plumbing",
    electrical: "⚡ Electrical",
    carpentry: "🪚 Carpentry",
    painting: "🎨 Painting",
    acRepair: "❄️ AC Repair",
    
    // Beauty Services
    beautyMenu: "💄 Beauty Services\nPlease select:",
    haircut: "✂️ Hair Cut & Styling",
    facial: "🧴 Facial Treatment",
    massage: "💆 Massage Therapy",
    manicure: "💅 Manicure & Pedicure",
    makeup: "💋 Makeup Services",
    
    // Service details
    serviceSelected: "✅ You selected: {service}\n\n📞 To book this service, please call: +91-9876543210\n⏰ Available: 9 AM - 8 PM\n💰 Starting from ₹500",
    invalidOption: "❌ Invalid option. Please select from the menu.",
    thankYou: "🙏 Thank you for choosing our services!"
  },
  
  hi: {
    welcome: "🙏 स्वागत है! कृपया अपनी पसंदीदा भाषा चुनें:",
    mainMenu: "🏠 हमारे सेवा केंद्र में आपका स्वागत है!\nकृपया एक सेवा चुनें:",
    homeRepair: "🔧 घर की मरम्मत सेवाएं",
    beautyServices: "💄 सौंदर्य सेवाएं",
    backToMain: "⬅️ मुख्य मेनू पर वापस",
    selectLanguage: "🌐 भाषा बदलें",
    
    // Home Repair Services
    homeRepairMenu: "🔧 घर की मरम्मत सेवाएं\nकृपया चुनें:",
    plumbing: "🚿 प्लंबिंग",
    electrical: "⚡ इलेक्ट्रिकल",
    carpentry: "🪚 बढ़ईगीरी",
    painting: "🎨 पेंटिंग",
    acRepair: "❄️ एसी मरम्मत",
    
    // Beauty Services
    beautyMenu: "💄 सौंदर्य सेवाएं\nकृपया चुनें:",
    haircut: "✂️ बाल कटाना और स्टाइलिंग",
    facial: "🧴 फेशियल ट्रीटमेंट",
    massage: "💆 मसाज थेरेपी",
    manicure: "💅 मैनीक्योर और पेडीक्योर",
    makeup: "💋 मेकअप सेवाएं",
    
    // Service details
    serviceSelected: "✅ आपने चुना: {service}\n\n📞 इस सेवा को बुक करने के लिए कॉल करें: +91-9876543210\n⏰ उपलब्ध: सुबह 9 बजे - रात 8 बजे\n💰 शुरुआत ₹500 से",
    invalidOption: "❌ गलत विकल्प। कृपया मेनू से चुनें।",
    thankYou: "🙏 हमारी सेवाओं को चुनने के लिए धन्यवाद!"
  },
  
  kn: {
    welcome: "🙏 ಸ್ವಾಗತ! ದಯವಿಟ್ಟು ನಿಮ್ಮ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ:",
    mainMenu: "🏠 ನಮ್ಮ ಸೇವಾ ಕೇಂದ್ರಕ್ಕೆ ಸ್ವಾಗತ!\nದಯವಿಟ್ಟು ಒಂದು ಸೇವೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ:",
    homeRepair: "🔧 ಮನೆ ದುರಸ್ತಿ ಸೇವೆಗಳು",
    beautyServices: "💄 ಸೌಂದರ್ಯ ಸೇವೆಗಳು",
    backToMain: "⬅️ ಮುಖ್ಯ ಮೆನುಗೆ ಹಿಂತಿರುಗಿ",
    selectLanguage: "🌐 ಭಾಷೆ ಬದಲಾಯಿಸಿ",
    
    // Home Repair Services
    homeRepairMenu: "🔧 ಮನೆ ದುರಸ್ತಿ ಸೇವೆಗಳು\nದಯವಿಟ್ಟು ಆಯ್ಕೆ ಮಾಡಿ:",
    plumbing: "🚿 ಪ್ಲಂಬಿಂಗ್",
    electrical: "⚡ ಎಲೆಕ್ಟ್ರಿಕಲ್",
    carpentry: "🪚 ಬಡಗಿ ಕೆಲಸ",
    painting: "🎨 ಪೇಂಟಿಂಗ್",
    acRepair: "❄️ ಎಸಿ ದುರಸ್ತಿ",
    
    // Beauty Services
    beautyMenu: "💄 ಸೌಂದರ್ಯ ಸೇವೆಗಳು\nದಯವಿಟ್ಟು ಆಯ್ಕೆ ಮಾಡಿ:",
    haircut: "✂️ ಕೂದಲು ಕತ್ತರಿಸುವುದು ಮತ್ತು ಸ್ಟೈಲಿಂಗ್",
    facial: "🧴 ಫೇಶಿಯಲ್ ಟ್ರೀಟ್ಮೆಂಟ್",
    massage: "💆 ಮಸಾಜ್ ಥೆರಪಿ",
    manicure: "💅 ಮ್ಯಾನಿಕ್ಯೂರ್ ಮತ್ತು ಪೆಡಿಕ್ಯೂರ್",
    makeup: "💋 ಮೇಕಪ್ ಸೇವೆಗಳು",
    
    // Service details
    serviceSelected: "✅ ನೀವು ಆಯ್ಕೆ ಮಾಡಿದ್ದು: {service}\n\n📞 ಈ ಸೇವೆಯನ್ನು ಬುಕ್ ಮಾಡಲು ಕರೆ ಮಾಡಿ: +91-9876543210\n⏰ ಲಭ್ಯವಿದೆ: ಬೆಳಿಗ್ಗೆ 9 ರಿಂದ ರಾತ್ರಿ 8 ರವರೆಗೆ\n💰 ₹500 ರಿಂದ ಪ್ರಾರಂಭ",
    invalidOption: "❌ ತಪ್ಪು ಆಯ್ಕೆ. ದಯವಿಟ್ಟು ಮೆನುವಿನಿಂದ ಆಯ್ಕೆ ಮಾಡಿ.",
    thankYou: "🙏 ನಮ್ಮ ಸೇವೆಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು!"
  }
};

module.exports = languages; 