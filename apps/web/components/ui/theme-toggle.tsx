"use client";

import * as React from "react";
import { Monitor, Moon, Sun, Palette, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeOption = "light" | "dark" | "system";

interface ThemeConfig {
  value: ThemeOption;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const themeConfigs: ThemeConfig[] = [
  {
    value: "light",
    label: "Light",
    icon: <Sun className="h-4 w-4" />,
    description: "Light theme with bright colors",
  },
  {
    value: "dark",
    label: "Dark",
    icon: <Moon className="h-4 w-4" />,
    description: "Dark theme with muted colors",
  },
  {
    value: "system",
    label: "System",
    icon: <Monitor className="h-4 w-4" />,
    description: "Follow system preference",
  },
];

export function ThemeToggle() {
  const { theme, setTheme, themes, systemTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const currentTheme = theme || "system";
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const getCurrentIcon = () => {
    const config = themeConfigs.find((t) => t.value === currentTheme);
    return config?.icon || <Monitor className="h-4 w-4" />;
  };

  const handleThemeChange = (newTheme: ThemeOption) => {
    setTheme(newTheme);
    setIsExpanded(false);
  };

  return (
    <div className="fixed bottom-20 right-6 z-40 flex flex-col items-end gap-2">
      {/* Expanded Theme Options */}
      {isExpanded && (
        <div className="flex flex-col gap-1 mb-2 animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
          {themeConfigs.map((config) => (
            <Button
              key={config.value}
              variant="outline"
              size="sm"
              onClick={() => handleThemeChange(config.value)}
              className={cn(
                "h-10 w-auto min-w-[120px] justify-start gap-2 bg-background/80 backdrop-blur-md border-border/50 shadow-lg hover:shadow-xl transition-all duration-300",
                currentTheme === config.value &&
                  "bg-primary/10 border-primary/30 text-primary",
              )}
            >
              {config.icon}
              <span className="text-sm font-medium">{config.label}</span>
              {currentTheme === config.value && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </Button>
          ))}

          {/* Theme Info Panel for Testing */}
          <div className="mt-2 p-3 rounded-lg bg-background/90 backdrop-blur-md border border-border/50 shadow-lg text-xs text-muted-foreground max-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-3 w-3" />
              <span className="font-medium">Theme Info</span>
            </div>
            <div className="space-y-1">
              <div>
                Current:{" "}
                <span className="text-foreground font-mono">
                  {currentTheme}
                </span>
              </div>
              <div>
                Resolved:{" "}
                <span className="text-foreground font-mono">
                  {resolvedTheme}
                </span>
              </div>
              <div>
                System:{" "}
                <span className="text-foreground font-mono">{systemTheme}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "h-12 w-12 rounded-full bg-background/80 backdrop-blur-md border-border/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300",
          "dark:shadow-white/10 dark:hover:shadow-white/20",
          isExpanded && "scale-105 bg-primary/10 border-primary/30",
        )}
        aria-label={isExpanded ? "Close theme switcher" : "Open theme switcher"}
      >
        {isExpanded ? (
          <Settings className="h-5 w-5 animate-spin" />
        ) : (
          <div className="relative">
            {getCurrentIcon()}
            {/* Theme indicator dot */}
            <div
              className={cn(
                "absolute -top-1 -right-1 h-2 w-2 rounded-full border border-background",
                resolvedTheme === "dark"
                  ? "bg-blue-500"
                  : resolvedTheme === "light"
                    ? "bg-yellow-500"
                    : "bg-gray-500",
              )}
            />
          </div>
        )}
        <span className="sr-only">
          {isExpanded ? "Close theme options" : "Toggle theme"}
        </span>
      </Button>

      {/* Quick Toggle Button (when collapsed) */}
      {!isExpanded && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const nextTheme = currentTheme === "light" ? "dark" : "light";
            setTheme(nextTheme);
          }}
          className="h-8 w-8 rounded-full bg-background/60 backdrop-blur-sm border border-border/30 shadow-md hover:shadow-lg transition-all duration-200 opacity-70 hover:opacity-100"
          aria-label="Quick toggle between light and dark"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-3 w-3" />
          ) : (
            <Moon className="h-3 w-3" />
          )}
        </Button>
      )}

      {/* Testing Label */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-2 px-2 py-1 text-xs text-muted-foreground bg-background/60 backdrop-blur-sm border border-border/30 rounded shadow-sm">
          Testing Mode
        </div>
      )}
    </div>
  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-background/80 backdrop-blur-md border-border/50 shadow-lg shadow-black/10 hover:shadow-xl hover:scale-105 transition-all duration-300 dark:shadow-white/10"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
