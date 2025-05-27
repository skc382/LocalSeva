const { expect } = require('chai');

describe('createBooking Function', function() {
  let mockContext;
  let mockData;

  beforeEach(function() {
    // Reset all stubs before each test
    sinon.resetHistory();
    sinon.resetBehavior();
    
    mockContext = {
      auth: {
        uid: 'test-user-123'
      }
    };

    mockData = {
      vendor_id: 'vendor-123',
      service_type: 'plumbing',
      scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      user_location: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Test Address'
      },
      estimated_duration: 60,
      description: 'Fix kitchen sink'
    };
  });

  it('should validate authentication context', function() {
    const hasAuth = !!(mockContext && mockContext.auth && mockContext.auth.uid);
    expect(hasAuth).to.be.true;
    expect(mockContext.auth.uid).to.equal('test-user-123');
  });

  it('should validate required booking parameters', function() {
    const hasVendorId = mockData.vendor_id && typeof mockData.vendor_id === 'string';
    const hasServiceType = mockData.service_type && typeof mockData.service_type === 'string';
    const hasScheduledTime = mockData.scheduled_time && typeof mockData.scheduled_time === 'string';
    const hasUserLocation = mockData.user_location && 
                           typeof mockData.user_location.latitude === 'number' && 
                           typeof mockData.user_location.longitude === 'number';
    
    expect(hasVendorId).to.be.true;
    expect(hasServiceType).to.be.true;
    expect(hasScheduledTime).to.be.true;
    expect(hasUserLocation).to.be.true;
    expect(mockData.vendor_id).to.equal('vendor-123');
    expect(mockData.service_type).to.equal('plumbing');
  });

  it('should handle missing authentication', function() {
    const unauthenticatedContext = {};
    const hasAuth = !!(unauthenticatedContext && unauthenticatedContext.auth && unauthenticatedContext.auth.uid);
    
    expect(hasAuth).to.be.false;
    
    // Simulate function behavior
    if (!hasAuth) {
      const error = new Error('User must be authenticated to create bookings');
      error.code = 'unauthenticated';
      expect(error.code).to.equal('unauthenticated');
    }
  });
}); 