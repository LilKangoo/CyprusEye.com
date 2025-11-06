# /src - Modular Source Code

This directory contains the refactored, modular version of the CyprusEye.com application.

## Structure

```
/src
├── utils/          - Pure utility functions (no side effects)
├── state/          - State management modules
├── api/            - API layer and Supabase client wrappers
├── components/     - UI components and widgets
└── README.md       - This file
```

## Module Guidelines

### `/utils` - Utilities
- **Purpose:** Pure functions with no side effects
- **Examples:** Date formatting, translations, validation, data processing
- **Rules:**
  - No DOM manipulation
  - No state access
  - No API calls
  - Fully testable in isolation

### `/state` - State Management
- **Purpose:** Application state and persistence
- **Examples:** Accounts, progress, notifications, reviews
- **Rules:**
  - Use store.js for centralized state
  - Provide subscribe/unsubscribe methods
  - Handle localStorage persistence
  - Emit events on state changes

### `/api` - API Layer
- **Purpose:** Backend communication
- **Examples:** Supabase client, auth, community endpoints
- **Rules:**
  - Wrap all external API calls
  - Handle errors consistently
  - Return promises
  - No direct state manipulation

### `/components` - UI Components
- **Purpose:** Reusable UI widgets
- **Examples:** Modal, TabBar, Notifications, Explorer
- **Rules:**
  - Encapsulate DOM manipulation
  - Expose clear public APIs
  - Handle their own event listeners
  - Clean up on destroy

## Import Guidelines

```javascript
// ✅ GOOD - Specific imports
import { formatDate } from '/src/utils/dates.js';
import { getAccountState } from '/src/state/accounts.js';

// ❌ BAD - Importing everything
import * as utils from '/src/utils/dates.js';
```

## Testing

Each module should be independently testable:
- **utils:** Unit tests (Jest/Vitest)
- **state:** Unit tests + integration tests
- **api:** Integration tests with mocks
- **components:** E2E tests (Playwright)

## Migration Status

Modules will be created incrementally during Phase 2 refactoring.

See PHASE_2_ROADMAP.md for detailed migration plan.
