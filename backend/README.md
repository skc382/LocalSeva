# LocalSeva Backend - Firebase Functions

A comprehensive Node.js + Firebase backend for the LocalSeva service platform with vendor search, booking management, and WhatsApp integration.

## 🚀 Features

### Core Functionality
- **🔍 Vendor Search**: Location-based search with MapMyIndia API integration
- **📅 Booking Management**: Complete booking lifecycle with status tracking
- **🔐 Authentication**: Firebase Auth with WhatsApp phone number verification
- **📱 Real-time Notifications**: Push notifications for booking updates
- **📊 Analytics**: Comprehensive tracking and reporting
- **⚡ Auto-scaling**: Firebase Functions with automatic scaling

### Advanced Features
- **🌍 Geospatial Queries**: Efficient location-based vendor discovery
- **💰 Dynamic Pricing**: Service-type and duration-based pricing
- **⭐ Rating System**: Automatic vendor rating calculations
- **🔄 Status Management**: Booking lifecycle with validation
- **📈 Analytics Dashboard**: Search, booking, and rating analytics
- **🕐 Scheduled Tasks**: Automated cleanup and reminders

## 📋 Prerequisites

- Node.js 18+
- Firebase CLI
- Firebase project with Firestore and Authentication enabled
- MapMyIndia API key (optional, for accurate distance calculation)

## 🛠️ Installation

### 1. Clone and Setup
```bash
cd /Users/shreedharkc/Documents/GitHub/LocalSeva/backend
npm install
```

### 2. Firebase Setup
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase project (if not already done)
firebase init

# Set up environment variables
firebase functions:config:set mapmyindia.api_key="YOUR_MAPMYINDIA_API_KEY"
```

### 3. Deploy Functions
```bash
# Deploy all functions
firebase deploy

# Deploy specific function
firebase deploy --only functions:searchVendors
```

## 📁 Project Structure

```
backend/
├── functions/
│   ├── searchVendors.js          # Vendor search with geospatial queries
│   ├── createBooking.js          # Booking creation with validation
│   ├── updateVendorRating.js     # Auto-update vendor ratings
│   └── cleanupExpiredBookings.js # Scheduled maintenance tasks
├── middleware/
│   └── auth.js                   # Firebase Auth middleware
├── routes/
│   ├── vendors.js                # Vendor-related endpoints
│   ├── bookings.js               # Booking management endpoints
│   └── users.js                  # User profile and notifications
├── index.js                      # Main Express app and function exports
├── package.json                  # Dependencies and scripts
├── firebase.json                 # Firebase configuration
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Database indexes
└── README.md                     # This file
```

## 🔧 API Endpoints

### Authentication
All endpoints require Firebase Auth token in header:
```
Authorization: Bearer <firebase_id_token>
```

### Vendor Search
```http
POST /api/vendors/search
Content-Type: application/json

{
  "service_type": "plumbing",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "radius": 3,
  "limit": 5,
  "sort_by": "rating"
}
```

### Create Booking
```http
POST /api/bookings
Content-Type: application/json

{
  "vendor_id": "vendor123",
  "service_type": "plumbing",
  "scheduled_time": "2024-01-15T10:00:00.000Z",
  "user_location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "123 Main St, Bangalore"
  },
  "estimated_duration": 60,
  "description": "Kitchen sink repair"
}
```

### Get User Bookings
```http
GET /api/bookings?status=confirmed&limit=10
```

### Update Booking
```http
PATCH /api/bookings/{booking_id}
Content-Type: application/json

