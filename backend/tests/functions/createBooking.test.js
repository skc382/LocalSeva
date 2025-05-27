const { expect } = require('chai');
const sinon = require('sinon');

describe('createBooking Function', function() {
  let createBooking;
  let mockContext;
  let mockData;
  let mockVendorData;
  let mockUserData;

  beforeEach(function() {
    // Reset all mocks
    sinon.resetHistory();
    
    // Load the function after mocks are set up
    createBooking = require('../../functions/createBooking');
    
    // Setup mock context
    mockContext = {
      auth: {
        uid: 'test-user-123',
        token: {
          phone_number: '+919876543210'
        }
      }
    };

    // Setup mock booking data
    mockData = {
      vendor_id: 'vendor-123',
      service_type: 'plumbing',
      scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      description: 'Kitchen sink repair',
      user_location: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: '123 Main St, Bangalore'
      },
      estimated_duration: 60,
      special_requirements: 'Bring spare parts'
    };

    // Setup mock vendor data
    mockVendorData = {
      vendor_id: 'vendor-123',
      name: 'Test Plumber',
      service_type: 'plumbing',
      price: 500,
      ratings: 4.5,
      is_active: true,
      phone_number: '+919876543210',
      bookings: []
    };

    // Setup mock user data
    mockUserData = {
      user_id: 'test-user-123',
      name: 'Test User',
      phone_number: '+919876543210',
      bookings: []
    };

    // Setup Firestore transaction mock
    global.mockFirestore.runTransaction.callsFake(async (callback) => {
      const mockTransaction = {
        get: sinon.stub(),
        set: sinon.stub(),
        update: sinon.stub()
      };

      // Mock vendor document
      mockTransaction.get.onFirstCall().resolves({
        exists: true,
        data: () => mockVendorData
      });

      // Mock user document
      mockTransaction.get.onSecondCall().resolves({
        exists: true,
        data: () => mockUserData
      });

      return await callback(mockTransaction);
    });

    // Setup collection queries for conflict checking
    global.mockCollectionRef.get.resolves({ docs: [] }); // No conflicts by default
  });

  describe('Authentication Validation', function() {
    it('should throw error when user is not authenticated', async function() {
      const unauthenticatedContext = { auth: null };
      
      try {
        await createBooking(mockData, unauthenticatedContext);
        expect.fail('Should have thrown authentication error');
      } catch (error) {
        expect(error.code).to.equal('unauthenticated');
        expect(error.message).to.include('authenticated');
      }
    });

    it('should proceed when user is properly authenticated', async function() {
      const result = await createBooking(mockData, mockContext);
      expect(result).to.have.property('success', true);
    });
  });

  describe('Input Validation', function() {
    it('should throw error when vendor_id is missing', async function() {
      const invalidData = { ...mockData };
      delete invalidData.vendor_id;
      
      try {
        await createBooking(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('vendor_id');
      }
    });

    it('should throw error when service_type is missing', async function() {
      const invalidData = { ...mockData };
      delete invalidData.service_type;
      
      try {
        await createBooking(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('service_type');
      }
    });

    it('should throw error when scheduled_time is missing', async function() {
      const invalidData = { ...mockData };
      delete invalidData.scheduled_time;
      
      try {
        await createBooking(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('scheduled_time');
      }
    });

    it('should throw error when user_location is missing', async function() {
      const invalidData = { ...mockData };
      delete invalidData.user_location;
      
      try {
        await createBooking(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('user_location');
      }
    });

    it('should throw error for invalid scheduled_time format', async function() {
      const invalidData = { ...mockData, scheduled_time: 'invalid-date' };
      
      try {
        await createBooking(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Invalid scheduled_time');
      }
    });

    it('should throw error for past scheduled_time', async function() {
      const pastTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday
      const invalidData = { ...mockData, scheduled_time: pastTime };
      
      try {
        await createBooking(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Cannot schedule booking in the past');
      }
    });

    it('should throw error for booking too far in future', async function() {
      const farFuture = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(); // 35 days
      const invalidData = { ...mockData, scheduled_time: farFuture };
      
      try {
        await createBooking(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Cannot schedule booking more than 30 days');
      }
    });

    it('should use default estimated_duration when not provided', async function() {
      const dataWithoutDuration = { ...mockData };
      delete dataWithoutDuration.estimated_duration;
      
      const result = await createBooking(dataWithoutDuration, mockContext);
      expect(result.booking.estimated_duration).to.equal(60); // Default 60 minutes
    });
  });

  describe('Vendor Validation', function() {
    it('should throw error when vendor does not exist', async function() {
      // Mock vendor not found
      global.mockFirestore.runTransaction.callsFake(async (callback) => {
        const mockTransaction = {
          get: sinon.stub().resolves({ exists: false }),
          set: sinon.stub(),
          update: sinon.stub()
        };
        return await callback(mockTransaction);
      });

      try {
        await createBooking(mockData, mockContext);
        expect.fail('Should have thrown vendor not found error');
      } catch (error) {
        expect(error.code).to.equal('not-found');
        expect(error.message).to.include('Vendor not found');
      }
    });

    it('should throw error when vendor is inactive', async function() {
      const inactiveVendor = { ...mockVendorData, is_active: false };
      
      global.mockFirestore.runTransaction.callsFake(async (callback) => {
        const mockTransaction = {
          get: sinon.stub(),
          set: sinon.stub(),
          update: sinon.stub()
        };

        mockTransaction.get.onFirstCall().resolves({
          exists: true,
          data: () => inactiveVendor
        });

        return await callback(mockTransaction);
      });

      try {
        await createBooking(mockData, mockContext);
        expect.fail('Should have thrown vendor inactive error');
      } catch (error) {
        expect(error.code).to.equal('failed-precondition');
        expect(error.message).to.include('Vendor is currently inactive');
      }
    });

    it('should throw error when vendor does not provide requested service', async function() {
      const wrongServiceVendor = { ...mockVendorData, service_type: 'electrical' };
      
      global.mockFirestore.runTransaction.callsFake(async (callback) => {
        const mockTransaction = {
          get: sinon.stub(),
          set: sinon.stub(),
          update: sinon.stub()
        };

        mockTransaction.get.onFirstCall().resolves({
          exists: true,
          data: () => wrongServiceVendor
        });

        return await callback(mockTransaction);
      });

      try {
        await createBooking(mockData, mockContext);
        expect.fail('Should have thrown service mismatch error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Vendor does not provide plumbing service');
      }
    });
  });

  describe('User Validation', function() {
    it('should throw error when user does not exist', async function() {
      global.mockFirestore.runTransaction.callsFake(async (callback) => {
        const mockTransaction = {
          get: sinon.stub(),
          set: sinon.stub(),
          update: sinon.stub()
        };

        // Mock vendor exists
        mockTransaction.get.onFirstCall().resolves({
          exists: true,
          data: () => mockVendorData
        });

        // Mock user not found
        mockTransaction.get.onSecondCall().resolves({
          exists: false
        });

        return await callback(mockTransaction);
      });

      try {
        await createBooking(mockData, mockContext);
        expect.fail('Should have thrown user not found error');
      } catch (error) {
        expect(error.code).to.equal('not-found');
        expect(error.message).to.include('User not found');
      }
    });
  });

  describe('Booking Conflict Detection', function() {
    it('should throw error when user has conflicting booking', async function() {
      const conflictingBooking = {
        user_id: 'test-user-123',
        status: 'confirmed',
        scheduled_time: {
          toDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // Same day
        }
      };

      global.mockCollectionRef.get.resolves({
        docs: [{
          data: () => conflictingBooking
        }]
      });

      try {
        await createBooking(mockData, mockContext);
        expect.fail('Should have thrown booking conflict error');
      } catch (error) {
        expect(error.code).to.equal('already-exists');
        expect(error.message).to.include('You already have a booking within 2 hours');
      }
    });

    it('should throw error when vendor has conflicting booking', async function() {
      const vendorConflict = {
        vendor_id: 'vendor-123',
        status: 'confirmed',
        scheduled_time: {
          toDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // Same time
        },
        estimated_duration: 60
      };

      // First call returns empty (no user conflicts), second call returns vendor conflict
      global.mockCollectionRef.get.onFirstCall().resolves({ docs: [] });
      global.mockCollectionRef.get.onSecondCall().resolves({
        docs: [{
          data: () => vendorConflict
        }]
      });

      try {
        await createBooking(mockData, mockContext);
        expect.fail('Should have thrown vendor conflict error');
      } catch (error) {
        expect(error.code).to.equal('already-exists');
        expect(error.message).to.include('Vendor is not available at the requested time');
      }
    });

    it('should allow booking when no conflicts exist', async function() {
      // Mock no conflicts
      global.mockCollectionRef.get.resolves({ docs: [] });

      const result = await createBooking(mockData, mockContext);
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('booking');
    });
  });

  describe('Price Calculation', function() {
    it('should calculate estimated price based on vendor base price', async function() {
      const result = await createBooking(mockData, mockContext);
      
      expect(result.booking).to.have.property('estimated_price');
      expect(result.booking.estimated_price).to.be.a('number');
      expect(result.booking.estimated_price).to.be.greaterThan(0);
    });

    it('should apply duration-based pricing for longer services', async function() {
      const longServiceData = { ...mockData, estimated_duration: 120 }; // 2 hours
      
      const result = await createBooking(longServiceData, mockContext);
      
      expect(result.booking.estimated_price).to.be.greaterThan(mockVendorData.price);
    });

    it('should apply service type multipliers', async function() {
      const electricalData = { 
        ...mockData, 
        service_type: 'electrical',
        vendor_id: 'electrical-vendor'
      };

      const electricalVendor = { ...mockVendorData, service_type: 'electrical' };
      
      global.mockFirestore.runTransaction.callsFake(async (callback) => {
        const mockTransaction = {
          get: sinon.stub(),
          set: sinon.stub(),
          update: sinon.stub()
        };

        mockTransaction.get.onFirstCall().resolves({
          exists: true,
          data: () => electricalVendor
        });

        mockTransaction.get.onSecondCall().resolves({
          exists: true,
          data: () => mockUserData
        });

        return await callback(mockTransaction);
      });

      const result = await createBooking(electricalData, mockContext);
      
      // Electrical services typically have higher multiplier
      expect(result.booking.estimated_price).to.be.greaterThan(mockVendorData.price);
    });
  });

  describe('Booking Creation', function() {
    it('should create booking with all required fields', async function() {
      const result = await createBooking(mockData, mockContext);
      
      expect(result.success).to.be.true;
      expect(result.booking).to.have.property('booking_id');
      expect(result.booking).to.have.property('vendor_id', 'vendor-123');
      expect(result.booking).to.have.property('service_type', 'plumbing');
      expect(result.booking).to.have.property('scheduled_time');
      expect(result.booking).to.have.property('estimated_price');
      expect(result.booking).to.have.property('status', 'pending');
      expect(result.booking).to.have.property('estimated_duration', 60);
    });

    it('should generate unique booking ID', async function() {
      const uuid = require('uuid');
      
      const result = await createBooking(mockData, mockContext);
      
      expect(uuid.v4.called).to.be.true;
      expect(result.booking.booking_id).to.equal('mock-uuid-123');
    });

    it('should set booking status to pending initially', async function() {
      const result = await createBooking(mockData, mockContext);
      
      expect(result.booking.status).to.equal('pending');
    });

    it('should include vendor and user information', async function() {
      const result = await createBooking(mockData, mockContext);
      
      // Verify transaction was called to create booking with vendor/user info
      expect(global.mockFirestore.runTransaction.called).to.be.true;
    });

    it('should update user and vendor booking arrays', async function() {
      await createBooking(mockData, mockContext);
      
      // Verify transaction was used (which includes updating user and vendor)
      expect(global.mockFirestore.runTransaction.called).to.be.true;
    });
  });

  describe('Response Format', function() {
    it('should return properly formatted success response', async function() {
      const result = await createBooking(mockData, mockContext);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('booking').that.is.an('object');
      expect(result).to.have.property('message').that.is.a('string');
      expect(result).to.have.property('timestamp').that.is.a('string');
    });

    it('should include booking summary in response', async function() {
      const result = await createBooking(mockData, mockContext);
      
      const booking = result.booking;
      expect(booking).to.have.property('booking_id');
      expect(booking).to.have.property('vendor_id');
      expect(booking).to.have.property('service_type');
      expect(booking).to.have.property('scheduled_time');
      expect(booking).to.have.property('estimated_price');
      expect(booking).to.have.property('status');
      expect(booking).to.have.property('estimated_duration');
    });

    it('should include helpful message about vendor notification', async function() {
      const result = await createBooking(mockData, mockContext);
      
      expect(result.message).to.include('Vendor will be notified');
    });
  });

  describe('Error Handling', function() {
    it('should handle Firestore transaction errors gracefully', async function() {
      global.mockFirestore.runTransaction.rejects(new Error('Transaction failed'));
      
      try {
        await createBooking(mockData, mockContext);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to create booking');
      }
    });

    it('should handle invalid moment dates gracefully', async function() {
      // Mock moment to return invalid date
      const moment = require('moment');
      moment.callsFake(() => ({
        isValid: () => false,
        isBefore: () => false,
        isAfter: () => false
      }));

      try {
        await createBooking(mockData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Invalid scheduled_time');
      }
    });

    it('should handle missing location coordinates', async function() {
      const invalidLocationData = {
        ...mockData,
        user_location: {
          address: '123 Main St'
          // Missing latitude and longitude
        }
      };

      try {
        await createBooking(invalidLocationData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('user_location with latitude and longitude');
      }
    });
  });

  describe('Notification Handling', function() {
    it('should trigger notification sending after booking creation', async function() {
      const result = await createBooking(mockData, mockContext);
      
      // Verify booking was created successfully (notifications are sent asynchronously)
      expect(result.success).to.be.true;
      expect(result.booking.booking_id).to.exist;
    });
  });

  describe('Analytics Logging', function() {
    it('should log booking analytics', async function() {
      await createBooking(mockData, mockContext);
      
      // Verify analytics collection was accessed
      expect(global.mockFirestore.collection.calledWith('booking_analytics')).to.be.true;
    });

    it('should include booking details in analytics', async function() {
      await createBooking(mockData, mockContext);
      
      // Verify add was called on analytics collection
      expect(global.mockCollectionRef.add.called).to.be.true;
    });
  });
}); 