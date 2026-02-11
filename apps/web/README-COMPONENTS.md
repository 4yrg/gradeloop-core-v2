# GradeLoop AI-Focused Component Library

A scalable, accessible, and AI-enhanced component library built with SvelteKit, TailwindCSS, and Storybook for modern educational technology.

## 🌟 Overview

This component library is designed specifically for AI-integrated Learning Management Systems (LMS) with a focus on:

- **AI-Enhanced Interactions**: Components with built-in AI suggestions, confidence scoring, and intelligent feedback
- **Accessibility First**: Full WCAG compliance with keyboard navigation, screen readers, and high contrast support
- **Developer Ergonomics**: Optimized for long coding sessions with reduced eye strain and smooth interactions
- **Semantic Design System**: Token-based architecture with comprehensive light/dark mode support
- **Educational Context**: Purpose-built for grading, assignments, code review, and student interactions

## 🎨 Design System

### Color Palette

Our AI-focused semantic color system is built around educational contexts:

#### Core Brand Colors
- **Primary**: `#4f46e5` (Deep Indigo) - Primary actions, navigation
- **Secondary**: `#64748b` (Cool Slate Blue) - Secondary emphasis  
- **Accent**: `#14b8a6` (Soft Teal) - Progress indicators, highlights

#### AI-Specific Colors
- **AI Highlight**: `#8b5cf6` (Soft Violet Glow) - AI suggestions and actions
- **AI Background**: `#f3f0ff` (Light) / `#1e1b4b` (Dark) - AI panel backgrounds
- **AI Border**: `#ddd6fe` (Light) / `#312e81` (Dark) - AI component borders

#### Semantic Colors
- **Success**: `#10b981` - Passed tests, successful submissions
- **Warning**: `#f59e0b` - Performance warnings, partial grading
- **Error**: `#ef4444` - Failed submissions, validation errors
- **Info**: `#0ea5e9` - Informational alerts, hints

#### Neutral Scale (12-step)
From `#ffffff` to `#0b1120` providing comprehensive surface, border, and typography options.

### Typography
- **Fonts**: System font stack with programming ligature support
- **Sizes**: Responsive scale from 12px to 48px
- **Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### Spacing & Layout
- **Base Unit**: 4px (0.25rem)
- **Scale**: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px
- **Container**: Responsive max-widths with proper margins

## 🧩 Component Architecture

### Foundation Components

#### Buttons
```svelte
<Button variant="primary" size="md" onclick={handleClick}>
  {#snippet children()}Primary Action{/snippet}
</Button>

<Button variant="ai-action" loading>
  {#snippet children()}
    <Sparkles size={16} />
    Generate with AI
  {/snippet}
</Button>
```

**Variants**: `primary`, `secondary`, `ghost`, `destructive`, `ai-action`, `outline`
**Sizes**: `sm`, `md`, `lg`, `xl`, `icon`
**States**: Normal, hover, active, focus, loading, disabled

#### Form Components

##### Input
```svelte
<Input
  bind:value={inputValue}
  label="Assignment Title"
  variant="ai-enhanced"
  aiSuggestion="Consider a more descriptive title"
  error={validationError}
/>
```

##### Textarea
```svelte
<Textarea
  bind:value={content}
  label="Assignment Description"
  aiWritingMode={true}
  autoResize={true}
  on:aiAssist={handleAIAssist}
/>
```

##### Checkbox
```svelte
<Checkbox
  bind:checked={enableAI}
  label="Enable AI Grading"
  variant="ai-enhanced"
  description="Allow AI to grade submissions automatically"
/>
```

### Layout Components

#### AppShell
```svelte
<AppShell bind:mobileSidebarOpen sidebarCollapsed={collapsed}>
  {#snippet sidebar()}
    <Sidebar {items} {userRole} />
  {/snippet}
  
  {#snippet header()}
    <TopBar {user} {notifications} />
  {/snippet}
  
  <!-- Main content -->
  <YourPageContent />
</AppShell>
```

#### Sidebar
```svelte
<Sidebar
  {items}
  collapsed={false}
  userRole="instructor"
  currentPath="/dashboard"
  on:navigate={handleNavigation}
  on:toggleCollapse={handleCollapse}
>
  {#snippet logo()}
    <YourLogo />
  {/snippet}
  
  {#snippet footer()}
    <UserProfile />
  {/snippet}
</Sidebar>
```

