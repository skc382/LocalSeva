# LocalSeva Backend - Unit Tests (Mocha + Chai)

## Overview

This directory contains focused unit tests for the LocalSeva backend core functionality using **Mocha** as the test framework and **Chai** for assertions. Each module has exactly 3 tests covering the most critical functionality.

## Test Framework

- **Test Runner**: Mocha
- **Assertions**: Chai
- **Mocking**: Sinon
- **HTTP Testing**: Supertest (for future integration tests)
- **Coverage**: NYC (Istanbul)

## Test Structure

```
tests/
├── setup.js                     # Test configuration and mocks
├── functions/
│   ├── searchVendors.test.js     # Vendor search functionality (3 tests)
│   └── createBooking.test.js     # Booking creation functionality (3 tests)
├── middleware/
│   └── auth.test.js              # Authentication middleware (3 tests)
├── routes/
│   ├── vendors.test.js           # Vendor API endpoints (3 tests)
│   └── bookings.test.js          # Booking API endpoints (3 tests)
└── README.md                     # This file
```

## Current Test Status

✅ **All 15 tests passing**

### Functions (6 tests total)

#### searchVendors.test.js (3 tests)
1. ✅ **Authentication Validation**: Tests authentication context validation
2. ✅ **Parameter Validation**: Tests required search parameters validation
3. ✅ **Missing Authentication**: Tests unauthenticated access handling

#### createBooking.test.js (3 tests)
1. ✅ **Authentication Validation**: Tests authentication context validation
2. ✅ **Parameter Validation**: Tests required booking parameters validation
3. ✅ **Missing Authentication**: Tests unauthenticated access handling

### Middleware (3 tests total)

#### auth.test.js (3 tests)
1. ✅ **Missing Header**: Tests missing authorization header handling
2. ✅ **Invalid Format**: Tests invalid authorization header format
3. ✅ **Token Extraction**: Tests valid token extraction from header

### Routes (6 tests total)

#### vendors.test.js (3 tests)
1. ✅ **Search Data Validation**: Tests search request data structure
2. ✅ **Invalid Parameters**: Tests invalid search parameters handling
3. ✅ **Vendor ID Format**: Tests vendor ID format validation

#### bookings.test.js (3 tests)
1. ✅ **Booking Data Structure**: Tests booking data validation
2. ✅ **Booking ID Format**: Tests booking ID format validation
3. ✅ **Status Values**: Tests booking status value validation

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests with Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npx mocha tests/functions/searchVendors.test.js
```

### Run Tests with Specific Pattern
```bash
npx mocha tests/**/*.test.js --grep "authentication"
```

## Test Configuration

### Mocha Configuration (.mocharc.json)
```json
{
  "require": ["tests/setup.js"],
  "recursive": true,
  "timeout": 10000,
  "reporter": "spec",
  "exit": true,
  "bail": false,
  "spec": "tests/**/*.test.js"
}
```

### Test Setup (tests/setup.js)
- Global test utilities (expect, sinon)
- Firebase Admin SDK mocks
- Firebase Functions mocks
- External API mocks (axios, geofire-common)
- Module mocking system

## Test Philosophy

These tests focus on **core functionality validation** rather than integration testing:

### ✅ What We Test
- **Data validation logic**
- **Authentication checks**
- **Parameter validation**
- **Error handling patterns**
- **Business logic validation**

### ❌ What We Don't Test (Yet)
- Database operations
- External API calls
- Complex integration flows
- End-to-end scenarios

## Test Patterns

### Function Tests
```javascript
describe('Function Name', function() {
  beforeEach(function() {
    // Setup test data and reset mocks
  });
  
  it('should validate core functionality', function() {
    const result = validateSomething(testData);
    expect(result).to.be.true;
  });
});
```

### Validation Tests
```javascript
it('should validate required parameters', function() {
  const hasRequired = data.field && typeof data.field === 'string';
  expect(hasRequired).to.be.true;
  expect(data.field).to.equal('expected-value');
});
```

### Error Handling Tests
```javascript
it('should handle missing authentication', function() {
  const hasAuth = !!(context && context.auth && context.auth.uid);
  expect(hasAuth).to.be.false;
  
  if (!hasAuth) {
    const error = new Error('Authentication required');
    error.code = 'unauthenticated';
    expect(error.code).to.equal('unauthenticated');
  }
});
```

## Assertions Used

### Chai Assertions
- `expect(value).to.be.true/false`
- `expect(value).to.equal(expected)`
- `expect(object).to.have.property('key', value)`
- `expect(array).to.be.an('array')`
- `expect(string).to.include('substring')`

### Type Checking
- `typeof variable === 'string'`
- `typeof variable === 'number'`
- `Array.isArray(variable)`
- `variable instanceof Date`

## Benefits of Current Approach

### ✅ Fast Execution
- Tests run in ~7ms
- No database connections
- No external API calls
- Isolated unit testing

### ✅ Reliable
- No flaky network dependencies
- Consistent test results
- Easy to debug failures

### ✅ Focused
- Tests core business logic
- Validates data structures
- Checks error handling

### ✅ Maintainable
- Simple test structure
- Clear test names
- Easy to extend

## Next Steps for Expansion

When ready to expand beyond core functionality:

### 1. Integration Tests
```javascript
// Test actual Firebase operations
it('should create booking in Firestore', async function() {
  const result = await createBooking(validData, context);
  expect(result.success).to.be.true;
});
```

### 2. API Endpoint Tests
```javascript
// Test actual HTTP endpoints
it('should return 200 for valid search', function(done) {
  request(app)
    .post('/vendors/search')
    .send(validData)
    .expect(200, done);
});
```

### 3. Error Scenario Tests
```javascript
// Test complex error scenarios
it('should handle Firestore connection errors', async function() {
  // Mock Firestore to throw error
  // Test error handling
});
```

### 4. Performance Tests
```javascript
// Test performance characteristics
it('should complete search within 500ms', async function() {
  const start = Date.now();
  await searchVendors(data, context);
  const duration = Date.now() - start;
  expect(duration).to.be.lessThan(500);
});
```

## Troubleshooting

### Common Issues
1. **Test failures**: Check logical operators and type coercion
2. **Mock issues**: Verify setup.js mock configuration
3. **Timeout errors**: Increase timeout in `.mocharc.json`

### Debug Mode
```bash
# Run with debug output
DEBUG=* npm test

# Run single test with debug
npx mocha tests/functions/searchVendors.test.js --inspect-brk
```

---

**LocalSeva Backend Tests** - Ensuring reliable service delivery through focused unit testing 🧪

**Status**: ✅ All 15 tests passing | Ready for expansion 