import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
<<<<<<< HEAD
import AppShell from "@/components/layout/AppShell";
=======
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/ui/theme-toggle";
>>>>>>> b740d5e (feat(web): add floating dark mode toggle and fix build errors [GRADELOOP-43])

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GradeLoop | Intelligent LMS",
  description:
    "Experience the next generation of academic management with intelligent insights and seamless collaboration.",
  other: {
    "csrf-token": "placeholder", // Will be replaced by middleware with actual CSRF token
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="csrf-token" content="placeholder" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={`${lexend.variable} antialiased font-sans`}>
<<<<<<< HEAD
        <AppShell>{children}</AppShell>
=======
        <Providers>
          {children}
          <ThemeToggle />
        </Providers>
>>>>>>> b740d5e (feat(web): add floating dark mode toggle and fix build errors [GRADELOOP-43])
      </body>
    </html>
  );
}
