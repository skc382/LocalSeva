const express = require('express');
const admin = require('firebase-admin');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  language: Joi.string().valid('en', 'hi', 'kn'),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    address: Joi.string().allow('')
  }),
  preferences: Joi.object({
    notifications: Joi.boolean(),
    email_updates: Joi.boolean(),
    preferred_services: Joi.array().items(Joi.string())
  })
});

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(req.userId)
      .get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: {
          message: 'User profile not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        }
      });
    }

    const userData = userDoc.data();

    const profile = {
      user_id: req.userId,
      name: userData.name || '',
      phone_number: userData.phone_number || req.phoneNumber,
      email: userData.email || '',
      language: userData.language || 'en',
      location: userData.location || null,
      preferences: userData.preferences || {
        notifications: true,
        email_updates: false,
        preferred_services: []
      },
      created_at: userData.created_at?.toDate()?.toISOString(),
      updated_at: userData.updated_at?.toDate()?.toISOString(),
      last_seen: userData.last_seen?.toDate()?.toISOString(),
      total_bookings: userData.bookings?.length || 0,
      is_active: userData.is_active || true
    };

    res.json({
      success: true,
      profile: profile,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/users/profile
 * Update current user's profile
 */
router.patch('/profile', async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    }

    const updateData = {
      ...value,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await admin.firestore()
      .collection('users')
      .doc(req.userId)
      .update(updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      updated_fields: Object.keys(value),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/bookings/stats
 * Get user's booking statistics
 */
router.get('/bookings/stats', async (req, res, next) => {
  try {
    const bookingsSnapshot = await admin.firestore()
      .collection('bookings')
      .where('user_id', '==', req.userId)
      .get();

    const bookings = bookingsSnapshot.docs.map(doc => doc.data());

    // Calculate statistics
    const stats = {
      total_bookings: bookings.length,
      completed_bookings: bookings.filter(b => b.status === 'completed').length,
      cancelled_bookings: bookings.filter(b => b.status === 'cancelled').length,
      pending_bookings: bookings.filter(b => b.status === 'pending').length,
      confirmed_bookings: bookings.filter(b => b.status === 'confirmed').length,
      in_progress_bookings: bookings.filter(b => b.status === 'in_progress').length,
      total_spent: bookings
        .filter(b => b.final_price && b.status === 'completed')
        .reduce((sum, b) => sum + b.final_price, 0),
      average_rating_given: 0,
      favorite_services: {}
    };

    // Calculate average rating given by user
    const ratingsGiven = bookings.filter(b => b.rating && b.rating > 0);
    if (ratingsGiven.length > 0) {
      stats.average_rating_given = Math.round(
        (ratingsGiven.reduce((sum, b) => sum + b.rating, 0) / ratingsGiven.length) * 100
      ) / 100;
    }

    // Calculate favorite services
    const serviceCount = {};
    bookings.forEach(booking => {
      const service = booking.service_type;
      serviceCount[service] = (serviceCount[service] || 0) + 1;
    });

    stats.favorite_services = Object.entries(serviceCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .reduce((obj, [service, count]) => {
        obj[service] = count;
        return obj;
      }, {});

    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/notifications
 * Get user's notifications
 */
router.get('/notifications', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, unread_only = false } = req.query;

    let query = admin.firestore()
      .collection('notifications')
      .where('user_id', '==', req.userId);

    if (unread_only === 'true') {
      query = query.where('read', '==', false);
    }

    query = query.orderBy('created_at', 'desc').limit(parseInt(limit));

    if (parseInt(offset) > 0) {
      const offsetQuery = admin.firestore()
        .collection('notifications')
        .where('user_id', '==', req.userId)
        .orderBy('created_at', 'desc')
        .limit(parseInt(offset));
      
      const offsetSnapshot = await offsetQuery.get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    
    const notifications = snapshot.docs.map(doc => {
      const notification = doc.data();
      return {
        notification_id: doc.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        read: notification.read || false,
        created_at: notification.created_at?.toDate()?.toISOString()
      };
    });

    res.json({
      success: true,
      notifications: notifications,
      count: notifications.length,
      filters: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        unread_only: unread_only === 'true'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/users/notifications/:notification_id/read
 * Mark notification as read
 */
router.patch('/notifications/:notification_id/read', async (req, res, next) => {
  try {
    const { notification_id } = req.params;

    const notificationRef = admin.firestore()
      .collection('notifications')
      .doc(notification_id);

    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      return res.status(404).json({
        error: {
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        }
      });
    }

    const notification = notificationDoc.data();

    // Check if user owns this notification
    if (notification.user_id !== req.userId) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this notification',
          code: 'ACCESS_DENIED',
          timestamp: new Date().toISOString()
        }
      });
    }

    await notificationRef.update({
      read: true,
      read_at: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification_id: notification_id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users/notifications/mark-all-read
 * Mark all notifications as read
 */
router.post('/notifications/mark-all-read', async (req, res, next) => {
  try {
    const notificationsSnapshot = await admin.firestore()
      .collection('notifications')
      .where('user_id', '==', req.userId)
      .where('read', '==', false)
      .get();

    if (notificationsSnapshot.empty) {
      return res.json({
        success: true,
        message: 'No unread notifications found',
        updated_count: 0,
        timestamp: new Date().toISOString()
      });
    }

    const batch = admin.firestore().batch();
    
    notificationsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        read_at: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    res.json({
      success: true,
      message: 'All notifications marked as read',
      updated_count: notificationsSnapshot.docs.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/users/account
 * Deactivate user account (soft delete)
 */
router.delete('/account', async (req, res, next) => {
  try {
    const { reason = 'User requested account deletion' } = req.body;

    // Check for active bookings
    const activeBookingsSnapshot = await admin.firestore()
      .collection('bookings')
      .where('user_id', '==', req.userId)
      .where('status', 'in', ['pending', 'confirmed', 'in_progress'])
      .get();

    if (!activeBookingsSnapshot.empty) {
      return res.status(400).json({
        error: {
          message: 'Cannot deactivate account with active bookings. Please complete or cancel all active bookings first.',
          code: 'ACTIVE_BOOKINGS_EXIST',
          active_bookings_count: activeBookingsSnapshot.docs.length,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Deactivate user account
    await admin.firestore()
      .collection('users')
      .doc(req.userId)
      .update({
        is_active: false,
        deactivated_at: admin.firestore.FieldValue.serverTimestamp(),
        deactivation_reason: reason,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

    res.json({
      success: true,
      message: 'Account deactivated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router; 