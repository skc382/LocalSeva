const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

// Import route handlers
const vendorRoutes = require('./routes/vendors');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');
const authMiddleware = require('./middleware/auth');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'LocalSeva Backend API',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/vendors', authMiddleware, vendorRoutes);
app.use('/api/bookings', authMiddleware, bookingRoutes);
app.use('/api/users', authMiddleware, userRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(error.status || 500).json({
    error: {
      message: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString()
    }
  });
});

// Export the Express app as a Firebase Function
exports.api = functions.region('asia-south1').https.onRequest(app);

// Additional Firebase Functions for specific operations
exports.searchVendors = functions.region('asia-south1').https.onCall(require('./functions/searchVendors'));
exports.createBooking = functions.region('asia-south1').https.onCall(require('./functions/createBooking'));
exports.updateVendorRating = functions.region('asia-south1').firestore
  .document('bookings/{bookingId}')
  .onUpdate(require('./functions/updateVendorRating'));

// Scheduled functions
exports.cleanupExpiredBookings = functions.region('asia-south1').pubsub
  .schedule('0 2 * * *') // Run daily at 2 AM
  .timeZone('Asia/Kolkata')
  .onRun(require('./functions/cleanupExpiredBookings')); 