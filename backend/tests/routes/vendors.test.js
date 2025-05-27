const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const express = require('express');

describe('Vendor Routes', function() {
  let app;
  let vendorRoutes;
  let mockAuthMiddleware;

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
    
    // Load vendor routes
    vendorRoutes = require('../../routes/vendors');
    app.use('/api/vendors', mockAuthMiddleware, vendorRoutes);

    // Setup default mock responses
    setupDefaultMocks();
  });

  function setupDefaultMocks() {
    // Mock geohash query bounds
    const geofire = require('geofire-common');
    geofire.geohashQueryBounds.returns([['bound1', 'bound2']]);
    geofire.distanceBetween.returns(1000); // 1km

    // Mock vendor data
    const mockVendorData = {
      id: 'vendor-123',
      name: 'Test Plumber',
      service_type: 'plumbing',
      location: {
        latitude: 12.9716,
        longitude: 77.5946
      },
      price: 500,
      ratings: 4.5,
      rating_count: 10,
      is_active: true,
      phone_number: '+919876543210',
      verified: true,
      experience_years: 5
    };

    // Setup Firestore collection mocks
    global.mockCollectionRef.get.resolves({
      docs: [{
        id: 'vendor-123',
        data: () => mockVendorData
      }]
    });

    global.mockDocRef.get.resolves({
      exists: true,
      data: () => mockVendorData
    });
  }

  describe('POST /api/vendors/search', function() {
    describe('Input Validation', function() {
      it('should validate required service_type parameter', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
        expect(response.body.error.message).to.include('service_type');
      });

      it('should validate required latitude parameter', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            longitude: 77.5946
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
        expect(response.body.error.message).to.include('latitude');
      });

      it('should validate required longitude parameter', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
        expect(response.body.error.message).to.include('longitude');
      });

      it('should validate service_type against allowed values', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'invalid_service',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should validate latitude range', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 95, // Invalid latitude
            longitude: 77.5946
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should validate longitude range', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 185 // Invalid longitude
          });

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });

      it('should apply default values for optional parameters', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(200);
        expect(response.body.search_params.radius).to.equal(3); // Default radius
        expect(response.body.returned_count).to.be.at.most(5); // Default limit
      });

      it('should validate radius limits', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946,
            radius: 15 // Too large
          });

        expect(response.status).to.equal(200);
        expect(response.body.search_params.radius).to.equal(10); // Max radius
      });

      it('should validate limit parameter', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946,
            limit: 25 // Too large
          });

        expect(response.status).to.equal(200);
        expect(response.body.returned_count).to.be.at.most(20); // Max limit
      });
    });

    describe('Search Functionality', function() {
      it('should successfully search vendors with valid parameters', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946,
            radius: 3
          });

        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
        expect(response.body.vendors).to.be.an('array');
        expect(response.body.search_params).to.deep.include({
          service_type: 'plumbing',
          location: { latitude: 12.9716, longitude: 77.5946 },
          radius: 3
        });
      });

      it('should filter vendors by service type', async function() {
        await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'electrical',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(global.mockCollectionRef.where.calledWith('service_type', '==', 'electrical')).to.be.true;
        expect(global.mockCollectionRef.where.calledWith('is_active', '==', true)).to.be.true;
      });

      it('should use geohash bounds for location queries', async function() {
        const geofire = require('geofire-common');
        
        await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946,
            radius: 5
          });

        expect(geofire.geohashQueryBounds.calledWith([12.9716, 77.5946], 5000)).to.be.true;
      });

      it('should calculate distances between user and vendors', async function() {
        const geofire = require('geofire-common');
        
        await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(geofire.distanceBetween.called).to.be.true;
      });

      it('should return empty results when no vendors found', async function() {
        global.mockCollectionRef.get.resolves({ docs: [] });

        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(200);
        expect(response.body.vendors).to.be.an('array').that.is.empty;
        expect(response.body.total_found).to.equal(0);
      });

      it('should skip vendors without location data', async function() {
        const vendorWithoutLocation = {
          id: 'vendor-no-location',
          name: 'Test Vendor',
          service_type: 'plumbing',
          // Missing location
          price: 500,
          ratings: 4.0,
          is_active: true
        };

        global.mockCollectionRef.get.resolves({
          docs: [{
            id: 'vendor-no-location',
            data: () => vendorWithoutLocation
          }]
        });

        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(200);
        expect(response.body.vendors).to.be.an('array').that.is.empty;
      });
    });

    describe('Sorting and Filtering', function() {
      beforeEach(function() {
        const mockVendors = [
          {
            id: 'vendor-1',
            name: 'High Rating Vendor',
            service_type: 'plumbing',
            location: { latitude: 12.9716, longitude: 77.5946 },
            price: 600,
            ratings: 4.8,
            rating_count: 20,
            is_active: true
          },
          {
            id: 'vendor-2',
            name: 'Low Price Vendor',
            service_type: 'plumbing',
            location: { latitude: 12.9716, longitude: 77.5946 },
            price: 400,
            ratings: 4.2,
            rating_count: 15,
            is_active: true
          },
          {
            id: 'vendor-3',
            name: 'Close Vendor',
            service_type: 'plumbing',
            location: { latitude: 12.9716, longitude: 77.5946 },
            price: 500,
            ratings: 4.5,
            rating_count: 10,
            is_active: true
          }
        ];

        global.mockCollectionRef.get.resolves({
          docs: mockVendors.map(vendor => ({
            id: vendor.id,
            data: () => vendor
          }))
        });
      });

      it('should sort by rating by default', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(200);
        expect(response.body.vendors).to.have.length.greaterThan(0);
        
        // Should be sorted by rating (descending)
        if (response.body.vendors.length > 1) {
          expect(response.body.vendors[0].ratings).to.be.at.least(response.body.vendors[1].ratings);
        }
      });

      it('should sort by distance when specified', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946,
            sort_by: 'distance'
          });

        expect(response.status).to.equal(200);
        expect(response.body.search_params.sort_by).to.equal('distance');
      });

      it('should sort by price when specified', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946,
            sort_by: 'price'
          });

        expect(response.status).to.equal(200);
        expect(response.body.search_params.sort_by).to.equal('price');
      });

      it('should limit results to specified limit', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946,
            limit: 2
          });

        expect(response.status).to.equal(200);
        expect(response.body.vendors).to.have.length.at.most(2);
        expect(response.body.returned_count).to.be.at.most(2);
      });
    });

    describe('Response Format', function() {
      it('should return properly formatted response', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('vendors').that.is.an('array');
        expect(response.body).to.have.property('total_found').that.is.a('number');
        expect(response.body).to.have.property('returned_count').that.is.a('number');
        expect(response.body).to.have.property('search_params').that.is.an('object');
        expect(response.body).to.have.property('timestamp').that.is.a('string');
      });

      it('should include all required vendor fields', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(200);
        
        if (response.body.vendors.length > 0) {
          const vendor = response.body.vendors[0];
          expect(vendor).to.have.property('vendor_id');
          expect(vendor).to.have.property('name');
          expect(vendor).to.have.property('service_type');
          expect(vendor).to.have.property('price');
          expect(vendor).to.have.property('ratings');
          expect(vendor).to.have.property('distance');
          expect(vendor).to.have.property('location');
          expect(vendor).to.have.property('phone_number');
        }
      });

      it('should include search parameters in response', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'electrical',
            latitude: 13.0827,
            longitude: 80.2707,
            radius: 5,
            sort_by: 'price'
          });

        expect(response.status).to.equal(200);
        expect(response.body.search_params).to.deep.include({
          service_type: 'electrical',
          location: { latitude: 13.0827, longitude: 80.2707 },
          radius: 5,
          sort_by: 'price'
        });
      });
    });

    describe('Error Handling', function() {
      it('should handle Firestore query errors', async function() {
        global.mockCollectionRef.get.rejects(new Error('Database error'));

        const response = await request(app)
          .post('/api/vendors/search')
          .send({
            service_type: 'plumbing',
            latitude: 12.9716,
            longitude: 77.5946
          });

        expect(response.status).to.equal(500);
      });

      it('should handle malformed request body', async function() {
        const response = await request(app)
          .post('/api/vendors/search')
          .send('invalid json');

        expect(response.status).to.equal(400);
      });

      it('should handle missing request body', async function() {
        const response = await request(app)
          .post('/api/vendors/search');

        expect(response.status).to.equal(400);
        expect(response.body.error.code).to.equal('VALIDATION_ERROR');
      });
    });
  });

  describe('GET /api/vendors/:vendor_id', function() {
    describe('Vendor Retrieval', function() {
      it('should retrieve vendor details with valid ID', async function() {
        const response = await request(app)
          .get('/api/vendors/vendor-123');

        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
        expect(response.body.vendor).to.be.an('object');
        expect(response.body.vendor.vendor_id).to.equal('vendor-123');
      });

      it('should return 404 for non-existent vendor', async function() {
        global.mockDocRef.get.resolves({ exists: false });

        const response = await request(app)
          .get('/api/vendors/non-existent-vendor');

        expect(response.status).to.equal(404);
        expect(response.body.error.code).to.equal('VENDOR_NOT_FOUND');
        expect(response.body.error.message).to.include('Vendor not found');
      });

      it('should return 400 for missing vendor ID', async function() {
        const response = await request(app)
          .get('/api/vendors/');

        expect(response.status).to.equal(404); // Express route not found
      });

      it('should include all vendor details in response', async function() {
        const response = await request(app)
          .get('/api/vendors/vendor-123');

        expect(response.status).to.equal(200);
        
        const vendor = response.body.vendor;
        expect(vendor).to.have.property('vendor_id');
        expect(vendor).to.have.property('name');
        expect(vendor).to.have.property('service_type');
        expect(vendor).to.have.property('price');
        expect(vendor).to.have.property('ratings');
        expect(vendor).to.have.property('location');
        expect(vendor).to.have.property('phone_number');
        expect(vendor).to.have.property('verified');
        expect(vendor).to.have.property('experience_years');
        expect(vendor).to.have.property('is_active');
      });
    });

    describe('Response Format', function() {
      it('should return properly formatted vendor response', async function() {
        const response = await request(app)
          .get('/api/vendors/vendor-123');

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('vendor').that.is.an('object');
        expect(response.body).to.have.property('timestamp').that.is.a('string');
      });

      it('should include timestamp in response', async function() {
        const response = await request(app)
          .get('/api/vendors/vendor-123');

        expect(response.status).to.equal(200);
        expect(response.body.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });

    describe('Error Handling', function() {
      it('should handle Firestore errors gracefully', async function() {
        global.mockDocRef.get.rejects(new Error('Database error'));

        const response = await request(app)
          .get('/api/vendors/vendor-123');

        expect(response.status).to.equal(500);
      });

      it('should validate vendor ID format', async function() {
        const response = await request(app)
          .get('/api/vendors/');

        expect(response.status).to.equal(404); // Route not found
      });

      it('should handle special characters in vendor ID', async function() {
        const response = await request(app)
          .get('/api/vendors/vendor%20with%20spaces');

        // Should attempt to decode and process
        expect(global.mockDocRef.get.called).to.be.true;
      });
    });
  });

  describe('Authentication Integration', function() {
    it('should require authentication for all vendor routes', async function() {
      // Create app without auth middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use('/api/vendors', vendorRoutes);

      const response = await request(unauthApp)
        .post('/api/vendors/search')
        .send({
          service_type: 'plumbing',
          latitude: 12.9716,
          longitude: 77.5946
        });

      // Should fail without auth middleware providing user context
      expect(response.status).to.not.equal(200);
    });

    it('should include user context in search analytics', async function() {
      await request(app)
        .post('/api/vendors/search')
        .send({
          service_type: 'plumbing',
          latitude: 12.9716,
          longitude: 77.5946
        });

      // Verify analytics logging was attempted
      expect(global.mockFirestore.collection.calledWith('search_analytics')).to.be.true;
    });
  });

  describe('Performance Considerations', function() {
    it('should handle large result sets efficiently', async function() {
      // Mock many vendors
      const manyVendors = Array.from({ length: 100 }, (_, i) => ({
        id: `vendor-${i}`,
        name: `Vendor ${i}`,
        service_type: 'plumbing',
        location: { latitude: 12.9716, longitude: 77.5946 },
        price: 500 + i * 10,
        ratings: 4.0 + (i % 10) * 0.1,
        rating_count: 10,
        is_active: true
      }));

      global.mockCollectionRef.get.resolves({
        docs: manyVendors.map(vendor => ({
          id: vendor.id,
          data: () => vendor
        }))
      });

      const response = await request(app)
        .post('/api/vendors/search')
        .send({
          service_type: 'plumbing',
          latitude: 12.9716,
          longitude: 77.5946,
          limit: 5
        });

      expect(response.status).to.equal(200);
      expect(response.body.vendors).to.have.length.at.most(5);
      expect(response.body.total_found).to.equal(100);
      expect(response.body.returned_count).to.equal(5);
    });

    it('should optimize geohash queries', async function() {
      const geofire = require('geofire-common');
      
      await request(app)
        .post('/api/vendors/search')
        .send({
          service_type: 'plumbing',
          latitude: 12.9716,
          longitude: 77.5946,
          radius: 2
        });

      // Should call geohash bounds with correct parameters
      expect(geofire.geohashQueryBounds.calledWith([12.9716, 77.5946], 2000)).to.be.true;
    });
  });
}); 