### AI-Enhanced Components

#### AI Suggestion Panel
```svelte
<AISuggestionPanel
  {suggestions}
  mode="inline"
  title="Code Review Results"
  showConfidence={true}
  showReasoning={true}
  on:applySuggestion={handleApply}
  on:regenerate={handleRegenerate}
/>
```

**Modes**: `inline`, `drawer`, `panel`
**Features**: Confidence scoring, reasoning display, copy/apply actions

#### AI Inline Hint
```svelte
<AIInlineHint
  content="Consider using more descriptive variable names"
  type="improvement"
  confidence={0.85}
  expandable={true}
  dismissible={true}
/>
```

#### AI Streaming Text
```svelte
<AIStreamingText
  {text}
  streaming={true}
  variant="explanation"
  typewriterSpeed={30}
  showActions={true}
  on:complete={handleComplete}
/>
```

### Theme System

#### Theme Provider
```svelte
<ThemeProvider>
  <YourApp />
</ThemeProvider>
```

#### Theme Toggle
```svelte
<ThemeToggle variant="dropdown" showLabel={true} />
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- SvelteKit project
- TailwindCSS configured

### Installation

1. **Install Dependencies**
```bash
npm install @tailwindcss/vite tailwind-merge tailwind-variants
npm install lucide-svelte # For icons
```

2. **Configure TailwindCSS**
```js
// vite.config.js
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [
    tailwindcss(),
    // ... other plugins
  ]
};
```

3. **Import Base Styles**
```css
/* app.css */
@import 'tailwindcss';
/* Copy the design tokens from src/routes/layout.css */
```

4. **Setup Theme Provider**
```svelte
<!-- +layout.svelte -->
<script>
  import { ThemeProvider } from '$lib/components';
</script>

<ThemeProvider>
  {@render children()}
</ThemeProvider>
```

### Basic Usage

```svelte
<script>
  import { Button, Input, AISuggestionPanel } from '$lib/components';
  
  let searchValue = '';
  let suggestions = [];
  
  function handleAIGenerate() {
    // Your AI integration logic
  }
</script>

