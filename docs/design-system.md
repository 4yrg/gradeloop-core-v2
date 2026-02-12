# GradeLoop Design System: Crevasse Theme

The Crevasse theme is a high-performance, low-eye-strain design system built for long coding sessions. It uses a token-driven approach powered by Tailwind CSS v4 and OKLCH color spaces.

## Color Palette (Crevasse)

| Role | Light Mode | Dark Mode | HEX (Ref) |
|------|------------|-----------|-----------|
| Background | `oklch(0.93 0.02 165)` | `oklch(0.18 0.04 235)` | #DEEFE7 / #002333 |
| Foreground | `oklch(0.18 0.04 235)` | `oklch(0.93 0.02 165)` | #002333 / #DEEFE7 |
| Primary | `oklch(0.58 0.12 195)` | `oklch(0.68 0.14 195)` | #159A9C / #1DB9B9 |
| Secondary | `oklch(0.77 0.02 245)` | `oklch(0.28 0.03 235)` | #B4BEC9 / #475569 |

## Semantic Token Usage

All components must use semantic tokens. Never use raw hex values.

### Basic Tokens
- `--primary`: Main action color (Teal).
- `--background`: Page background.
- `--foreground`: Primary text color.
- `--muted-foreground`: Secondary/De-emphasized text.

### AI Enhancements
Special tokens for AI-integrated features:
- `.ai-glow`: Hover effect for AI interactive elements.
- `.ai-ring-focus`: Focus ring for AI inputs.

## Component Guidelines

### Buttons
- **Primary**: Teal background, white text.
- **Secondary**: Blue-gray background.
- **AI**: Add `.ai-glow` for enhanced interactivity.

### Accessibility
- **Contrast**: All tokens are validated for WCAG AA (min 4.5:1).
- **Focus States**: High contrast focus rings ensure keyboard navigability.

## Implementation Details

The theme is defined in `app/globals.css` using Tailwind v4 `@theme` extension.

```css
@theme inline {
  --color-primary: var(--primary);
  /* ... */
}
```

## Component Implementation Examples

### Button
```tsx
import { Button } from "@/components/ui/button"

export function ButtonDemo() {
  return (
    <div className="flex gap-4">
      <Button variant="default">Primary Teal</Button>
      <Button variant="secondary">Blue-Gray</Button>
      <Button variant="outline" className="ai-glow">AI Enhanced</Button>
    </div>
  )
}
```

### Input
```tsx
import { Input } from "@/components/ui/input"

export function InputDemo() {
  return (
    <Input 
      placeholder="Type something..." 
      className="input-base focus-visible:ring-ring"
    />
  )
}
```

### Card
```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export function CardDemo() {
  return (
    <Card className="card">
      <CardHeader>
        <CardTitle>Crevasse Card</CardTitle>
      </CardHeader>
      <CardContent>
        Ergonomic design for LMS interfaces.
      </CardContent>
    </Card>
  )
}
```

### Table
```tsx
export function TableDemo() {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Deep Navy</td>
            <td>Architect</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```
