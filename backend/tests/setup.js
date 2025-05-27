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
      arrayRemove: sinon.stub().callsFake((value) => `ARRAY_REMOVE(${value})`),
      increment: sinon.stub().callsFake((value) => `INCREMENT(${value})`),
      delete: sinon.stub().returns('DELETE_FIELD')
    },
    Timestamp: {
      fromDate: sinon.stub().callsFake((date) => ({ 
        toDate: () => date,
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1000000
      })),
      now: sinon.stub().returns({ 
        toDate: () => new Date(),
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: (Date.now() % 1000) * 1000000
      })
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
    auth: sinon.stub().returns(mockAuth),
    credential: {
      cert: sinon.stub(),
      applicationDefault: sinon.stub()
    }
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

// Enhanced module mocking
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
        post: sinon.stub().resolves({ data: {} }),
        put: sinon.stub().resolves({ data: {} }),
        delete: sinon.stub().resolves({ data: {} }),
        patch: sinon.stub().resolves({ data: {} })
      };
    case 'geofire-common':
      return {
        geohashQueryBounds: sinon.stub().returns([['bound1', 'bound2']]),
        distanceBetween: sinon.stub().returns(1000),
        geohashForLocation: sinon.stub().returns('geohash123')
      };
    case 'moment':
      const mockMoment = sinon.stub().callsFake((input) => {
        const date = input ? new Date(input) : new Date();
        return {
          isValid: () => !isNaN(date.getTime()),
          isBefore: (other) => date < new Date(other),
          isAfter: (other) => date > new Date(other),
          clone: () => mockMoment(date),
          add: (amount, unit) => {
            const newDate = new Date(date);
            if (unit === 'days') newDate.setDate(newDate.getDate() + amount);
            if (unit === 'hours') newDate.setHours(newDate.getHours() + amount);
            if (unit === 'minutes') newDate.setMinutes(newDate.getMinutes() + amount);
            return mockMoment(newDate);
          },
          subtract: (amount, unit) => {
            const newDate = new Date(date);
            if (unit === 'days') newDate.setDate(newDate.getDate() - amount);
            if (unit === 'hours') newDate.setHours(newDate.getHours() - amount);
            if (unit === 'minutes') newDate.setMinutes(newDate.getMinutes() - amount);
            return mockMoment(newDate);
          },
          toDate: () => date,
          toISOString: () => date.toISOString(),
          format: (fmt) => date.toISOString(),
          valueOf: () => date.getTime(),
          unix: () => Math.floor(date.getTime() / 1000),
          diff: (other, unit) => {
            const otherDate = new Date(other);
            const diffMs = date.getTime() - otherDate.getTime();
            if (unit === 'hours') return diffMs / (1000 * 60 * 60);
            if (unit === 'minutes') return diffMs / (1000 * 60);
            return diffMs;
          }
        };
      });
      mockMoment.now = () => new Date();
      mockMoment.utc = (input) => mockMoment(input);
      mockMoment.unix = (timestamp) => mockMoment(new Date(timestamp * 1000));
      return mockMoment;
    case 'uuid':
      return { 
        v4: sinon.stub().returns('mock-uuid-123')
      };
    case 'crypto':
      return {
        randomBytes: sinon.stub().returns(Buffer.from('mockrandom')),
        createHash: sinon.stub().returns({
          update: sinon.stub().returnsThis(),
          digest: sinon.stub().returns('mockhash')
        })
      };
    case 'bcrypt':
    case 'bcryptjs':
      return {
        hash: sinon.stub().resolves('$2b$10$mockedhash'),
        compare: sinon.stub().resolves(true),
        genSalt: sinon.stub().resolves('$2b$10$mockedsalt')
      };
    case 'jsonwebtoken':
      return {
        sign: sinon.stub().returns('mock.jwt.token'),
        verify: sinon.stub().returns({ userId: 'test-user-123' }),
        decode: sinon.stub().returns({ userId: 'test-user-123' })
      };
    case 'nodemailer':
      return {
        createTransporter: sinon.stub().returns({
          sendMail: sinon.stub().resolves({ messageId: 'mock-message-id' })
        })
      };
    case 'twilio':
      return sinon.stub().returns({
        messages: {
          create: sinon.stub().resolves({
            sid: 'mock-message-sid',
            status: 'sent'
          })
        }
      });
    default:
      return originalRequire.apply(this, arguments);
  }
};

// Global test utilities
global.testUtils = {
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    userId: null,
    phoneNumber: null,
    ...overrides
  }),
  
  createMockResponse: () => {
    const res = {
      status: sinon.stub(),
      json: sinon.stub(),
      send: sinon.stub(),
      end: sinon.stub(),
      redirect: sinon.stub(),
      cookie: sinon.stub(),
      clearCookie: sinon.stub()
    };
    
    // Chain methods
    res.status.returns(res);
    res.json.returns(res);
    res.send.returns(res);
    res.cookie.returns(res);
    res.clearCookie.returns(res);
    
    return res;
  },
  
  createMockNext: () => sinon.stub(),
  
  resetAllMocks: () => {
    sinon.resetHistory();
    sinon.resetBehavior();
  }
};

console.log('Enhanced test setup completed with comprehensive mocking'); 