<div class="space-y-4">
  <Input
    bind:value={searchValue}
    label="Search"
    placeholder="Search assignments..."
  />
  
  <Button variant="ai-action" onclick={handleAIGenerate}>
    {#snippet children()}Generate AI Feedback{/snippet}
  </Button>
  
  <AISuggestionPanel {suggestions} />
</div>
```

## 📖 Storybook Documentation

Run Storybook to explore all components interactively:

```bash
npm run storybook
```

### Story Categories

- **Components/UI**: Foundation components (Button, Input, etc.)
- **Components/Layout**: Layout and navigation components
- **Components/AI**: AI-enhanced components
- **Components/Theme**: Theme system components

### Interactive Features

- **Theme Toggle**: Test light/dark modes
- **Accessibility Panel**: Check a11y compliance
- **Controls**: Modify component props in real-time
- **Actions**: Monitor component events

## 🎯 AI Integration Guide

### Confidence Scoring

AI suggestions include confidence levels (0-1) with visual indicators:

```typescript
interface AISuggestion {
  id: string;
  type: 'code' | 'text' | 'explanation' | 'improvement' | 'hint';
  title: string;
  content: string;
  confidence: number; // 0-1
  reasoning?: string;
}
```

### AI Writing Assistance

Enable AI writing modes in text components:

```svelte
<Textarea
  aiWritingMode={true}
  on:aiAssist={handleAIRequest}
/>
```

Keyboard shortcuts:
- `Ctrl/Cmd + I`: Trigger AI assist
- `Ctrl/Cmd + Enter`: Continue writing with AI

### AI Suggestion Patterns

1. **Inline Hints**: Contextual suggestions within forms
2. **Suggestion Panels**: Comprehensive feedback with reasoning
3. **Streaming Text**: Real-time AI responses
4. **Confidence Indicators**: Visual trust signals

## ♿ Accessibility Features

### Keyboard Navigation
- **Tab**: Navigate between interactive elements
- **Enter/Space**: Activate buttons and toggles
- **Escape**: Close modals and dropdowns
- **Arrow Keys**: Navigate within components

### Screen Reader Support
- Semantic HTML structure
- ARIA labels and descriptions
- Live regions for dynamic content
- Focus management

### Visual Accessibility
- High contrast mode support
- Focus indicators (3px indigo ring)
- Reduced motion respect
- Color-blind friendly palette

### Testing
```bash
npm run storybook
# Enable accessibility addon to check compliance
```

## 🎨 Customization

### Design Tokens

Customize the design system by modifying CSS variables:

```css
:root {
  --color-primary: #your-brand-color;
  --color-ai-highlight: #your-ai-color;
  --radius: 0.5rem; /* Your preferred border radius */
}
```

### Component Variants

Extend existing components:

```svelte
<Button variant="primary" class="your-custom-styles">
  {#snippet children()}Custom Button{/snippet}
</Button>
```

### Theme Extensions

Add custom theme variants:

```css
.theme-education {
  --color-primary: #2563eb;
  --color-ai-highlight: #7c3aed;
}
```

## 📱 Responsive Design

### Breakpoints
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

### Mobile-First Approach
```svelte
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  <!-- Responsive grid -->
</div>
```

### Touch Interactions
- Minimum touch target size: 44px
- Hover states disabled on touch devices
- Swipe gestures for mobile navigation

## 🧪 Testing

### Component Testing
```javascript
import { render, fireEvent } from '@testing-library/svelte';
import Button from '$lib/components/ui/Button.svelte';

test('button handles click events', async () => {
  const { getByRole } = render(Button, {
    props: { children: () => 'Click me' }
  });
  
  const button = getByRole('button');
  await fireEvent.click(button);
  // Assert expected behavior
});
```

### Accessibility Testing
```javascript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('should not have accessibility violations', async () => {
  const { container } = render(YourComponent);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 🚀 Performance

### Bundle Size Optimization
- Tree-shakeable imports
- Lazy loading for heavy components
- Minimal runtime dependencies

### Runtime Performance
- Svelte's compile-time optimizations
- Efficient reactivity system
- Minimal JavaScript overhead

### Best Practices
```svelte
<!-- Prefer this -->
import { Button } from '$lib/components';

<!-- Over this -->
import Button from '$lib/components/ui/Button.svelte';
```

## 🔧 Development

### File Structure
```
src/lib/components/
├── ui/              # Foundation components
├── layout/          # Layout components  
├── ai/              # AI-enhanced components
├── theme/           # Theme system
└── index.ts         # Barrel exports
```

### Naming Conventions
- **Components**: PascalCase (`Button.svelte`)
- **Props**: camelCase (`showLabel`)
- **Events**: camelCase (`on:click`)
- **CSS Classes**: kebab-case with semantic tokens

### Development Workflow
```bash
# Start development
npm run dev

# Run Storybook
npm run storybook

# Run tests
npm test

# Build for production
npm run build
```

## 🤝 Contributing

### Code Style
- Use TypeScript for type safety
- Follow Prettier formatting
- Use semantic HTML
- Include accessibility attributes

### Component Guidelines
1. **Props**: Use descriptive names with TypeScript types
2. **Events**: Dispatch meaningful events with proper data
3. **Styling**: Use Tailwind classes with semantic tokens
4. **Documentation**: Include JSDoc comments
5. **Testing**: Write tests for component behavior
6. **Stories**: Create comprehensive Storybook stories

### Pull Request Process
1. **Feature Branch**: Create from `main`
2. **Granular Commits**: Follow conventional commit format
3. **Testing**: Ensure all tests pass
4. **Documentation**: Update relevant docs
5. **Review**: Request review from team members

## 📚 Resources

### Design System
- [Design Tokens](./src/routes/layout.css) - Complete token definitions
- [Color Palette](#color-palette) - Semantic color system
- [Component Demo](/demo) - Interactive component showcase

### Development
- [SvelteKit Docs](https://kit.svelte.dev/)
- [TailwindCSS Docs](https://tailwindcss.com/)
- [Storybook Docs](https://storybook.js.org/)

### Accessibility
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Inclusive Design Principles](https://inclusivedesignprinciples.org/)

## 📄 License

This component library is part of the GradeLoop project and follows the project's licensing terms.

---

Built with ❤️ for modern educational technology