{
  "status": "completed",
  "rating": 5,
  "review": "Excellent service!"
}
```

## 🗄️ Database Schema

### Enhanced Firestore Collections

#### Users Collection
```javascript
{
  user_id: "firebase_uid",
  name: "John Doe",
  phone_number: "+919876543210",
  email: "john@example.com",
  language: "en", // en, hi, kn
  location: {
    latitude: 12.9716,
    longitude: 77.5946,
    address: "Bangalore, Karnataka"
  },
  preferences: {
    notifications: true,
    email_updates: false,
    preferred_services: ["plumbing", "electrical"]
  },
  bookings: ["booking1", "booking2"],
  created_at: timestamp,
  updated_at: timestamp,
  last_seen: timestamp,
  is_active: true
}
```

#### Vendors Collection
```javascript
{
  vendor_id: "vendor123",
  name: "ABC Plumbing Services",
  service_type: "plumbing",
  location: {
    latitude: 12.9716,
    longitude: 77.5946,
    address: "Bangalore, Karnataka"
  },
  geohash: "tdr1y4p2", // For efficient geospatial queries
  price: 500, // Base price
  ratings: 4.5,
  rating_count: 150,
  phone_number: "+919876543210",
  email: "abc@plumbing.com",
  description: "Professional plumbing services",
  profile_image: "https://...",
  verified: true,
  experience_years: 5,
  specializations: ["pipe_repair", "leak_fixing"],
  working_hours: {
    monday: { start: "09:00", end: "18:00" },
    // ... other days
  },
  availability: {},
  bookings: ["booking1", "booking2"],
  total_bookings: 150,
  response_time: "< 1 hour",
  is_active: true,
  created_at: timestamp,
  updated_at: timestamp
}
```

#### Bookings Collection
```javascript
{
  booking_id: "uuid",
  user_id: "firebase_uid",
  vendor_id: "vendor123",
  service_type: "plumbing",
  scheduled_time: timestamp,
  estimated_duration: 60, // minutes
  estimated_price: 500,
  final_price: 550,
  status: "pending", // pending, confirmed, in_progress, completed, cancelled
  description: "Kitchen sink repair",
  special_requirements: "Bring spare parts",
  user_location: {
    latitude: 12.9716,
    longitude: 77.5946,
    address: "123 Main St"
  },
  vendor_info: {
    name: "ABC Plumbing",
    phone_number: "+919876543210",
    service_type: "plumbing"
  },
  user_info: {
    name: "John Doe",
    phone_number: "+919876543210"
  },
  payment_status: "pending", // pending, paid, failed, refunded
  rating: 5,
  review: "Excellent service!",
  cancellation_reason: null,
  notifications_sent: {
    booking_created: true,
    booking_confirmed: false,
    booking_reminder: false,
    booking_completed: false
  },
  created_at: timestamp,
  updated_at: timestamp
}
```

## 🔒 Security Features

### Firebase Auth Integration
- Phone number verification required
- JWT token validation
- User session management
- Automatic user creation

### Firestore Security Rules
- User data isolation
- Booking access control
- Vendor data protection
- Analytics data security

### Input Validation
- Joi schema validation
- SQL injection prevention
- XSS protection
- Rate limiting ready

## 📊 Analytics & Monitoring

### Search Analytics
- Service type popularity
- Location-based demand
- Search result effectiveness
- User behavior patterns

### Booking Analytics
- Conversion rates
- Service completion rates
- Cancellation patterns
- Revenue tracking

### Rating Analytics
- Vendor performance trends
- Service quality metrics
- User satisfaction scores

## 🚀 Deployment

### Local Development
```bash
# Start Firebase emulators
npm run serve

# Test functions locally
firebase functions:shell
```

### Production Deployment
```bash
# Deploy all functions
firebase deploy

# Deploy with specific region
firebase deploy --only functions

# Monitor logs
firebase functions:log
```

### Environment Configuration
```bash
# Set MapMyIndia API key
firebase functions:config:set mapmyindia.api_key="YOUR_API_KEY"

# Set other environment variables
firebase functions:config:set app.environment="production"
```

## 🔧 Configuration

### MapMyIndia API Setup
1. Get API key from MapMyIndia
2. Set environment variable:
   ```bash
   firebase functions:config:set mapmyindia.api_key="YOUR_API_KEY"
   ```

### Firebase Project Setup
1. Enable Authentication with Phone provider
2. Enable Firestore with security rules
3. Set up indexes for efficient queries
4. Configure Cloud Functions region (asia-south1)

## 📈 Performance Optimizations

### Database Optimizations
- Composite indexes for complex queries
- Geohash-based location queries
- Efficient pagination with cursors
- Batch operations for bulk updates

### Function Optimizations
- Connection pooling for external APIs
- Caching for frequently accessed data
- Async operations for non-critical tasks
- Error handling and retry logic

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
# Test with Firebase emulators
firebase emulators:start
npm run test:integration
```

### Load Testing
```bash
# Test function performance
npm run test:load
```

## 🔍 Monitoring & Debugging

### Firebase Console
- Function execution logs
- Performance metrics
- Error tracking
- Usage analytics

### Custom Logging
```javascript
console.log('Info message');
console.warn('Warning message');
console.error('Error message');
```

### Health Checks
```http
GET /health
```

## 🚨 Error Handling

### Common Error Codes
- `UNAUTHENTICATED`: Missing or invalid auth token
- `VALIDATION_ERROR`: Invalid request parameters
- `NOT_FOUND`: Resource not found
- `ALREADY_EXISTS`: Duplicate resource
- `INTERNAL_ERROR`: Server error

### Error Response Format
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🔄 Integration with WhatsApp Frontend

### Authentication Flow
1. User authenticates via WhatsApp number
2. Frontend gets Firebase ID token
3. Backend validates token and creates/updates user
4. API calls include token in Authorization header

### Booking Flow
1. User searches vendors via WhatsApp
2. Frontend calls `/api/vendors/search`
3. User selects vendor and creates booking
4. Backend sends notifications to both parties
5. Status updates flow through the system

## 📝 API Documentation

### Postman Collection
Import the Postman collection for easy API testing:
```
[Postman Collection URL]
```

### OpenAPI Specification
Full API documentation available at:
```
[Swagger/OpenAPI URL]
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Firebase Console logs
3. Create GitHub issue with details
4. Contact development team

---

**LocalSeva Backend** - Connecting communities with local services through technology 🚀 