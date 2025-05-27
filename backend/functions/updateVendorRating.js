const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Firebase trigger function to update vendor ratings when bookings are updated
 * Triggered when a booking document is updated in Firestore
 */
const updateVendorRating = async (change, context) => {
  try {
    const bookingId = context.params.bookingId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if rating was added or changed
    const beforeRating = beforeData?.rating;
    const afterRating = afterData?.rating;

    if (!afterRating || afterRating === beforeRating) {
      // No rating change, exit early
      return null;
    }

    const vendorId = afterData.vendor_id;
    if (!vendorId) {
      console.error('No vendor_id found in booking:', bookingId);
      return null;
    }

    console.log(`Updating vendor ${vendorId} rating due to booking ${bookingId} rating change`);

    // Use transaction to ensure consistency
    await admin.firestore().runTransaction(async (transaction) => {
      const vendorRef = admin.firestore().collection('vendors').doc(vendorId);
      const vendorDoc = await transaction.get(vendorRef);

      if (!vendorDoc.exists) {
        console.error(`Vendor ${vendorId} not found`);
        return;
      }

      const vendorData = vendorDoc.data();
      let currentRating = vendorData.ratings || 0;
      let currentCount = vendorData.rating_count || 0;

      // If this is a rating update (not first rating)
      if (beforeRating && beforeRating > 0) {
        // Remove the old rating from the average
        if (currentCount > 1) {
          currentRating = ((currentRating * currentCount) - beforeRating) / (currentCount - 1);
          currentCount = currentCount - 1;
        } else {
          currentRating = 0;
          currentCount = 0;
        }
      }

      // Add the new rating
      const newCount = currentCount + 1;
      const newAverage = ((currentRating * currentCount) + afterRating) / newCount;

      // Update vendor document
      transaction.update(vendorRef, {
        ratings: Math.round(newAverage * 100) / 100, // Round to 2 decimal places
        rating_count: newCount,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Updated vendor ${vendorId}: rating ${newAverage.toFixed(2)}, count ${newCount}`);
    });

    // Log rating analytics
    await logRatingAnalytics(vendorId, afterRating, beforeRating);

    return null;

  } catch (error) {
    console.error('Error updating vendor rating:', error);
    return null;
  }
};

/**
 * Log rating analytics for insights
 */
async function logRatingAnalytics(vendorId, newRating, oldRating = null) {
  try {
    const analyticsData = {
      vendor_id: vendorId,
      new_rating: newRating,
      old_rating: oldRating,
      action: oldRating ? 'rating_updated' : 'rating_added',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      date: new Date().toISOString().split('T')[0]
    };

    await admin.firestore().collection('rating_analytics').add(analyticsData);
  } catch (error) {
    console.error('Failed to log rating analytics:', error);
  }
}

module.exports = updateVendorRating; 