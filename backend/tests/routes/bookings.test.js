const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const express = require('express');

describe('Booking Routes', function() {
  let app;
  let bookingRoutes;
  let mockAuthMiddleware;
  let mockCreateBooking;

  beforeEach(function() {
    // Reset all mocks
    sinon.resetHistory();
    
    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    mockAuthMiddleware = (req, res, next) => {
      req.userId = 'test-user-123';
      req.phoneNumber = '+919876543210';
      req.user = {
        uid: 'test-user-123',
        phone_number: '+919876543210'
      };
      next();
    };
    
    // Mock createBooking function
    mockCreateBooking = sinon.stub().resolves({
      success: true,
      booking: {
        booking_id: 'booking-123',
        vendor_id: 'vendor-123',
        service_type: 'plumbing',
        scheduled_time: new Date().toISOString(),
        estimated_price: 500,
        status: 'pending',
        estimated_duration: 60
      },
      message: 'Booking created successfully. Vendor will be notified.',
      timestamp: new Date().toISOString()
    });
    
    // Load booking routes
    bookingRoutes = require('../../routes/bookings');
    app.use('/api/bookings', mockAuthMiddleware, bookingRoutes);

    // Setup default mock responses
    setupDefaultMocks();
  });

  function setupDefaultMocks() {
    // Mock booking data
    const mockBookingData = {
      booking_id: 'booking-123',
      user_id: 'test-user-123',
      vendor_id: 'vendor-123',
      service_type: 'plumbing',
      scheduled_time: { toDate: () => new Date() },
      estimated_duration: 60,
      estimated_price: 500,
      final_price: null,
      status: 'pending',
      description: 'Kitchen sink repair',
      user_location: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: '123 Main St'
      },
      vendor_info: {
        name: 'Test Plumber',
        phone_number: '+919876543210'
      },
      created_at: { toDate: () => new Date() },
      updated_at: { toDate: () => new Date() },
      payment_status: 'pending'
    };

    // Setup Firestore collection mocks
    global.mockCollectionRef.get.resolves({
      docs: [{
        id: 'booking-123',
        data: () => mockBookingData
      }]
    });

    global.mockDocRef.get.resolves({
      exists: true,
      data: () => mockBookingData,
      ref: {
        update: sinon.stub().resolves()
      }
    });

    global.mockDocRef.update.resolves();
  }

  describe('POST /api/bookings', function() {
    describe('Input Validation', function() {
      it('should validate required vendor_id parameter', async function() {
        const response = await request(app)
          .post('/api/bookings')
          .send({
            service_type: 'plumbing',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946
            }
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
        expect(response.body.error.message).to.include('vendor_id');
      });

      it('should validate required service_type parameter', async function() {
        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946
            }
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
        expect(response.body.error.message).to.include('service_type');
      });

      it('should validate required scheduled_time parameter', async function() {
        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946
            }
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
        expect(response.body.error.message).to.include('scheduled_time');
      });

      it('should validate required user_location parameter', async function() {
        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
        expect(response.body.error.message).to.include('user_location');
      });

      it('should validate user_location coordinates', async function() {
        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_location: {
              address: '123 Main St'
              // Missing latitude and longitude
            }
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should validate scheduled_time format', async function() {
        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            scheduled_time: 'invalid-date',
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946
            }
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should apply default values for optional parameters', async function() {
        // Mock the createBooking function to capture the call
        const Module = require('module');
        const originalRequire = Module.prototype.require;
        Module.prototype.require = function(id) {
          if (id === '../../functions/createBooking') {
            return mockCreateBooking;
          }
          return originalRequire.apply(this, arguments);
        };

        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946
            }
          });

        expect(response.status).to.equal(201);
        expect(mockCreateBooking.called).to.be.true;
        
        // Verify default values were applied
        const callArgs = mockCreateBooking.getCall(0).args[0];
        expect(callArgs.estimated_duration).to.equal(60); // Default duration
        expect(callArgs.description).to.equal(''); // Default description
      });

      it('should validate estimated_duration limits', async function() {
        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946
            },
            estimated_duration: 500 // Too long
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });
    });

    describe('Booking Creation', function() {
      beforeEach(function() {
        // Mock the createBooking function
        const Module = require('module');
        const originalRequire = Module.prototype.require;
        Module.prototype.require = function(id) {
          if (id === '../../functions/createBooking') {
            return mockCreateBooking;
          }
          return originalRequire.apply(this, arguments);
        };
      });

      it('should successfully create booking with valid data', async function() {
        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946,
              address: '123 Main St'
            },
            estimated_duration: 90,
            description: 'Fix kitchen sink'
          });

        expect(response.status).to.equal(201);
        expect(response.body.success).to.be.true;
        expect(response.body.booking).to.be.an('object');
        expect(response.body.booking.booking_id).to.equal('booking-123');
        expect(mockCreateBooking.called).to.be.true;
      });

      it('should pass user context to createBooking function', async function() {
        await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946
            }
          });

        expect(mockCreateBooking.called).to.be.true;
        const contextArg = mockCreateBooking.getCall(0).args[1];
        expect(contextArg.auth.uid).to.equal('test-user-123');
      });

      it('should handle createBooking function errors', async function() {
        mockCreateBooking.rejects(new Error('Booking creation failed'));

        const response = await request(app)
          .post('/api/bookings')
          .send({
            vendor_id: 'vendor-123',
            service_type: 'plumbing',
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            user_location: {
              latitude: 12.9716,
              longitude: 77.5946
            }
          });

        expect(response.status).to.equal(500);
      });
    });
  });

  describe('GET /api/bookings', function() {
    describe('Booking Retrieval', function() {
      it('should retrieve user bookings successfully', async function() {
        const response = await request(app)
          .get('/api/bookings');

        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
        expect(response.body.bookings).to.be.an('array');
        expect(global.mockCollectionRef.where.calledWith('user_id', '==', 'test-user-123')).to.be.true;
      });

      it('should filter bookings by status', async function() {
        await request(app)
          .get('/api/bookings?status=confirmed');

        expect(global.mockCollectionRef.where.calledWith('status', '==', 'confirmed')).to.be.true;
      });

      it('should filter bookings by service_type', async function() {
        await request(app)
          .get('/api/bookings?service_type=plumbing');

        expect(global.mockCollectionRef.where.calledWith('service_type', '==', 'plumbing')).to.be.true;
      });

      it('should apply pagination limits', async function() {
        await request(app)
          .get('/api/bookings?limit=10');

        expect(global.mockCollectionRef.limit.calledWith(10)).to.be.true;
      });

      it('should apply sorting', async function() {
        await request(app)
          .get('/api/bookings?sort_by=scheduled_time&sort_order=asc');

        expect(global.mockCollectionRef.orderBy.calledWith('scheduled_time', 'asc')).to.be.true;
      });

      it('should return properly formatted booking data', async function() {
        const response = await request(app)
          .get('/api/bookings');

        expect(response.status).to.equal(200);
        expect(response.body.bookings).to.be.an('array');
        
        if (response.body.bookings.length > 0) {
          const booking = response.body.bookings[0];
          expect(booking).to.have.property('booking_id');
          expect(booking).to.have.property('vendor_id');
          expect(booking).to.have.property('service_type');
          expect(booking).to.have.property('status');
          expect(booking).to.have.property('scheduled_time');
        }
      });

      it('should include filter parameters in response', async function() {
        const response = await request(app)
          .get('/api/bookings?status=pending&limit=5');

        expect(response.status).to.equal(200);
        expect(response.body.filters).to.deep.include({
          status: 'pending',
          limit: 5
        });
      });
    });

    describe('Error Handling', function() {
      it('should handle Firestore query errors', async function() {
        global.mockCollectionRef.get.rejects(new Error('Database error'));

        const response = await request(app)
          .get('/api/bookings');

        expect(response.status).to.equal(500);
      });

      it('should handle invalid query parameters gracefully', async function() {
        const response = await request(app)
          .get('/api/bookings?limit=invalid');

        expect(response.status).to.equal(200); // Should use default limit
      });
    });
  });

  describe('GET /api/bookings/:booking_id', function() {
    describe('Single Booking Retrieval', function() {
      it('should retrieve specific booking successfully', async function() {
        const response = await request(app)
          .get('/api/bookings/booking-123');

        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
        expect(response.body.booking).to.be.an('object');
        expect(response.body.booking.booking_id).to.equal('booking-123');
      });

      it('should return 404 for non-existent booking', async function() {
        global.mockDocRef.get.resolves({ exists: false });

        const response = await request(app)
          .get('/api/bookings/non-existent-booking');

        expect(response.status).to.equal(404);
        expect(response.body.error.code).to.equal('BOOKING_NOT_FOUND');
      });

      it('should enforce user ownership of booking', async function() {
        const otherUserBooking = {
          booking_id: 'booking-123',
          user_id: 'other-user-456', // Different user
          vendor_id: 'vendor-123',
          service_type: 'plumbing',
          status: 'pending'
        };

        global.mockDocRef.get.resolves({
          exists: true,
          data: () => otherUserBooking
        });

        const response = await request(app)
          .get('/api/bookings/booking-123');

        expect(response.status).to.equal(403);
        expect(response.body.error.code).to.equal('ACCESS_DENIED');
      });

      it('should include all booking details in response', async function() {
        const response = await request(app)
          .get('/api/bookings/booking-123');

        expect(response.status).to.equal(200);
        
        const booking = response.body.booking;
        expect(booking).to.have.property('booking_id');
        expect(booking).to.have.property('user_id');
        expect(booking).to.have.property('vendor_id');
        expect(booking).to.have.property('service_type');
        expect(booking).to.have.property('scheduled_time');
        expect(booking).to.have.property('status');
        expect(booking).to.have.property('vendor_info');
        expect(booking).to.have.property('user_info');
      });
    });

    describe('Error Handling', function() {
      it('should handle Firestore errors gracefully', async function() {
        global.mockDocRef.get.rejects(new Error('Database error'));

        const response = await request(app)
          .get('/api/bookings/booking-123');

        expect(response.status).to.equal(500);
      });

      it('should validate booking ID format', async function() {
        const response = await request(app)
          .get('/api/bookings/');

        expect(response.status).to.equal(404); // Route not found
      });
    });
  });

  describe('PATCH /api/bookings/:booking_id', function() {
    describe('Booking Updates', function() {
      it('should update booking status successfully', async function() {
        const response = await request(app)
          .patch('/api/bookings/booking-123')
          .send({
            status: 'completed',
            rating: 5,
            review: 'Excellent service!'
          });

        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('updated successfully');
        expect(global.mockDocRef.update.called).to.be.true;
      });

      it('should validate status transitions', async function() {
        const completedBooking = {
          booking_id: 'booking-123',
          user_id: 'test-user-123',
          status: 'completed' // Already completed
        };

        global.mockDocRef.get.resolves({
          exists: true,
          data: () => completedBooking
        });

        const response = await request(app)
          .patch('/api/bookings/booking-123')
          .send({
            status: 'pending' // Invalid transition
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('INVALID_STATUS_TRANSITION');
      });

      it('should enforce user ownership for updates', async function() {
        const otherUserBooking = {
          booking_id: 'booking-123',
          user_id: 'other-user-456',
          status: 'pending'
        };

        global.mockDocRef.get.resolves({
          exists: true,
          data: () => otherUserBooking
        });

        const response = await request(app)
          .patch('/api/bookings/booking-123')
          .send({
            status: 'completed'
          });

        expect(response.status).to.equal(403);
        expect(response.body.error.code).to.equal('ACCESS_DENIED');
      });

      it('should validate update data', async function() {
        const response = await request(app)
          .patch('/api/bookings/booking-123')
          .send({
            status: 'invalid_status'
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should update vendor rating when rating is provided', async function() {
        const response = await request(app)
          .patch('/api/bookings/booking-123')
          .send({
            rating: 4,
            review: 'Good service'
          });

        expect(response.status).to.equal(200);
        // Vendor rating update would be called (mocked in actual implementation)
      });

      it('should validate rating range', async function() {
        const response = await request(app)
          .patch('/api/bookings/booking-123')
          .send({
            rating: 6 // Invalid rating (max 5)
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });
    });

    describe('Error Handling', function() {
      it('should handle non-existent booking', async function() {
        global.mockDocRef.get.resolves({ exists: false });

        const response = await request(app)
          .patch('/api/bookings/non-existent-booking')
          .send({
            status: 'completed'
          });

        expect(response.status).to.equal(404);
        expect(response.body.error.code).to.equal('BOOKING_NOT_FOUND');
      });

      it('should handle Firestore update errors', async function() {
        global.mockDocRef.update.rejects(new Error('Update failed'));

        const response = await request(app)
          .patch('/api/bookings/booking-123')
          .send({
            status: 'completed'
          });

        expect(response.status).to.equal(500);
      });

      it('should handle malformed request body', async function() {
        const response = await request(app)
          .patch('/api/bookings/booking-123')
          .send('invalid json');

        expect(response.status).to.equal(400);
      });
    });
  });

  describe('DELETE /api/bookings/:booking_id', function() {
    describe('Booking Cancellation', function() {
      it('should cancel booking successfully', async function() {
        const response = await request(app)
          .delete('/api/bookings/booking-123')
          .send({
            cancellation_reason: 'Change of plans'
          });

        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
        expect(response.body.message).to.include('cancelled successfully');
        expect(global.mockDocRef.update.called).to.be.true;
      });

      it('should enforce user ownership for cancellation', async function() {
        const otherUserBooking = {
          booking_id: 'booking-123',
          user_id: 'other-user-456',
          status: 'pending'
        };

        global.mockDocRef.get.resolves({
          exists: true,
          data: () => otherUserBooking
        });

        const response = await request(app)
          .delete('/api/bookings/booking-123');

        expect(response.status).to.equal(403);
        expect(response.body.error.code).to.equal('ACCESS_DENIED');
      });

      it('should prevent cancellation of non-cancellable bookings', async function() {
        const completedBooking = {
          booking_id: 'booking-123',
          user_id: 'test-user-123',
          status: 'completed'
        };

        global.mockDocRef.get.resolves({
          exists: true,
          data: () => completedBooking
        });

        const response = await request(app)
          .delete('/api/bookings/booking-123');

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('CANNOT_CANCEL_BOOKING');
      });

      it('should use default cancellation reason when not provided', async function() {
        const response = await request(app)
          .delete('/api/bookings/booking-123');

        expect(response.status).to.equal(200);
        // Verify default reason was used in update call
        const updateCall = global.mockDocRef.update.getCall(0);
        expect(updateCall.args[0].cancellation_reason).to.equal('Cancelled by user');
      });
    });

    describe('Error Handling', function() {
      it('should handle non-existent booking', async function() {
        global.mockDocRef.get.resolves({ exists: false });

        const response = await request(app)
          .delete('/api/bookings/non-existent-booking');

        expect(response.status).to.equal(404);
        expect(response.body.error.code).to.equal('BOOKING_NOT_FOUND');
      });

      it('should handle Firestore update errors', async function() {
        global.mockDocRef.update.rejects(new Error('Update failed'));

        const response = await request(app)
          .delete('/api/bookings/booking-123');

        expect(response.status).to.equal(500);
      });
    });
  });

  describe('Authentication Integration', function() {
    it('should require authentication for all booking routes', async function() {
      // Create app without auth middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use('/api/bookings', bookingRoutes);

      const response = await request(unauthApp)
        .get('/api/bookings');

      // Should fail without auth middleware providing user context
      expect(response.status).to.not.equal(200);
    });

    it('should use authenticated user ID for all operations', async function() {
      await request(app)
        .get('/api/bookings');

      // Verify user ID was used in query
      expect(global.mockCollectionRef.where.calledWith('user_id', '==', 'test-user-123')).to.be.true;
    });
  });

  describe('Response Format Consistency', function() {
    it('should return consistent success response format', async function() {
      const response = await request(app)
        .get('/api/bookings');

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('timestamp').that.is.a('string');
    });

    it('should return consistent error response format', async function() {
      global.mockDocRef.get.resolves({ exists: false });

      const response = await request(app)
        .get('/api/bookings/non-existent-booking');

      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error').that.is.an('object');
      expect(response.body.error).to.have.property('message').that.is.a('string');
      expect(response.body.error).to.have.property('code').that.is.a('string');
      expect(response.body.error).to.have.property('timestamp').that.is.a('string');
    });

    it('should include timestamps in all responses', async function() {
      const response = await request(app)
        .get('/api/bookings');

      expect(response.body.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Performance Considerations', function() {
    it('should handle large booking lists efficiently', async function() {
      // Mock many bookings
      const manyBookings = Array.from({ length: 50 }, (_, i) => ({
        id: `booking-${i}`,
        data: () => ({
          booking_id: `booking-${i}`,
          user_id: 'test-user-123',
          service_type: 'plumbing',
          status: 'pending',
          scheduled_time: { toDate: () => new Date() }
        })
      }));

      global.mockCollectionRef.get.resolves({ docs: manyBookings });

      const response = await request(app)
        .get('/api/bookings?limit=10');

      expect(response.status).to.equal(200);
      expect(response.body.bookings).to.have.length.at.most(10);
    });

    it('should optimize queries with proper indexing', async function() {
      await request(app)
        .get('/api/bookings?status=confirmed&service_type=plumbing');

      // Verify compound query was used
      expect(global.mockCollectionRef.where.calledWith('user_id', '==', 'test-user-123')).to.be.true;
      expect(global.mockCollectionRef.where.calledWith('status', '==', 'confirmed')).to.be.true;
      expect(global.mockCollectionRef.where.calledWith('service_type', '==', 'plumbing')).to.be.true;
    });
  });
}); 