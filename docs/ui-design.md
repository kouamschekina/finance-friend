# UI Design System - Finance Friend

This document defines the visual identity and UI patterns for the Finance Friend application to ensure a premium, modern, and "lovable" experience.

## 1. Visual Identity
- **Vibe**: Elegant, trustworthy, and modern. High-end fintech aesthetic (e.g., Apple Card, Revolut).
- **Color Palette**:
    - **Primary**: Deep Petrol (`#0891b2`) with subtle gradients.
    - **Background**: Soft Gray (`#f8fafc`) for light mode, deep Charcoal (`#0f172a`) for dark mode.
    - **Accents**: 
        - Success/Income: Emerald (`#10b981`)
        - Error/Expense: Rose (`#f43f5e`)
        - Warning: Amber (`#f59e0b`)
- **Typography**: 
    - Heading: `Inter` or `Geist` (if available), bold for numbers.
    - Monospace for transaction amounts to ensure alignment.

## 2. Key Components

### Bottom Navigation (Mobile)
- Floating or docked at the bottom.
- Large center "+" button with a subtle glow / backdrop blur.
- Active items use a combination of color change and a small indicator dot.

### Transaction Cards
- Subtle border or soft shadow.
- Category icon in a colored circular/squircle container with 15% opacity.
- Amounts should be prominent, using `tabular-nums` for clear vertical scanning.

### The "Add Transaction" Drawer
- **Trigger**: Center button in Bottom Nav.
- **Header**: Large amount display, updating as user types.
- **Input Area**: Large, centered digits.
- **Category Grid**: 
    - 4xN grid of icons.
    - Each icon reflects its category color when selected.
    - Haptic-like scale animation on tap (`framer-motion`).

## 3. Micro-Animations
- **Page Transitions**: Smooth slide-in from right for sub-pages, fade-in for main tabs.
- **Button Feedback**: Subtle scale down (0.95) on press.
- **Success States**: Celebration scale effect when a goal is reached or budget is saved.

## 4. Iconography
- **Library**: `lucide-react`.
- **Style**: Consistent stroke width (1.5 - 2px).
- **Rule**: NO EMOJIS. Use refined icons for everything.
