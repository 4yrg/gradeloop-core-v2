"use client";

import * as React from "react";

export default function ThemeTestPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Theme Test Page (Temporarily Disabled)</h1>
      <p className="text-muted-foreground">
        This page is temporarily disabled due to zod version compatibility issues. 
        The authentication components are working correctly.
      </p>
    </div>
  );
}
