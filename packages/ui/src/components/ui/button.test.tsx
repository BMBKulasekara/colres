import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { Button } from "@repo/ui/components/ui/button"

describe("Button", () => {
  test("renders a native button with the default variant and size", () => {
    render(<Button>Save</Button>)

    const button = screen.getByRole("button", { name: "Save" })
    expect(button).toHaveAttribute("data-variant", "default")
    expect(button).toHaveAttribute("data-size", "default")
    expect(button).toHaveClass("bg-primary")
  })

  test("applies the requested variant and lets className override it", () => {
    render(
      <Button variant="destructive" size="sm" className="bg-red-700">
        Delete
      </Button>
    )

    const button = screen.getByRole("button", { name: "Delete" })
    expect(button).toHaveAttribute("data-variant", "destructive")
    expect(button).toHaveClass("h-8", "bg-red-700")
    expect(button).not.toHaveClass("bg-destructive")
  })

  test("calls onClick, but not when disabled", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)

    await user.click(screen.getByRole("button", { name: "Go" }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    )
    await user.click(screen.getByRole("button", { name: "Go" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test("asChild renders the child element with button styling", () => {
    render(
      <Button asChild variant="link">
        <a href="/docs">Docs</a>
      </Button>
    )

    const link = screen.getByRole("link", { name: "Docs" })
    expect(link).toHaveAttribute("href", "/docs")
    expect(link).toHaveAttribute("data-slot", "button")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
