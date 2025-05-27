const { expect } = require('chai');
const sinon = require('sinon');

describe('Auth Middleware', function() {
  let authMiddleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(function() {
    // Reset all mocks
    sinon.resetHistory();
    
    // Load the middleware after mocks are set up
    authMiddleware = require('../../middleware/auth');
    
    // Setup mock request object
    mockReq = {
      headers: {},
      user: null,
      userId: null,
      phoneNumber: null
    };
    
    // Setup mock response object
    mockRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis()
    };
    
    // Setup mock next function
    mockNext = sinon.stub();

    // Setup default successful token verification
    global.mockAuth.verifyIdToken.resolves({
      uid: 'test-user-123',
      phone_number: '+919876543210',
      name: 'Test User',
      email: 'test@example.com'
    });

    // Setup default user document response
    global.mockDocRef.get.resolves({
      exists: true,
      data: () => ({
        user_id: 'test-user-123',
        name: 'Test User',
        phone_number: '+919876543210',
        created_at: new Date(),
        is_active: true
      }),
      ref: {
        update: sinon.stub().resolves()
      }
    });
  });

  describe('Authorization Header Validation', function() {
    it('should reject requests without authorization header', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'UNAUTHORIZED',
          message: sinon.match(/authorization header/)
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should reject requests with invalid authorization header format', async function() {
      mockReq.headers.authorization = 'InvalidFormat token123';
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'UNAUTHORIZED',
          message: sinon.match(/authorization header/)
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should reject requests with Bearer but no token', async function() {
      mockReq.headers.authorization = 'Bearer ';
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'UNAUTHORIZED',
          message: sinon.match(/authentication token/)
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should extract token from valid authorization header', async function() {
      mockReq.headers.authorization = 'Bearer valid-token-123';
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(global.mockAuth.verifyIdToken.calledWith('valid-token-123')).to.be.true;
      expect(mockNext.called).to.be.true;
    });
  });

  describe('Token Verification', function() {
    beforeEach(function() {
      mockReq.headers.authorization = 'Bearer valid-token-123';
    });

    it('should successfully verify valid Firebase token', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(global.mockAuth.verifyIdToken.called).to.be.true;
      expect(mockNext.called).to.be.true;
      expect(mockReq.userId).to.equal('test-user-123');
      expect(mockReq.phoneNumber).to.equal('+919876543210');
    });

    it('should handle expired token error', async function() {
      const expiredError = new Error('Token expired');
      expiredError.code = 'auth/id-token-expired';
      global.mockAuth.verifyIdToken.rejects(expiredError);
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'TOKEN_EXPIRED',
          message: sinon.match(/expired/)
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should handle revoked token error', async function() {
      const revokedError = new Error('Token revoked');
      revokedError.code = 'auth/id-token-revoked';
      global.mockAuth.verifyIdToken.rejects(revokedError);
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'TOKEN_REVOKED',
          message: sinon.match(/revoked/)
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should handle invalid token error', async function() {
      const invalidError = new Error('Invalid token');
      invalidError.code = 'auth/invalid-id-token';
      global.mockAuth.verifyIdToken.rejects(invalidError);
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'INVALID_TOKEN',
          message: sinon.match(/Invalid/)
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should handle generic authentication service errors', async function() {
      global.mockAuth.verifyIdToken.rejects(new Error('Service unavailable'));
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(500)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'AUTH_SERVICE_ERROR',
          message: sinon.match(/service error/)
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });
  });

  describe('Phone Number Verification', function() {
    beforeEach(function() {
      mockReq.headers.authorization = 'Bearer valid-token-123';
    });

    it('should reject users without verified phone number', async function() {
      global.mockAuth.verifyIdToken.resolves({
        uid: 'test-user-123',
        // Missing phone_number
        name: 'Test User',
        email: 'test@example.com'
      });
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(403)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'PHONE_VERIFICATION_REQUIRED',
          message: sinon.match(/Phone number verification/)
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should accept users with verified phone number', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockNext.called).to.be.true;
      expect(mockReq.phoneNumber).to.equal('+919876543210');
    });
  });

  describe('User Document Management', function() {
    beforeEach(function() {
      mockReq.headers.authorization = 'Bearer valid-token-123';
    });

    it('should retrieve existing user document', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(global.mockFirestore.collection.calledWith('users')).to.be.true;
      expect(global.mockCollectionRef.doc.calledWith('test-user-123')).to.be.true;
      expect(global.mockDocRef.get.called).to.be.true;
      expect(mockNext.called).to.be.true;
    });

    it('should create user document if it does not exist', async function() {
      global.mockDocRef.get.resolves({ exists: false });
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(global.mockDocRef.set.called).to.be.true;
      expect(mockNext.called).to.be.true;
      
      // Verify user data structure
      const setCall = global.mockDocRef.set.getCall(0);
      const userData = setCall.args[0];
      expect(userData).to.have.property('user_id', 'test-user-123');
      expect(userData).to.have.property('phone_number', '+919876543210');
      expect(userData).to.have.property('language', 'en');
      expect(userData).to.have.property('is_active', true);
    });

    it('should update last_seen timestamp for existing users', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(global.mockDocRef.get().ref.update.called).to.be.true;
      const updateCall = global.mockDocRef.get().ref.update.getCall(0);
      expect(updateCall.args[0]).to.have.property('last_seen');
    });

    it('should handle Firestore errors gracefully', async function() {
      global.mockDocRef.get.rejects(new Error('Firestore error'));
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(500)).to.be.true;
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          code: 'AUTH_SERVICE_ERROR'
        })
      }))).to.be.true;
      expect(mockNext.called).to.be.false;
    });
  });

  describe('Request Object Population', function() {
    beforeEach(function() {
      mockReq.headers.authorization = 'Bearer valid-token-123';
    });

    it('should populate request with user information', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockReq.userId).to.equal('test-user-123');
      expect(mockReq.phoneNumber).to.equal('+919876543210');
      expect(mockReq.user).to.be.an('object');
      expect(mockReq.user).to.have.property('uid', 'test-user-123');
      expect(mockReq.user).to.have.property('phone_number', '+919876543210');
    });

    it('should merge Firebase token data with Firestore user data', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockReq.user).to.have.property('uid', 'test-user-123'); // From token
      expect(mockReq.user).to.have.property('user_id', 'test-user-123'); // From Firestore
      expect(mockReq.user).to.have.property('phone_number', '+919876543210'); // Both
      expect(mockReq.user).to.have.property('is_active', true); // From Firestore
    });
  });

  describe('Response Format', function() {
    it('should return consistent error response format', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.json.calledWith(sinon.match({
        error: sinon.match({
          message: sinon.match.string,
          code: sinon.match.string,
          timestamp: sinon.match.string
        })
      }))).to.be.true;
    });

    it('should include timestamp in error responses', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      const jsonCall = mockRes.json.getCall(0);
      if (jsonCall) {
        const response = jsonCall.args[0];
        expect(response.error.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });
  });

  describe('Edge Cases', function() {
    it('should handle malformed authorization header', async function() {
      mockReq.headers.authorization = 'Bearer';
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should handle empty token after Bearer', async function() {
      mockReq.headers.authorization = 'Bearer ';
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should handle case-sensitive Bearer keyword', async function() {
      mockReq.headers.authorization = 'bearer valid-token-123';
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockNext.called).to.be.false;
    });

    it('should handle null/undefined authorization header', async function() {
      mockReq.headers.authorization = null;
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status.calledWith(401)).to.be.true;
      expect(mockNext.called).to.be.false;
    });
  });

  describe('Security Considerations', function() {
    beforeEach(function() {
      mockReq.headers.authorization = 'Bearer valid-token-123';
    });

    it('should not expose sensitive token information in errors', async function() {
      const invalidError = new Error('Invalid token');
      invalidError.code = 'auth/invalid-id-token';
      global.mockAuth.verifyIdToken.rejects(invalidError);
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      const jsonCall = mockRes.json.getCall(0);
      const response = jsonCall.args[0];
      expect(JSON.stringify(response)).to.not.include('valid-token-123');
    });

    it('should validate token format before processing', async function() {
      mockReq.headers.authorization = 'Bearer <script>alert("xss")</script>';
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      // Should attempt to verify the token (Firebase will handle validation)
      expect(global.mockAuth.verifyIdToken.called).to.be.true;
    });

    it('should not leak user data in error responses', async function() {
      global.mockDocRef.get.rejects(new Error('Database error'));
      
      await authMiddleware(mockReq, mockRes, mockNext);
      
      const jsonCall = mockRes.json.getCall(0);
      const response = jsonCall.args[0];
      expect(response.error.message).to.not.include('test-user-123');
      expect(response.error.message).to.not.include('+919876543210');
    });
  });

  describe('Performance Considerations', function() {
    beforeEach(function() {
      mockReq.headers.authorization = 'Bearer valid-token-123';
    });

    it('should minimize database calls for existing users', async function() {
      await authMiddleware(mockReq, mockRes, mockNext);
      
      // Should only call get once and update once for existing users
      expect(global.mockDocRef.get.callCount).to.equal(1);
      expect(global.mockDocRef.get().ref.update.callCount).to.equal(1);
      expect(global.mockDocRef.set.called).to.be.false; // No creation for existing user
    });

    it('should handle concurrent requests efficiently', async function() {
      // Simulate multiple concurrent requests
      const promises = [
        authMiddleware(mockReq, mockRes, mockNext),
        authMiddleware(mockReq, mockRes, mockNext),
        authMiddleware(mockReq, mockRes, mockNext)
      ];
      
      await Promise.all(promises);
      
      // Each request should verify the token independently
      expect(global.mockAuth.verifyIdToken.callCount).to.equal(3);
    });
  });
}); 