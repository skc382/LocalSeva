const admin = require('firebase-admin');
const functions = require('firebase-functions');
const moment = require('moment');

/**
 * Scheduled function to cleanup expired bookings and send reminders
 * Runs daily at 2 AM IST
 */
const cleanupExpiredBookings = async (context) => {
  try {
    console.log('Starting cleanup of expired bookings...');
    
    const now = moment();
    const oneDayAgo = now.clone().subtract(1, 'day');
    const oneHourFromNow = now.clone().add(1, 'hour');
    
    // Cleanup expired pending bookings (older than 24 hours)
    await cleanupExpiredPendingBookings(oneDayAgo);
    
    // Send reminders for upcoming bookings (1 hour before)
    await sendUpcomingBookingReminders(oneHourFromNow);
    
    // Auto-complete bookings that are past their scheduled time
    await autoCompleteOverdueBookings(now);
    
    // Generate daily analytics
    await generateDailyAnalytics(now);
    
    console.log('Cleanup and maintenance tasks completed successfully');
    return null;
    
  } catch (error) {
    console.error('Error in cleanup function:', error);
    return null;
  }
};

/**
 * Cleanup expired pending bookings
 */
async function cleanupExpiredPendingBookings(cutoffTime) {
  try {
    const expiredBookingsQuery = admin.firestore()
      .collection('bookings')
      .where('status', '==', 'pending')
      .where('created_at', '<', admin.firestore.Timestamp.fromDate(cutoffTime.toDate()));
    
    const expiredBookingsSnapshot = await expiredBookingsQuery.get();
    
    if (expiredBookingsSnapshot.empty) {
      console.log('No expired pending bookings found');
      return;
    }
    
    const batch = admin.firestore().batch();
    let count = 0;
    
    expiredBookingsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'cancelled',
        cancellation_reason: 'Automatically cancelled - no vendor response within 24 hours',
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
    });
    
    await batch.commit();
    console.log(`Cancelled ${count} expired pending bookings`);
    
    // Send notifications to users about cancelled bookings
    for (const doc of expiredBookingsSnapshot.docs) {
      const booking = doc.data();
      await sendCancellationNotification(booking.user_id, doc.id, booking);
    }
    
  } catch (error) {
    console.error('Error cleaning up expired bookings:', error);
  }
}

/**
 * Send reminders for upcoming bookings
 */
async function sendUpcomingBookingReminders(reminderTime) {
  try {
    const upcomingBookingsQuery = admin.firestore()
      .collection('bookings')
      .where('status', '==', 'confirmed')
      .where('scheduled_time', '>=', admin.firestore.Timestamp.fromDate(reminderTime.clone().subtract(5, 'minutes').toDate()))
      .where('scheduled_time', '<=', admin.firestore.Timestamp.fromDate(reminderTime.clone().add(5, 'minutes').toDate()));
    
    const upcomingBookingsSnapshot = await upcomingBookingsQuery.get();
    
    if (upcomingBookingsSnapshot.empty) {
      console.log('No upcoming bookings for reminders');
      return;
    }
    
    let reminderCount = 0;
    
    for (const doc of upcomingBookingsSnapshot.docs) {
      const booking = doc.data();
      
      // Check if reminder already sent
      if (booking.notifications_sent?.booking_reminder) {
        continue;
      }
      
      // Send reminder to user
      await sendBookingReminder(booking.user_id, doc.id, booking, 'user');
      
      // Send reminder to vendor
      await sendBookingReminder(booking.vendor_id, doc.id, booking, 'vendor');
      
      // Mark reminder as sent
      await doc.ref.update({
        'notifications_sent.booking_reminder': true
      });
      
      reminderCount++;
    }
    
    console.log(`Sent ${reminderCount} booking reminders`);
    
  } catch (error) {
    console.error('Error sending booking reminders:', error);
  }
}

/**
 * Auto-complete overdue bookings
 */
