"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

function formatSegment(segment: string) {
  return segment.replace(/-/g, " ").replace(/(^|\s)\S/g, (t) => t.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const segments = pathname.split("/").filter(Boolean);

  const crumbs = [{ href: "/", label: "Home" }, ...segments.map((seg, i) => ({ href: `/${segments.slice(0, i + 1).join("/")}`, label: formatSegment(seg) }))];

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-neutral-gray">
      <ol className="flex items-center gap-2" role="list">
        {crumbs.map((c, idx) => (
          <li key={c.href} className="flex items-center">
            <button
              onClick={() => router.push(c.href)}
              className="text-neutral-gray hover:text-primary focus:outline-none focus:underline"
            >
              {c.label}
            </button>
            {idx < crumbs.length - 1 && <span className="mx-2">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
