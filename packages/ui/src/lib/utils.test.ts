import { describe, expect, test } from "vitest"

import { cn } from "@repo/ui/lib/utils"

describe("cn", () => {
  test("joins class names and drops falsy values", () => {
    expect(cn("px-2", false, undefined, null, "font-bold")).toBe("px-2 font-bold")
  })

  test("a later Tailwind utility overrides a conflicting earlier one", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4")
    expect(cn("bg-primary", { "bg-destructive": true })).toBe("bg-destructive")
  })
})
