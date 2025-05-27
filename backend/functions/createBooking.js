const admin = require('firebase-admin');
const functions = require('firebase-functions');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new booking for a service
 * Validates vendor availability, prevents double booking, and sends notifications
 */
const createBooking = async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to create bookings'
      );
    }

    // Validate input data
    const {
      vendor_id,
      service_type,
      scheduled_time,
      description = '',
      user_location,
      estimated_duration = 60, // minutes
      special_requirements = ''
    } = data;

    if (!vendor_id || !service_type || !scheduled_time) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'vendor_id, service_type, and scheduled_time are required'
      );
    }

    if (!user_location || !user_location.latitude || !user_location.longitude) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'user_location with latitude and longitude is required'
      );
    }

    // Validate scheduled time
    const scheduledMoment = moment(scheduled_time);
    const now = moment();
    
    if (!scheduledMoment.isValid()) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid scheduled_time format. Use ISO 8601 format.'
      );
    }

    if (scheduledMoment.isBefore(now)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Cannot schedule booking in the past'
      );
    }

    if (scheduledMoment.isAfter(now.clone().add(30, 'days'))) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Cannot schedule booking more than 30 days in advance'
      );
    }

    const userId = context.auth.uid;
    console.log(`Creating booking for user ${userId} with vendor ${vendor_id}`);

    // Use Firestore transaction to ensure data consistency
    const result = await admin.firestore().runTransaction(async (transaction) => {
      // Get vendor details
      const vendorRef = admin.firestore().collection('vendors').doc(vendor_id);
      const vendorDoc = await transaction.get(vendorRef);

      if (!vendorDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Vendor not found'
        );
      }

      const vendorData = vendorDoc.data();

      // Check if vendor is active and provides the requested service
      if (!vendorData.is_active) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Vendor is currently inactive'
        );
      }

      if (vendorData.service_type.toLowerCase() !== service_type.toLowerCase()) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Vendor does not provide ${service_type} service`
        );
      }

      // Get user details
      const userRef = admin.firestore().collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User not found'
        );
      }

      const userData = userDoc.data();

      // Check for existing pending/confirmed bookings for the same time slot
      const existingBookingsQuery = await admin.firestore()
        .collection('bookings')
        .where('user_id', '==', userId)
        .where('status', 'in', ['pending', 'confirmed'])
        .get();

      const conflictingBooking = existingBookingsQuery.docs.find(doc => {
        const booking = doc.data();
        const bookingTime = moment(booking.scheduled_time.toDate());
        const timeDiff = Math.abs(bookingTime.diff(scheduledMoment, 'minutes'));
        return timeDiff < 120; // 2 hours buffer
      });

      if (conflictingBooking) {
        throw new functions.https.HttpsError(
          'already-exists',
          'You already have a booking within 2 hours of this time'
        );
      }

      // Check vendor availability for the requested time slot
      const vendorBookingsQuery = await admin.firestore()
        .collection('bookings')
        .where('vendor_id', '==', vendor_id)
        .where('status', 'in', ['confirmed'])
        .get();

      const vendorConflict = vendorBookingsQuery.docs.find(doc => {
        const booking = doc.data();
        const bookingTime = moment(booking.scheduled_time.toDate());
        const bookingEnd = bookingTime.clone().add(booking.estimated_duration || 60, 'minutes');
        const requestedEnd = scheduledMoment.clone().add(estimated_duration, 'minutes');
        
        // Check for time overlap
        return (scheduledMoment.isBefore(bookingEnd) && requestedEnd.isAfter(bookingTime));
      });

      if (vendorConflict) {
        throw new functions.https.HttpsError(
          'already-exists',
          'Vendor is not available at the requested time'
        );
      }

      // Calculate estimated price based on vendor's base price
      const basePrice = vendorData.price || 500;
      const estimatedPrice = calculateEstimatedPrice(basePrice, estimated_duration, service_type);

      // Generate booking ID
      const bookingId = uuidv4();

      // Create booking document
      const bookingData = {
        booking_id: bookingId,
        user_id: userId,
        vendor_id: vendor_id,
        service_type: service_type.toLowerCase(),
        scheduled_time: admin.firestore.Timestamp.fromDate(scheduledMoment.toDate()),
        estimated_duration: estimated_duration,
        estimated_price: estimatedPrice,
        final_price: null,
        status: 'pending', // pending, confirmed, in_progress, completed, cancelled
        description: description,
        special_requirements: special_requirements,
        user_location: {
          latitude: user_location.latitude,
          longitude: user_location.longitude,
          address: user_location.address || ''
        },
        vendor_info: {
          name: vendorData.name,
          phone_number: vendorData.phone_number,
          service_type: vendorData.service_type
        },
        user_info: {
          name: userData.name,
          phone_number: userData.phone_number
        },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        payment_status: 'pending', // pending, paid, failed, refunded
        rating: null,
        review: null,
        cancellation_reason: null,
        notifications_sent: {
          booking_created: false,
          booking_confirmed: false,
          booking_reminder: false,
          booking_completed: false
        }
      };

      // Create the booking
      const bookingRef = admin.firestore().collection('bookings').doc(bookingId);
      transaction.set(bookingRef, bookingData);

      // Update user's bookings array
      transaction.update(userRef, {
        bookings: admin.firestore.FieldValue.arrayUnion(bookingId),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update vendor's bookings array
      transaction.update(vendorRef, {
        bookings: admin.firestore.FieldValue.arrayUnion(bookingId),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        booking_id: bookingId,
        ...bookingData,
        scheduled_time: scheduledMoment.toISOString()
      };
    });

    // Send notifications (async, don't wait for completion)
    sendBookingNotifications(result.booking_id, 'created').catch(error => {
      console.error('Failed to send booking notifications:', error);
    });

    // Log booking analytics
    logBookingAnalytics(userId, vendor_id, service_type, 'created').catch(error => {
      console.error('Failed to log booking analytics:', error);
    });

    console.log(`Booking ${result.booking_id} created successfully`);

    return {
      success: true,
      booking: {
        booking_id: result.booking_id,
        vendor_id: result.vendor_id,
        service_type: result.service_type,
        scheduled_time: result.scheduled_time,
        estimated_price: result.estimated_price,
        status: result.status,
        estimated_duration: result.estimated_duration
      },
      message: 'Booking created successfully. Vendor will be notified.',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Booking creation error:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to create booking. Please try again later.'
    );
  }
};

/**
 * Calculate estimated price based on various factors
 */
function calculateEstimatedPrice(basePrice, duration, serviceType) {
  let price = basePrice;
  
  // Duration-based pricing (per hour)
  const hours = Math.ceil(duration / 60);
  if (hours > 1) {
    price += (hours - 1) * (basePrice * 0.7); // 70% of base price for additional hours
  }
  
  // Service type multipliers
  const serviceMultipliers = {
    'plumbing': 1.0,
    'electrical': 1.2,
    'carpentry': 1.1,
    'painting': 0.9,
    'ac_repair': 1.3,
    'haircut': 0.8,
    'facial': 1.0,
    'massage': 1.1,
    'manicure': 0.7,
    'makeup': 1.2
  };
  
  const multiplier = serviceMultipliers[serviceType.toLowerCase()] || 1.0;
  price *= multiplier;
  
  return Math.round(price);
}

/**
 * Send booking notifications to user and vendor
 */
async function sendBookingNotifications(bookingId, eventType) {
  try {
    // Get booking details
    const bookingDoc = await admin.firestore()
      .collection('bookings')
      .doc(bookingId)
      .get();
    
    if (!bookingDoc.exists) {
      console.error('Booking not found for notifications:', bookingId);
      return;
    }
    
    const booking = bookingDoc.data();
    
    // Create notification documents
    const notifications = [];
    
    // User notification
    notifications.push({
      user_id: booking.user_id,
      type: 'booking_created',
      title: 'Booking Created',
      message: `Your ${booking.service_type} service booking has been created for ${moment(booking.scheduled_time.toDate()).format('MMM DD, YYYY at HH:mm')}`,
      data: {
        booking_id: bookingId,
        vendor_name: booking.vendor_info.name
      },
      read: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Vendor notification
    notifications.push({
      user_id: booking.vendor_id,
      type: 'new_booking_request',
      title: 'New Booking Request',
      message: `New ${booking.service_type} booking request from ${booking.user_info.name}`,
      data: {
        booking_id: bookingId,
        user_name: booking.user_info.name,
        scheduled_time: booking.scheduled_time
      },
      read: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Save notifications
    const batch = admin.firestore().batch();
    notifications.forEach(notification => {
      const notificationRef = admin.firestore().collection('notifications').doc();
      batch.set(notificationRef, notification);
    });
    
    await batch.commit();
    
    // Update booking to mark notification as sent
    await admin.firestore()
      .collection('bookings')
      .doc(bookingId)
      .update({
        'notifications_sent.booking_created': true
      });
    
    console.log(`Notifications sent for booking ${bookingId}`);
    
  } catch (error) {
    console.error('Error sending booking notifications:', error);
  }
}

/**
 * Log booking analytics
 */
async function logBookingAnalytics(userId, vendorId, serviceType, action) {
  try {
    await admin.firestore().collection('booking_analytics').add({
      user_id: userId,
      vendor_id: vendorId,
      service_type: serviceType,
      action: action, // created, confirmed, cancelled, completed
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      date: new Date().toISOString().split('T')[0],
      hour: new Date().getHours()
    });
  } catch (error) {
    console.error('Failed to log booking analytics:', error);
  }
}

module.exports = createBooking; 