const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Authentication middleware for Firebase Functions
 * Verifies Firebase Auth token and ensures user is authenticated via WhatsApp
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          message: 'Missing or invalid authorization header',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString()
        }
      });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Missing authentication token',
          code: 'UNAUTHORIZED',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify the Firebase Auth token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check if user has a verified phone number (WhatsApp requirement)
    if (!decodedToken.phone_number) {
      return res.status(403).json({
        error: {
          message: 'Phone number verification required for WhatsApp integration',
          code: 'PHONE_VERIFICATION_REQUIRED',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get user data from Firestore
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists) {
      // Create user document if it doesn't exist
      const userData = {
        user_id: decodedToken.uid,
        phone_number: decodedToken.phone_number,
        name: decodedToken.name || '',
        email: decodedToken.email || '',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        language: 'en', // Default language
        location: null,
        bookings: [],
        is_active: true
      };

      await admin.firestore()
        .collection('users')
        .doc(decodedToken.uid)
        .set(userData);

      req.user = { ...userData, ...decodedToken };
    } else {
      // Update last seen timestamp
      await userDoc.ref.update({
        last_seen: admin.firestore.FieldValue.serverTimestamp()
      });

      req.user = { ...userDoc.data(), ...decodedToken };
    }

    // Add user info to request object
    req.userId = decodedToken.uid;
    req.phoneNumber = decodedToken.phone_number;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: {
          message: 'Authentication token has expired',
          code: 'TOKEN_EXPIRED',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        error: {
          message: 'Authentication token has been revoked',
          code: 'TOKEN_REVOKED',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        error: {
          message: 'Invalid authentication token',
          code: 'INVALID_TOKEN',
          timestamp: new Date().toISOString()
        }
      });
    }

    return res.status(500).json({
      error: {
        message: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Optional authentication middleware for public endpoints
 * Adds user info if token is present but doesn't require authentication
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (token) {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        req.userId = decodedToken.uid;
        req.phoneNumber = decodedToken.phone_number;
      }
    }
    next();
  } catch (error) {
    // For optional auth, we don't fail on auth errors
    console.warn('Optional auth failed:', error.message);
    next();
  }
};

module.exports = authMiddleware;
module.exports.optional = optionalAuthMiddleware; 