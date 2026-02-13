# Testing Guide

## Overview

The application includes automated tests for critical AI and data processing logic.

## Test Framework

- **Framework**: Vitest
- **Language**: TypeScript
- **Coverage**: Schema validation, deduplication, safety flags, vector search

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with UI (interactive)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Makefile

```bash
# Run tests
make test
```

## Test Structure

```
src/
  lib/
    ai/
      __tests__/
        schema-validation.test.ts    # Zod schema validation
        safety-flags.test.ts         # Buy/sell detection
    news/
      __tests__/
        dedup.test.ts                # Deduplication logic
        vector-search-endpoint.test.ts  # Search ordering
```

## Test Coverage

### 1. Schema Validation

**File**: `src/lib/ai/__tests__/schema-validation.test.ts`

Tests Zod schema validation for:
- News Analysis schema (news_id, summary, sentiment, etc.)
- Investor Profile schema (risk_level, horizon, style_tags, etc.)

**Examples**:
- Valid schemas pass validation
- Invalid sentiment values are rejected
- Summary word count limits are enforced
- Disclaimer text is validated
- Confidence ranges are enforced

### 2. Deduplication Logic

**File**: `src/lib/news/__tests__/dedup.test.ts`

Tests RSS ingestion deduplication:
- Same inputs produce same hash
- Different inputs produce different hashes
- Case sensitivity
- Missing/empty published dates
- Special characters

### 3. Safety Flag Detection

**File**: `src/lib/ai/__tests__/safety-flags.test.ts`

Tests detection of forbidden keywords:
- "buy", "sell", "purchase"
- "invest in", "recommend buying/selling"
- "should buy/sell", "must buy/sell"
- "investment advice", "financial advice"
- Case-insensitive detection
- Multiple keyword detection
- Safe text (no flags)

### 4. Vector Search Ordering

**File**: `src/lib/news/__tests__/vector-search-endpoint.test.ts`

Tests search result ordering:
- Results sorted by similarity (descending)
- All fields preserved after sorting
- Edge cases (empty, single, identical similarities)
- Boundary values (0.0, 1.0)

## Writing Tests

### Test File Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionToTest(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Best Practices

1. **Descriptive Names**: Test names should clearly describe what they test
2. **Arrange-Act-Assert**: Structure tests clearly
3. **Isolation**: Each test should be independent
4. **Edge Cases**: Test boundaries and error conditions
5. **No Side Effects**: Tests shouldn't modify shared state

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
```

## Troubleshooting

### Tests Not Running

1. Check Vitest is installed:
   ```bash
   npm list vitest
   ```

2. Verify test files match pattern:
   - Files must end in `.test.ts` or `.spec.ts`
   - Located in `src/` directory

3. Check vitest config:
   ```bash
   cat vitest.config.ts
   ```

### Import Errors

If tests fail with import errors:
1. Check path aliases in `vitest.config.ts`
2. Verify `tsconfig.json` paths match
3. Use relative imports if needed

### Database-Dependent Tests

Current tests are unit tests (no database). For integration tests:
1. Use test database
2. Mock Prisma client
3. Use test containers

## Future Enhancements

- [ ] Integration tests with test database
- [ ] API endpoint tests
- [ ] E2E tests for critical flows
- [ ] Performance tests
- [ ] Coverage thresholds

## See Also

- [Vitest Documentation](https://vitest.dev/)
- `vitest.config.ts` - Test configuration
- `package.json` - Test scripts