async function autoCompleteOverdueBookings(currentTime) {
  try {
    const overdueTime = currentTime.clone().subtract(2, 'hours');
    
    const overdueBookingsQuery = admin.firestore()
      .collection('bookings')
      .where('status', '==', 'in_progress')
      .where('scheduled_time', '<', admin.firestore.Timestamp.fromDate(overdueTime.toDate()));
    
    const overdueBookingsSnapshot = await overdueBookingsQuery.get();
    
    if (overdueBookingsSnapshot.empty) {
      console.log('No overdue bookings found');
      return;
    }
    
    const batch = admin.firestore().batch();
    let count = 0;
    
    overdueBookingsSnapshot.docs.forEach(doc => {
      const booking = doc.data();
      batch.update(doc.ref, {
        status: 'completed',
        final_price: booking.estimated_price, // Use estimated price as final
        auto_completed: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
    });
    
    await batch.commit();
    console.log(`Auto-completed ${count} overdue bookings`);
    
    // Send completion notifications
    for (const doc of overdueBookingsSnapshot.docs) {
      const booking = doc.data();
      await sendCompletionNotification(booking.user_id, doc.id, booking);
    }
    
  } catch (error) {
    console.error('Error auto-completing overdue bookings:', error);
  }
}

/**
 * Generate daily analytics
 */
async function generateDailyAnalytics(currentTime) {
  try {
    const yesterday = currentTime.clone().subtract(1, 'day');
    const startOfDay = yesterday.clone().startOf('day');
    const endOfDay = yesterday.clone().endOf('day');
    
    // Get bookings from yesterday
    const bookingsQuery = admin.firestore()
      .collection('bookings')
      .where('created_at', '>=', admin.firestore.Timestamp.fromDate(startOfDay.toDate()))
      .where('created_at', '<=', admin.firestore.Timestamp.fromDate(endOfDay.toDate()));
    
    const bookingsSnapshot = await bookingsQuery.get();
    const bookings = bookingsSnapshot.docs.map(doc => doc.data());
    
    // Calculate analytics
    const analytics = {
      date: yesterday.format('YYYY-MM-DD'),
      total_bookings: bookings.length,
      completed_bookings: bookings.filter(b => b.status === 'completed').length,
      cancelled_bookings: bookings.filter(b => b.status === 'cancelled').length,
      pending_bookings: bookings.filter(b => b.status === 'pending').length,
      confirmed_bookings: bookings.filter(b => b.status === 'confirmed').length,
      total_revenue: bookings
        .filter(b => b.final_price && b.status === 'completed')
        .reduce((sum, b) => sum + b.final_price, 0),
      average_rating: 0,
      service_breakdown: {},
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Calculate average rating
    const ratingsGiven = bookings.filter(b => b.rating && b.rating > 0);
    if (ratingsGiven.length > 0) {
      analytics.average_rating = Math.round(
        (ratingsGiven.reduce((sum, b) => sum + b.rating, 0) / ratingsGiven.length) * 100
      ) / 100;
    }
    
    // Calculate service breakdown
    const serviceCount = {};
    bookings.forEach(booking => {
      const service = booking.service_type;
      serviceCount[service] = (serviceCount[service] || 0) + 1;
    });
    analytics.service_breakdown = serviceCount;
    
    // Save analytics
    await admin.firestore()
      .collection('daily_analytics')
      .doc(yesterday.format('YYYY-MM-DD'))
      .set(analytics);
    
    console.log(`Generated daily analytics for ${yesterday.format('YYYY-MM-DD')}`);
    
  } catch (error) {
    console.error('Error generating daily analytics:', error);
  }
}

/**
 * Send cancellation notification
 */
async function sendCancellationNotification(userId, bookingId, booking) {
  try {
    await admin.firestore().collection('notifications').add({
      user_id: userId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `Your ${booking.service_type} booking has been automatically cancelled due to no vendor response.`,
      data: {
        booking_id: bookingId,
        reason: 'No vendor response within 24 hours'
      },
      read: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending cancellation notification:', error);
  }
}

/**
 * Send booking reminder
 */
async function sendBookingReminder(userId, bookingId, booking, userType) {
  try {
    const isVendor = userType === 'vendor';
    const title = isVendor ? 'Upcoming Service' : 'Booking Reminder';
    const message = isVendor 
      ? `You have a ${booking.service_type} service scheduled in 1 hour with ${booking.user_info?.name}`
      : `Your ${booking.service_type} service is scheduled in 1 hour with ${booking.vendor_info?.name}`;
    
    await admin.firestore().collection('notifications').add({
      user_id: userId,
      type: 'booking_reminder',
      title: title,
      message: message,
      data: {
        booking_id: bookingId,
        scheduled_time: booking.scheduled_time,
        service_type: booking.service_type
      },
      read: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending booking reminder:', error);
  }
}

/**
 * Send completion notification
 */
async function sendCompletionNotification(userId, bookingId, booking) {
  try {
    await admin.firestore().collection('notifications').add({
      user_id: userId,
      type: 'booking_completed',
      title: 'Service Completed',
      message: `Your ${booking.service_type} service has been marked as completed. Please rate your experience.`,
      data: {
        booking_id: bookingId,
        vendor_name: booking.vendor_info?.name
      },
      read: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending completion notification:', error);
  }
}

module.exports = cleanupExpiredBookings; 