# AppShell Layout — Usage

This document explains how to use the AppShell layout, add navigation items, and how permission filtering and theming work.

Files added:
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/TopBar.tsx`
- `apps/web/src/components/layout/Breadcrumbs.tsx`
- `apps/web/src/config/navigation.ts`

How to wrap a page with `AppShell`:

1. In an authenticated route (App Router), import and render `AppShell` as a client wrapper:

```tsx
import AppShell from '@/components/layout/AppShell';

export default function ProtectedPage() {
  return (
    <AppShell>
      <div>Protected content goes here</div>
    </AppShell>
  );
}
```

Navigation items (single source of truth):

- Edit `apps/web/src/config/navigation.ts` to add/remove items. Each item supports `requiredPermissions?: string[]`.
- Permission-driven: an item without `requiredPermissions` is visible to all authenticated users. An item with `requiredPermissions` is visible when the authenticated user's JWT `permissions` array contains at least one of the listed permissions.

Theme behavior:

- The layout respects system preference by default.
- Users can toggle theme via the theme button in the `TopBar`. Preference is stored in `localStorage` under `gradeloop:theme`.
- Theme is applied by setting `data-theme="dark"` on `<html>` and adding the `dark` class (no inline hardcoded colors — components use Crevasse variables such as `--background`, `--card`, and `--primary`).
- The implementation avoids page scroll when the mobile drawer is open and minimizes layout shift by applying theme settings immediately on mount.

Responsive behavior summary:

- Desktop (lg and up): Sidebar is visible with a 240px-like layout (implemented via Tailwind `w-60` classes in the visual design; adjust in CSS if you need exact sizing).
- Tablet (md): Sidebar is collapsible — use the collapse button in the Sidebar / TopBar.
- Mobile (below md): Sidebar is hidden by default and opens as a slide-in drawer. The drawer traps ESC and outside click to close.

JWT / Auth integration:

- The layout expects an existing `useAuth()` hook returning `{ user }` where `user.permissions` is `string[]` from the JWT. Redirects for unauthenticated users should be handled by middleware elsewhere.

Accessibility:

- A skip-to-content link is provided.
- Sidebar toggle button has `aria-expanded`.
- Breadcrumbs use `<nav aria-label="Breadcrumb">`.
- ESC closes mobile drawer; outside click closes drawer.

Extending navigation:

- Add a new `NavItem` to `navigation.ts` and include `requiredPermissions` if access should be gated.
- Changes to permissions reflect after user refresh (JWT is read from the auth context on mount).
