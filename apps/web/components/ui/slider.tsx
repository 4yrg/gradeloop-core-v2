"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: number[]
  onValueChange?: (value: number[]) => void
  max?: number
  step?: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value = [0], onValueChange, max = 100, step = 1, ...props }, ref) => {
    const currentValue = value[0] ?? 0

    return (
      <div className="relative w-full">
        <input
          type="range"
          ref={ref}
          value={currentValue}
          max={max}
          step={step}
          onChange={(e) => {
            if (onValueChange) {
              onValueChange([parseInt(e.target.value, 10)])
            }
          }}
          className={cn(
            "w-full h-2 bg-[hsl(var(--shell-sidebar-fg))]/10 rounded-full appearance-none cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-4",
            "[&::-webkit-slider-thumb]:h-4",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:shadow-md",
            "[&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-moz-range-thumb]:w-4",
            "[&::-moz-range-thumb]:h-4",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-primary",
            "[&::-moz-range-thumb]:border-0",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }