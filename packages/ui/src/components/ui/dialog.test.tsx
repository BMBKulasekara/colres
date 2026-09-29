import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog"

function Example() {
  return (
    <Dialog>
      <DialogTrigger>Open settings</DialogTrigger>
      <DialogContent>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>Change how the editor behaves.</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

describe("Dialog", () => {
  test("opens from its trigger and is labelled by its title", async () => {
    const user = userEvent.setup()
    render(<Example />)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open settings" }))

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeVisible()
  })

  test("closes with the close button and with Escape", async () => {
    const user = userEvent.setup()
    render(<Example />)

    await user.click(screen.getByRole("button", { name: "Open settings" }))
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Open settings" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
