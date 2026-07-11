import { createBinding, createComputed } from "ags"
import Pango from "gi://Pango"
import AstalHyprland from "gi://AstalHyprland"
import { iconForClient, shortTitle } from "../lib/utils"

export default function FocusedTitle() {
  const hypr = AstalHyprland.get_default()
  const client = createBinding(hypr, "focusedClient")

  const visible = createComputed(() => {
    const c = client()
    if (!c) return false
    try {
      return !!c.get_address() && c.get_address() !== "0x"
    } catch {
      return false
    }
  })

  const title = createComputed(() => {
    const c = client()
    if (!c) return ""
    return shortTitle(c.get_title() || c.get_class() || "")
  })

  const icon = createComputed(() => {
    const c = client()
    return c ? iconForClient(c) : "application-x-executable"
  })

  return (
    <box class="FocusedTitle module" spacing={6} visible={visible}>
      <image iconName={icon} pixelSize={16} />
      <label
        label={title}
        maxWidthChars={24}
        ellipsize={Pango.EllipsizeMode.END}
      />
    </box>
  )
}
