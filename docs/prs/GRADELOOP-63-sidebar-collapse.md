# fix(layout): sidebar collapse wiring, logo image, topbar toggle behavior

## Summary

This PR fixes the sidebar collapse behavior so the collapsed and expanded widths are applied correctly across breakpoints. It also adjusts the UI `Sidebar` to avoid hardcoded lg-width that conflicted with layout-level width control.

## Changes

- apps/web/components/ui/sidebar.tsx
  - Removed hardcoded `lg:w-[280px]` from the base `Sidebar` component so parent layout can control widths.
- apps/web/components/layout/Sidebar.tsx
  - Added explicit `lg:w-[72px]` and `lg:w-[280px]` variants when `collapsed` toggles to ensure the collapsed state overrides widths.

## Files touched
- apps/web/components/ui/sidebar.tsx
- apps/web/components/layout/Sidebar.tsx

## Testing
1. Run the web app locally:

```bash
cd apps/web
bun run dev --hostname 0.0.0.0 --port 3001
```

2. Open the app in a browser and toggle the sidebar collapse button. Confirm:
- Sidebar reduces to a narrow width (~72px) on collapse for `lg` and up.
- Labels hide and icons center when collapsed.
- Drawer behavior on small screens is unaffected.

## Notes
- If a dev server was already running, stop it before starting on a new port. If `.next/dev/lock` remains, delete it after ensuring no other Next.js instance is running.

---

Requested-by: GRADELOOP-63
