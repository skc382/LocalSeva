const { expect } = require('chai');
const sinon = require('sinon');

describe('searchVendors Function', function() {
  let searchVendors;
  let mockContext;
  let mockData;

  beforeEach(function() {
    // Reset all mocks
    sinon.resetHistory();
    
    // Load the function after mocks are set up
    searchVendors = require('../../functions/searchVendors');
    
    // Setup mock context
    mockContext = {
      auth: {
        uid: 'test-user-123',
        token: {
          phone_number: '+919876543210'
        }
      }
    };

    // Setup mock data
    mockData = {
      service_type: 'plumbing',
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 3
    };

    // Setup mock vendor data
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
      verified: true
    };

    // Setup Firestore mocks
    global.mockCollectionRef.get.resolves({
      docs: [{
        id: 'vendor-123',
        data: () => mockVendorData
      }]
    });
  });

  describe('Authentication Validation', function() {
    it('should throw error when user is not authenticated', async function() {
      const unauthenticatedContext = { auth: null };
      
      try {
        await searchVendors(mockData, unauthenticatedContext);
        expect.fail('Should have thrown authentication error');
      } catch (error) {
        expect(error.code).to.equal('unauthenticated');
        expect(error.message).to.include('authenticated');
      }
    });

    it('should proceed when user is properly authenticated', async function() {
      const result = await searchVendors(mockData, mockContext);
      expect(result).to.have.property('success', true);
    });
  });

  describe('Input Validation', function() {
    it('should throw error when service_type is missing', async function() {
      const invalidData = { ...mockData };
      delete invalidData.service_type;
      
      try {
        await searchVendors(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('service_type is required');
      }
    });

    it('should throw error when latitude is missing', async function() {
      const invalidData = { ...mockData };
      delete invalidData.latitude;
      
      try {
        await searchVendors(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('location');
      }
    });

    it('should throw error when longitude is missing', async function() {
      const invalidData = { ...mockData };
      delete invalidData.longitude;
      
      try {
        await searchVendors(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('location');
      }
    });

    it('should throw error for invalid latitude values', async function() {
      const invalidData = { ...mockData, latitude: 95 }; // Invalid latitude
      
      try {
        await searchVendors(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Invalid latitude');
      }
    });

    it('should throw error for invalid longitude values', async function() {
      const invalidData = { ...mockData, longitude: 185 }; // Invalid longitude
      
      try {
        await searchVendors(invalidData, mockContext);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.code).to.equal('invalid-argument');
        expect(error.message).to.include('Invalid latitude');
      }
    });

    it('should use default radius when not provided', async function() {
      const dataWithoutRadius = { ...mockData };
      delete dataWithoutRadius.radius;
      
      const result = await searchVendors(dataWithoutRadius, mockContext);
      expect(result.search_params.radius).to.equal(3); // Default radius
    });

    it('should limit radius to maximum 10km', async function() {
      const dataWithLargeRadius = { ...mockData, radius: 15 };
      
      const result = await searchVendors(dataWithLargeRadius, mockContext);
      expect(result.search_params.radius).to.equal(10); // Max radius
    });
  });

  describe('Vendor Search Logic', function() {
    it('should successfully search vendors with valid parameters', async function() {
      const result = await searchVendors(mockData, mockContext);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('vendors');
      expect(result.vendors).to.be.an('array');
      expect(result).to.have.property('search_params');
      expect(result.search_params.service_type).to.equal('plumbing');
    });

    it('should filter vendors by service type', async function() {
      // Mock Firestore to verify service_type filter
      global.mockCollectionRef.where.resetHistory();
      
      await searchVendors(mockData, mockContext);
      
      expect(global.mockCollectionRef.where.calledWith('service_type', '==', 'plumbing')).to.be.true;
      expect(global.mockCollectionRef.where.calledWith('is_active', '==', true)).to.be.true;
    });

    it('should use geohash bounds for location queries', async function() {
      const geofire = require('geofire-common');
      
      await searchVendors(mockData, mockContext);
      
      expect(geofire.geohashQueryBounds.called).to.be.true;
      expect(geofire.geohashQueryBounds.calledWith([12.9716, 77.5946], 3000)).to.be.true; // 3km in meters
    });

    it('should calculate distance between user and vendors', async function() {
      const geofire = require('geofire-common');
      
      await searchVendors(mockData, mockContext);
      
      expect(geofire.distanceBetween.called).to.be.true;
    });

    it('should return empty array when no vendors found', async function() {
      // Mock empty result
      global.mockCollectionRef.get.resolves({ docs: [] });
      
      const result = await searchVendors(mockData, mockContext);
      
      expect(result.success).to.be.true;
      expect(result.vendors).to.be.an('array').that.is.empty;
      expect(result.message).to.include('No plumbing vendors found');
    });

    it('should skip vendors without location data', async function() {
      const vendorWithoutLocation = {
        id: 'vendor-no-location',
        name: 'Test Vendor',
        service_type: 'plumbing',
        // Missing location data
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

      const result = await searchVendors(mockData, mockContext);
      
      expect(result.vendors).to.be.an('array').that.is.empty;
    });
  });

  describe('Vendor Sorting', function() {
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

    it('should sort vendors by rating (descending) as primary criteria', async function() {
      const result = await searchVendors(mockData, mockContext);
      
      expect(result.vendors).to.have.length.greaterThan(0);
      // First vendor should have highest rating
      if (result.vendors.length > 1) {
        expect(result.vendors[0].ratings).to.be.at.least(result.vendors[1].ratings);
      }
    });

    it('should limit results to top 5 vendors', async function() {
      // Create more than 5 vendors
      const manyVendors = Array.from({ length: 8 }, (_, i) => ({
        id: `vendor-${i}`,
        name: `Vendor ${i}`,
        service_type: 'plumbing',
        location: { latitude: 12.9716, longitude: 77.5946 },
        price: 500 + i * 50,
        ratings: 4.0 + (i * 0.1),
        rating_count: 10,
        is_active: true
      }));

      global.mockCollectionRef.get.resolves({
        docs: manyVendors.map(vendor => ({
          id: vendor.id,
          data: () => vendor
        }))
      });

      const result = await searchVendors(mockData, mockContext);
      
      expect(result.vendors).to.have.length.at.most(5);
      expect(result.returned_count).to.equal(Math.min(5, result.total_found));
    });
  });

  describe('Response Format', function() {
    it('should return properly formatted response', async function() {
      const result = await searchVendors(mockData, mockContext);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('vendors').that.is.an('array');
      expect(result).to.have.property('total_found').that.is.a('number');
      expect(result).to.have.property('returned_count').that.is.a('number');
      expect(result).to.have.property('search_params').that.is.an('object');
      expect(result).to.have.property('timestamp').that.is.a('string');
    });

    it('should include all required vendor fields', async function() {
      const result = await searchVendors(mockData, mockContext);
      
      if (result.vendors.length > 0) {
        const vendor = result.vendors[0];
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
      const result = await searchVendors(mockData, mockContext);
      
      expect(result.search_params).to.deep.include({
        service_type: 'plumbing',
        location: { latitude: 12.9716, longitude: 77.5946 },
        radius: 3
      });
    });
  });

  describe('Error Handling', function() {
    it('should handle Firestore query errors gracefully', async function() {
      global.mockCollectionRef.get.rejects(new Error('Firestore error'));
      
      try {
        await searchVendors(mockData, mockContext);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.code).to.equal('internal');
        expect(error.message).to.include('Failed to search vendors');
      }
    });

    it('should handle MapMyIndia API errors gracefully', async function() {
      // Mock axios to simulate API error
      const axios = require('axios');
      axios.get.rejects(new Error('API error'));
      
      // Should still work with fallback distance calculation
      const result = await searchVendors(mockData, mockContext);
      expect(result).to.have.property('success', true);
    });

    it('should handle invalid vendor data gracefully', async function() {
      const invalidVendorData = {
        id: 'invalid-vendor',
        name: 'Invalid Vendor',
        service_type: 'plumbing',
        // Missing required fields
        is_active: true
      };

      global.mockCollectionRef.get.resolves({
        docs: [{
          id: 'invalid-vendor',
          data: () => invalidVendorData
        }]
      });

      const result = await searchVendors(mockData, mockContext);
      
      // Should handle gracefully and return empty results
      expect(result.success).to.be.true;
      expect(result.vendors).to.be.an('array');
    });
  });

  describe('Analytics Logging', function() {
    it('should log search analytics', async function() {
      await searchVendors(mockData, mockContext);
      
      // Verify analytics collection was called
      expect(global.mockFirestore.collection.calledWith('search_analytics')).to.be.true;
    });

    it('should include user and search details in analytics', async function() {
      await searchVendors(mockData, mockContext);
      
      // Verify add was called on analytics collection
      expect(global.mockCollectionRef.add.called).to.be.true;
    });
  });
}); 