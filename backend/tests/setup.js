const sinon = require('sinon');
const chai = require('chai');

// Setup global test utilities
global.expect = chai.expect;
global.sinon = sinon;

// Create comprehensive mocks
const createMocks = () => {
  const mockDocRef = {
    get: sinon.stub(),
    set: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub()
  };

  const mockCollectionRef = {
    doc: sinon.stub().returns(mockDocRef),
    where: sinon.stub().returnsThis(),
    orderBy: sinon.stub().returnsThis(),
    limit: sinon.stub().returnsThis(),
    get: sinon.stub(),
    add: sinon.stub()
  };

  const mockFirestore = {
    collection: sinon.stub().returns(mockCollectionRef),
    doc: sinon.stub().returns(mockDocRef),
    runTransaction: sinon.stub(),
    FieldValue: {
      serverTimestamp: sinon.stub().returns('MOCK_TIMESTAMP'),
      arrayUnion: sinon.stub().callsFake((value) => `ARRAY_UNION(${value})`),
      arrayRemove: sinon.stub().callsFake((value) => `ARRAY_REMOVE(${value})`)
    },
    Timestamp: {
      fromDate: sinon.stub().callsFake((date) => ({ toDate: () => date })),
      now: sinon.stub().returns({ toDate: () => new Date() })
    }
  };

  const mockAuth = {
    verifyIdToken: sinon.stub(),
    getUserByPhoneNumber: sinon.stub(),
    createUser: sinon.stub(),
    updateUser: sinon.stub()
  };

  const mockAdmin = {
    initializeApp: sinon.stub(),
    firestore: sinon.stub().returns(mockFirestore),
    auth: sinon.stub().returns(mockAuth)
  };

  const mockFunctions = {
    config: sinon.stub().returns({
      mapmyindia: { api_key: 'test_api_key' }
    }),
    https: {
      HttpsError: class HttpsError extends Error {
        constructor(code, message) {
          super(message);
          this.code = code;
        }
      },
      onRequest: sinon.stub(),
      onCall: sinon.stub()
    },
    region: sinon.stub().returns({
      https: {
        onRequest: sinon.stub(),
        onCall: sinon.stub()
      }
    })
  };

  return {
    mockDocRef,
    mockCollectionRef,
    mockFirestore,
    mockAuth,
    mockAdmin,
    mockFunctions
  };
};

// Create and export mocks
const mocks = createMocks();
global.mockFirestore = mocks.mockFirestore;
global.mockAuth = mocks.mockAuth;
global.mockDocRef = mocks.mockDocRef;
global.mockCollectionRef = mocks.mockCollectionRef;
global.mockAdmin = mocks.mockAdmin;
global.mockFunctions = mocks.mockFunctions;

// Simple module mocking
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  switch (id) {
    case 'firebase-admin':
      return global.mockAdmin;
    case 'firebase-functions':
      return global.mockFunctions;
    case 'axios':
      return {
        get: sinon.stub().resolves({ data: {} }),
        post: sinon.stub().resolves({ data: {} })
      };
    case 'geofire-common':
      return {
        geohashQueryBounds: sinon.stub().returns([['bound1', 'bound2']]),
        distanceBetween: sinon.stub().returns(1000)
      };
    case 'moment':
      const mockMoment = sinon.stub().callsFake(() => ({
        isValid: () => true,
        isBefore: () => false,
        isAfter: () => false,
        clone: () => ({
          add: () => ({ toDate: () => new Date() }),
          subtract: () => ({ toDate: () => new Date() })
        }),
        toDate: () => new Date(),
        toISOString: () => new Date().toISOString()
      }));
      mockMoment.now = () => new Date();
      return mockMoment;
    case 'uuid':
      return { v4: () => 'mock-uuid-123' };
    default:
      return originalRequire.apply(this, arguments);
  }
}; 