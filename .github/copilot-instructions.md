# AmortSuccess - AI Coding Agent Instructions

## Project Overview
AmortSuccess is a SvelteKit 2 loan amortization calculator using **Svelte 5 runes** (`$state`, `$derived`, `$effect`). Users input loan parameters, calculate schedules, apply principal payments/rate changes, and save/load sessions as JSON files.

## Architecture & Data Flow

### State Management Pattern
- **Global state**: Svelte writable store in [src/lib/stores/amortization.ts](src/lib/stores/amortization.ts) holds `ResultsData` (loan params + schedule)
- **Component state**: Svelte 5 runes (`$state`, `$derived`) in page components
- **Data flow**: Home page → calculate → update store → navigate to `/results` → results page subscribes to store

### Key Components
1. **[src/routes/+page.svelte](src/routes/+page.svelte)**: Form input with validation, file upload, calculation trigger
2. **[src/routes/results/+page.svelte](src/routes/results/+page.svelte)**: Results display, schedule table, loan updates modal, session save
3. **[src/lib/utils/amortization.ts](src/lib/utils/amortization.ts)**: Core calculation logic (`calculateAmortizationSchedule`, `recalculateScheduleWithUpdates`)
4. **[src/lib/utils/file-handling.ts](src/lib/utils/file-handling.ts)**: Session JSON save/load with security validation (1MB limit, type checks)

### Data Types
- `PaymentSchedule`: Individual payment entry (month, date, payment, interest, principal, remainingBalance)
- `ResultsData`: Complete calculation result stored globally
- `SessionData`: Serializable subset for save/load (excludes calculated schedule)
- `LoanUpdate`: Tracks principal payments and rate changes applied to schedule

## Critical Patterns

### Svelte 5 Runes Usage
```typescript
// Component-local reactive state
let loanAmount = $state(100000);

// Derived computations (recalculate when dependencies change)
let schedule = $derived.by(() => {
  // Complex derived logic here
});

// Side effects (persist to store, sync state)
$effect(() => {
  if (condition) {
    amortizationResults.update(data => ({ ...data, field: value }));
  }
});
```

### Form Validation Pattern (see [+page.svelte#L48-L57](src/routes/+page.svelte#L48-L57))
- Validation errors stored in `$state` object with field-level messages
- `validateForm()` checks all fields, returns boolean
- Display inline errors with ARIA attributes (`aria-invalid`, `aria-describedby`)
- Run validation on submit before calculation

### File Upload Security (see [file-handling.ts](src/lib/utils/file-handling.ts))
- Validate file type (`.json` extension + MIME type)
- Enforce 1MB max file size
- Parse JSON safely with try/catch
- Use type guards (`validateSessionData`) before applying data
- Validate value ranges (`validateSessionValues`) - prevents malicious inputs

### Schedule Recalculation with Updates
When applying principal payments or rate changes:
1. Start with base schedule from original loan parameters
2. Call `recalculateScheduleWithUpdates()` with updates array
3. Updates applied chronologically - each recalculates remaining payments
4. `updateType` determines behavior: `'retain-term'` (adjust payment) or `'retain-payment'` (adjust term)

## UI Components & Styling

### Skeleton UI Library
- Uses **@skeletonlabs/skeleton-svelte** v4 (Svelte 5 compatible)
- Components: `DatePicker`, `Dialog`, `Progress`, `Portal`
- Import pattern: `import { Component } from '@skeletonlabs/skeleton-svelte'`
- Tailwind CSS v4 for styling with `preset-filled-*` utility classes

### Component Props (Svelte 5 Syntax)
```typescript
type Props = {
  monthsElapsed: number;
  totalMonths: number;
  progress: number;
  noCard?: boolean;
};

let { monthsElapsed, totalMonths, progress, noCard = false }: Props = $props();
```

## Development Workflows

### Commands
- `npm run dev`: Start development server (Vite)
- `npm run build`: Production build
- `npm run check`: TypeScript and Svelte type checking
- `npm run check:watch`: Continuous type checking

### Key Files to Update Together
- When modifying loan calculation: Update both [utils/amortization.ts](src/lib/utils/amortization.ts) and update calls in page components
- When changing `ResultsData` type: Update [stores/amortization.ts](src/lib/stores/amortization.ts), [+page.svelte](src/routes/+page.svelte) (form submit), [results/+page.svelte](src/routes/results/+page.svelte) (display)
- When adding form fields: Update validation in `validateForm()`, add to `SessionData` type, handle in file load/save

### Accessibility Conventions (see [BEST_PRACTICES_REVIEW.md](BEST_PRACTICES_REVIEW.md))
- Use `aria-invalid`, `aria-describedby` for form validation
- Add `role="alert"` for error messages
- Include `.sr-only` class for screen reader announcements
- Use `aria-live="polite"` for dynamic content updates

## Testing & Debugging
- No formal test suite currently - manual testing workflow
- Common debugging: Check store state via SvelteKit DevTools browser extension
- Validate calculations against known loan scenarios (test different rates, terms, update combinations)

## Common Tasks

### Adding a New Loan Parameter
1. Add field to form in [+page.svelte](src/routes/+page.svelte) with `$state` variable
2. Add to `ResultsData` type in [stores/amortization.ts](src/lib/stores/amortization.ts)
3. Pass to `calculateAmortizationSchedule()` in [utils/amortization.ts](src/lib/utils/amortization.ts)
4. Update `SessionData` type for save/load persistence
5. Add validation rules to `validateForm()` and `validateSessionValues()`

### Modifying Schedule Display
- Edit [results/+page.svelte](src/routes/results/+page.svelte)
- Use `filteredSchedule` derived value (respects `hidePastMonths` filter)
- Format currency with `formatCurrencyWithSymbol()` helper
- Format dates with `formatDate()` from [utils/formatting.ts](src/lib/utils/formatting.ts)
