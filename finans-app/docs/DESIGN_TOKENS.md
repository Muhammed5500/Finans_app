# Design Tokens

Minimal design system for the finance tracking dashboard. Semantic tokens ensure consistency and maintainability.

## Philosophy

- **Calm & Professional**: Neutral palette, no flashy colors
- **Finance-Focused**: Green/Red ONLY for price changes and alerts
- **Accessible**: WCAG AA contrast ratios, clear focus states
- **Practical**: Based on 4px grid, consistent spacing

---

## Semantic Color Tokens

### Background Hierarchy

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | `#ffffff` | Main app background |
| `--color-surface` | `#fafafa` | Card/surface background |
| `--color-surface-elevated` | `#ffffff` | Elevated surfaces (modals, dropdowns) |

### Border Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-border` | `#e4e4e7` | Default borders |
| `--color-border-muted` | `#f4f4f5` | Subtle borders |
| `--color-border-strong` | `#d4d4d8` | Strong borders (focus states) |

### Text Hierarchy

| Token | Value | Usage |
|-------|-------|-------|
| `--color-text` | `#18181b` | Primary text |
| `--color-text-muted` | `#52525b` | Secondary text |
| `--color-text-subtle` | `#71717a` | Tertiary text (labels, captions) |

### Semantic Colors

**Important**: Green and Red are ONLY used for price changes and alerts.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#16a34a` | Gains, positive changes |
| `--color-success-muted` | `#dcfce7` | Light green backgrounds |
| `--color-danger` | `#dc2626` | Losses, negative changes, alerts |
| `--color-danger-muted` | `#fee2e2` | Light red backgrounds |
| `--color-warning` | `#ca8a04` | Warnings (not errors) |
| `--color-warning-muted` | `#fef9c3` | Light amber backgrounds |

### Interactive States

| Token | Value | Usage |
|-------|-------|-------|
| `--color-interactive` | `#18181b` | Default interactive (buttons, links) |
| `--color-interactive-hover` | `#27272a` | Hover state |
| `--color-interactive-active` | `#09090b` | Active/pressed state |
| `--color-interactive-disabled` | `#a1a1aa` | Disabled state |

### Focus Ring

| Token | Value | Usage |
|-------|-------|-------|
| `--color-focus-ring` | `#2563eb` | Focus ring for keyboard navigation |
| `--color-focus-ring-offset` | `#ffffff` | Focus ring offset background |

---

## Spacing Scale

Based on 4px grid. Use semantic tokens for consistency.

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-0` | `0` | No spacing |
| `--spacing-1` | `0.25rem` (4px) | Tight spacing |
| `--spacing-2` | `0.5rem` (8px) | Small spacing |
| `--spacing-3` | `0.75rem` (12px) | Default spacing |
| `--spacing-4` | `1rem` (16px) | Medium spacing |
| `--spacing-5` | `1.25rem` (20px) | Large spacing |
| `--spacing-6` | `1.5rem` (24px) | Card padding |
| `--spacing-8` | `2rem` (32px) | Section spacing |
| `--spacing-10` | `2.5rem` (40px) | Large section spacing |
| `--spacing-12` | `3rem` (48px) | Extra large spacing |
| `--spacing-16` | `4rem` (64px) | Maximum spacing |

---

## Border Radius

Consistent rounding for cards, buttons, inputs.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Small elements (badges, chips) |
| `--radius-md` | `6px` | Default (buttons, inputs, cards) |
| `--radius-lg` | `8px` | Large cards, modals |
| `--radius-xl` | `12px` | Extra large containers |

---

## Shadows

Minimal, subtle shadows for depth.

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.03)` | Subtle elevation |
| `--shadow-md` | `0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)` | Default elevation |
| `--shadow-lg` | `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)` | Strong elevation |

---

## Transitions

Subtle, not distracting. Fast enough to feel responsive.

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `100ms ease` | Quick transitions |
| `--transition-base` | `150ms ease` | Default transitions |
| `--transition-slow` | `200ms ease` | Slow transitions (panels, modals) |

