const express = require('express');
const admin = require('firebase-admin');
const Joi = require('joi');
const moment = require('moment');

const router = express.Router();

// Validation schemas
const createBookingSchema = Joi.object({
  vendor_id: Joi.string().required(),
  service_type: Joi.string().required(),
  scheduled_time: Joi.string().isoDate().required(),
  description: Joi.string().allow('').default(''),
  user_location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().allow('').default('')
  }).required(),
  estimated_duration: Joi.number().min(30).max(480).default(60),
  special_requirements: Joi.string().allow('').default('')
});

const updateBookingSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'cancelled', 'in_progress', 'completed'),
  final_price: Joi.number().min(0),
  rating: Joi.number().min(1).max(5),
  review: Joi.string().allow(''),
  cancellation_reason: Joi.string().allow('')
});

/**
 * POST /api/bookings
 * Create a new booking
 */
router.post('/', async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = createBookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    }

    const createBooking = require('../functions/createBooking');
    
    // Call the createBooking function
    const result = await createBooking(value, {
      auth: { uid: req.userId }
    });

    res.status(201).json(result);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings
 * Get user's bookings with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      status,
      service_type,
      limit = 20,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let query = admin.firestore()
      .collection('bookings')
      .where('user_id', '==', req.userId);

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }

    if (service_type) {
      query = query.where('service_type', '==', service_type.toLowerCase());
    }

    // Apply sorting
    const sortField = sort_by === 'scheduled_time' ? 'scheduled_time' : 'created_at';
    const sortDirection = sort_order === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(sortField, sortDirection);

    // Apply pagination
    query = query.limit(parseInt(limit));
    if (parseInt(offset) > 0) {
      // For offset-based pagination, we need to get the document at offset position
      const offsetQuery = admin.firestore()
        .collection('bookings')
        .where('user_id', '==', req.userId)
        .orderBy(sortField, sortDirection)
        .limit(parseInt(offset));
      
      const offsetSnapshot = await offsetQuery.get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    
    const bookings = snapshot.docs.map(doc => {
      const booking = doc.data();
      return {
        booking_id: doc.id,
        vendor_id: booking.vendor_id,
        service_type: booking.service_type,
        scheduled_time: booking.scheduled_time?.toDate()?.toISOString(),
        estimated_duration: booking.estimated_duration,
        estimated_price: booking.estimated_price,
        final_price: booking.final_price,
        status: booking.status,
        description: booking.description,
        user_location: booking.user_location,
        vendor_info: booking.vendor_info,
        created_at: booking.created_at?.toDate()?.toISOString(),
        updated_at: booking.updated_at?.toDate()?.toISOString(),
        payment_status: booking.payment_status,
        rating: booking.rating,
        review: booking.review
      };
    });

    res.json({
      success: true,
      bookings: bookings,
      count: bookings.length,
      filters: {
        status,
        service_type,
        limit: parseInt(limit),
        offset: parseInt(offset),
        sort_by,
        sort_order
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/:booking_id
 * Get specific booking details
 */
router.get('/:booking_id', async (req, res, next) => {
  try {
    const { booking_id } = req.params;

    const bookingDoc = await admin.firestore()
      .collection('bookings')
      .doc(booking_id)
      .get();

    if (!bookingDoc.exists) {
      return res.status(404).json({
        error: {
          message: 'Booking not found',
          code: 'BOOKING_NOT_FOUND',
          timestamp: new Date().toISOString()
        }
      });
    }

    const booking = bookingDoc.data();

    // Check if user owns this booking
    if (booking.user_id !== req.userId) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this booking',
          code: 'ACCESS_DENIED',
          timestamp: new Date().toISOString()
        }
      });
    }

    const response = {
      booking_id: booking_id,
      user_id: booking.user_id,
      vendor_id: booking.vendor_id,
      service_type: booking.service_type,
      scheduled_time: booking.scheduled_time?.toDate()?.toISOString(),
      estimated_duration: booking.estimated_duration,
      estimated_price: booking.estimated_price,
      final_price: booking.final_price,
      status: booking.status,
      description: booking.description,
      special_requirements: booking.special_requirements,
      user_location: booking.user_location,
      vendor_info: booking.vendor_info,
      user_info: booking.user_info,
      created_at: booking.created_at?.toDate()?.toISOString(),
      updated_at: booking.updated_at?.toDate()?.toISOString(),
      payment_status: booking.payment_status,
      rating: booking.rating,
      review: booking.review,
      cancellation_reason: booking.cancellation_reason
    };

    res.json({
      success: true,
      booking: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/bookings/:booking_id
 * Update booking status, rating, etc.
 */
router.patch('/:booking_id', async (req, res, next) => {
  try {
    const { booking_id } = req.params;

    // Validate request body
    const { error, value } = updateBookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    }

    const bookingRef = admin.firestore().collection('bookings').doc(booking_id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return res.status(404).json({
        error: {
          message: 'Booking not found',
          code: 'BOOKING_NOT_FOUND',
          timestamp: new Date().toISOString()
        }
      });
    }

    const booking = bookingDoc.data();

    // Check if user owns this booking
    if (booking.user_id !== req.userId) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this booking',
          code: 'ACCESS_DENIED',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate status transitions
    if (value.status) {
      const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['in_progress', 'cancelled'],
        'in_progress': ['completed', 'cancelled'],
        'completed': [], // No transitions from completed
        'cancelled': [] // No transitions from cancelled
      };

      const allowedStatuses = validTransitions[booking.status] || [];
      if (!allowedStatuses.includes(value.status)) {
        return res.status(400).json({
          error: {
            message: `Cannot change status from ${booking.status} to ${value.status}`,
            code: 'INVALID_STATUS_TRANSITION',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Prepare update data
    const updateData = {
      ...value,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update the booking
    await bookingRef.update(updateData);

    // If rating is provided, update vendor's average rating
    if (value.rating) {
      await updateVendorRating(booking.vendor_id, value.rating);
    }

    res.json({
      success: true,
      message: 'Booking updated successfully',
      booking_id: booking_id,
      updated_fields: Object.keys(value),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/bookings/:booking_id
 * Cancel a booking (soft delete)
 */
router.delete('/:booking_id', async (req, res, next) => {
  try {
    const { booking_id } = req.params;
    const { cancellation_reason = 'Cancelled by user' } = req.body;

    const bookingRef = admin.firestore().collection('bookings').doc(booking_id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return res.status(404).json({
        error: {
          message: 'Booking not found',
          code: 'BOOKING_NOT_FOUND',
          timestamp: new Date().toISOString()
        }
      });
    }

    const booking = bookingDoc.data();

    // Check if user owns this booking
    if (booking.user_id !== req.userId) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this booking',
          code: 'ACCESS_DENIED',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if booking can be cancelled
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        error: {
          message: `Cannot cancel booking with status: ${booking.status}`,
          code: 'CANNOT_CANCEL_BOOKING',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update booking status to cancelled
    await bookingRef.update({
      status: 'cancelled',
      cancellation_reason: cancellation_reason,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking_id: booking_id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Update vendor's average rating
 */
async function updateVendorRating(vendorId, newRating) {
  try {
    const vendorRef = admin.firestore().collection('vendors').doc(vendorId);
    
    await admin.firestore().runTransaction(async (transaction) => {
      const vendorDoc = await transaction.get(vendorRef);
      
      if (!vendorDoc.exists) {
        console.warn(`Vendor ${vendorId} not found for rating update`);
        return;
      }
      
      const vendorData = vendorDoc.data();
      const currentRating = vendorData.ratings || 0;
      const currentCount = vendorData.rating_count || 0;
      
      // Calculate new average rating
      const newCount = currentCount + 1;
      const newAverage = ((currentRating * currentCount) + newRating) / newCount;
      
      transaction.update(vendorRef, {
        ratings: Math.round(newAverage * 100) / 100, // Round to 2 decimal places
        rating_count: newCount,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    console.log(`Updated vendor ${vendorId} rating with new rating: ${newRating}`);
    
  } catch (error) {
    console.error('Error updating vendor rating:', error);
  }
}

module.exports = router; 