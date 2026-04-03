# Design Document - Finance Friend Overhaul

The goal is to transform "Finance Friend" into a premium, mobile-first financial management application that feels like a native Android/iOS app.

## User Experience (UX) Principles
- **Mobile-First**: Primary interactions optimized for one-handed use.
- **Native Feel**: Smooth transitions, haptic-like feedback (micro-animations), and standard mobile patterns (Bottom Nav, Drawers).
- **Zero Friction**: Minimize taps for common actions (especially adding transactions).
- **Visual Clarity**: High contrast for important data (balances, amounts), clear iconography.

## Key Features & Improvements

### 1. Progressive Web App (PWA)
- Offline support for viewing data.
- Standard manifest for "Add to Home Screen".
- Theme color integration with system status bar.

### 2. Navigation Architecture
- **Bottom Navigation**: Replacing/enhancing the current sidebar for mobile. Items: Dashboard, Transactions, Add (+), Budgets, Profile.
- **Top Bar**: Minimalist, showing context and quick actions.
- **Drawers (Vaul)**: Used for all forms and detail views on mobile.

### 3. High-Fidelity Transaction Flow
- **Amount Input**: Fixed decimal or "calculator-style" large numeric input.
- **Category Selection**: 
    - No dropdowns for primary selection.
    - Scrollable grid of icons with category-specific colors.
    - Visual feedback on selection.
- **Quick Add**: A prominent "+" button in the center of the bottom nav.

## Technical Stack
- **Frontend**: React + Vite + TypeScript.
- **Styling**: Tailwind CSS + shadcn/ui.
- **Icons**: Lucide React.
- **PWA**: `vite-plugin-pwa`.
- **Animations**: `framer-motion` (for native-like transitions).

## Routing Table
| Path | Description |
| :--- | :--- |
| `/` | Dashboard (Overview, Quick Stats) |
| `/transactions` | List of all transactions with search/filter |
| `/budgets` | Budget management and progress |
| `/goals` | Savings goals tracking |
| `/advisor` | AI-driven financial advice |
| `/profile` | User settings and account info |
