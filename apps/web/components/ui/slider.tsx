"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface SliderProps {
  value?: number[]
  onValueChange?: (value: number[]) => void
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  className?: string
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue = [0], onValueChange, min = 0, max = 100, step = 1 }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue[0])
    const currentValue = value !== undefined ? value[0] : internalValue

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseInt(e.target.value, 10)
      setInternalValue(newValue)
      if (onValueChange) {
        onValueChange([newValue])
      }
    }

    return (
      <div className="relative w-full">
        <input
          type="range"
          ref={ref}
          value={String(currentValue)}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
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
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }