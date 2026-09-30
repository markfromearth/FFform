# Form Controls Styling Audit

## 1. Summary: Inconsistencies Resolved

All initial styling inconsistencies have been resolved via a unified styling pass:
1. **Focus Rings:** Global `:focus-visible` conflicts were removed. All focusable elements across all 6 steps now strictly use the `rgb(232 137 61)` orange accent color.
2. **Hover States:** A uniform hover state was applied to `.field` (inputs/selects) and `.choice` (radio cards/pills), eliminating inconsistent bright flashes or static grays.
3. **Completed / Filled States:** Replaced the confusing "blue" filled state with a standard neutral `is-filled` state to strictly reserve blue for selection.
4. **Error States:** Standardized all error states to use a dark-theme-compatible `bg-error/10` instead of light rose.

---

## 2. Token Audit & Contrast Measurements

All hardcoded RGBAs were refactored to theme tokens.
The forms are evaluated against the `bg-surface-container` card background. Compositing the translucent `rgba(38, 70, 115, 0.5)` over the page background (`#0f172a`) yields a computed background of **`rgb(26, 46, 78)` (Luminance: 0.026)**.

| Token | Live Value | Contrast vs `rgb(26, 46, 78)` | Status |
| :--- | :--- | :--- | :--- |
| **Default Border** (`border-outline`) | `rgba(255, 255, 255, 0.40)` | **3.52:1** | Passes (> 3:1) |
| **Focus Indicator** (`accent`) | `rgb(232 137 61)` | **5.27:1** | Passes (> 3:1) |
| **Placeholder Text** (`white/60`) | `rgba(255, 255, 255, 0.60)` | **6.16:1** | Passes (> 4.5:1) |
| **Value Text** (`white`) | `#ffffff` | **13.16:1** | Passes (> 4.5:1) |

*Note: The default border token was raised from `0.35` to `0.40` to provide comfortable headroom above the 3:1 minimum threshold.*

---

## 3. Post-fix Verification

### Form Flow & Behaviour
- **End-to-End Flow:** Verified navigation across Steps 1 through 6, including saving and resuming. Values populate correctly and trigger the `is-filled` styling immediately.
- **Validation:** Triggering validation shifts focus properly to the first invalid field, displaying the orange focus indicator alongside the red error border and background tint, remaining fully readable.
- **Automated Tests:** The test suite (`npm test`) was run. No styling-related regressions were found.

### Matrix: Steps 2-5 (Post-Fix)

All fields correctly inherit the `.field` or `.choice` abstractions.

| Control Family | Default | Hover | Focus (Mouse/Kbd) | Filled | Selected | Error | Disabled |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **.field** (Inputs, Selects, £) | `bg-surface` + `border-outline` | `bg-surface/80` + `border-outline-variant` | `border-accent`, `ring-accent` | `border-white/50` | N/A | `bg-error/10`, `border-error` | 50% opacity |
| **.choice** (Radio, Checkbox) | `bg-surface` + `border-outline` | `bg-surface/80` + `border-outline-variant` | `ring-accent` | N/A | `bg-primary/10`, `border-primary` + icon | `bg-error/10`, `border-error` | 50% opacity |
| **Action** (Buttons/Upload) | Custom bg | Custom hover bg | `ring-accent` | N/A | N/A | N/A | 50% opacity |
| **Helpers** (Hint/Error) | `text-white/70` | N/A | N/A | N/A | N/A | `text-error` | N/A |

### Files Touched (Per Step/Component)
- **CSS / Config**: `src/index.css`, `tailwind.config.js`
- **UI Components**: `TextInput.tsx`, `RadioGroup.tsx`, `CompanySearchInput.tsx`, `MortgageLenderInput.tsx`, `SignatureInput.tsx`, `FileUploadZone.tsx`
- **Steps**:
  - `Step1YourBusiness.tsx`
  - `Step2YourDetails.tsx`
  - `Step3YourInvoices.tsx`
  - `Step4FinalDetails.tsx`
  - `Step5Review.tsx`
  - `Step6Uploads.tsx`

### Screenshot References (`audit-screenshots/after/`)
*Generated to capture the final computed values of every control across all steps:*
- `step1-text-input-[default/hover/focus/filled/error/disabled].png`
- `step1-select-[default/hover/focus/filled/error/disabled].png`
- `step1-currency-input-[default/hover/focus/filled/error/disabled].png`
- `step1-radio-card-[default/hover/focus/selected/error/disabled].png`
- `step1-pill-[default/hover/focus/selected/error/disabled].png`
- `step1-company-search-[default/hover/focus/filled/error/disabled].png`
- `step2-text-input-[...].png` (and so on for all field types mapped across Steps 2-6)

---

## 4. Open Questions

1. The signature pad needs a keyboard-accessible alternative (for example a typed-name option). While a "Type" tab exists, the canvas itself lacks focus interaction for keyboard-only drawing, which is a functional change and should be a separate task.
2. File upload zones (Dropzones) currently use the standard orange focus indicator on their wrapper and inner button. Should they visually merge these into a single focus event so they don't double-ring when navigating purely via keyboard?