---

## Usage Examples

### In CSS Modules

```css
.myCard {
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
}

.myButton {
  background-color: var(--color-interactive);
  color: white;
  border-radius: var(--radius-md);
  padding: var(--spacing-3) var(--spacing-4);
  transition: background-color var(--transition-base);
}

.myButton:hover:not(:disabled) {
  background-color: var(--color-interactive-hover);
}

.myButton:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

### In Tailwind Classes (via @theme)

```tsx
// Background
<div className="bg-background">...</div>
<div className="bg-surface">...</div>

// Text
<p className="text-default">Primary text</p>
<p className="text-muted">Secondary text</p>
<p className="text-subtle">Tertiary text</p>

// Semantic colors (price changes)
<span className="text-success">+2.5%</span>
<span className="text-danger">-1.2%</span>

// Borders
<div className="border border-default">...</div>
<div className="border border-muted">...</div>

// Focus ring
<button className="focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2">
  Accessible button
</button>
```

### Utility Classes

Pre-defined utility classes are available in `styles/design-tokens.css`:

- `.bg-background`, `.bg-surface`, `.bg-surface-elevated`
- `.border-default`, `.border-muted`, `.border-strong`
- `.text-default`, `.text-muted`, `.text-subtle`
- `.text-success`, `.bg-success-muted`
- `.text-danger`, `.bg-danger-muted`
- `.text-warning`, `.bg-warning-muted`
- `.focus-ring`, `.focus-ring-inset`
- `.card`, `.card-compact`
- `.btn-base`
- `.input-base`, `.input-error`

---

## Interaction States

### Hover

```css
.element:hover:not(:disabled) {
  background-color: var(--color-interactive-hover);
  border-color: var(--color-border-strong);
}
```

### Focus

```css
.element:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}
```

### Active

```css
.element:active:not(:disabled) {
  background-color: var(--color-interactive-active);
}
```

### Disabled

```css
.element:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
  color: var(--color-interactive-disabled);
}
```

---

## Accessibility

### Contrast Ratios

All color combinations meet WCAG AA standards:

- Text on background: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: Clear focus indicators

### Focus States

- All interactive elements have visible focus rings
- Focus ring color: `--color-focus-ring` (#2563eb)
- Focus ring offset: 2px for visibility
- Keyboard navigation fully supported

### Touch Targets

- Minimum touch target: 44px × 44px (mobile)
- Button padding: `--spacing-3` (12px) minimum
- Spacing between interactive elements: `--spacing-2` (8px) minimum

---

## Component Patterns

### Card

```tsx
<div className="card">
  {/* Card content */}
</div>

// Or with CSS variables
<div style={{
  backgroundColor: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--spacing-6)'
}}>
  {/* Card content */}
</div>
```

### Button

```tsx
<button className="btn-base bg-interactive text-white">
  Click me
</button>
```

### Input

```tsx
<input className="input-base" type="text" />

// Error state
<input className="input-base input-error" type="text" />
```

---

## File Structure

```
finans-app/
├── src/
│   ├── styles/
│   │   └── design-tokens.css    # Semantic tokens + Tailwind @theme
│   ├── app/
│   │   └── globals.css          # Imports design-tokens.css
│   └── components/
│       └── ui/
│           ├── Button.tsx       # Uses tokens
│           ├── Button.module.css
│           ├── Input.tsx
│           └── Input.module.css
└── docs/
    └── DESIGN_TOKENS.md         # This file
```

---

## Best Practices

1. **Always use semantic tokens** - Don't hardcode colors
2. **Green/Red only for price changes** - Use neutral colors elsewhere
3. **Consistent spacing** - Use spacing scale, not arbitrary values
4. **Accessible focus states** - Always include focus-visible styles
5. **Test contrast** - Verify color combinations meet WCAG AA

---

## References

- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Tailwind CSS v4 Theme Configuration](https://tailwindcss.com/docs/theme)
- [Design Tokens Community Group](https://www.designtokens.org/)
