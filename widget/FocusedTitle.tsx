import { createBinding, createComputed } from "ags"
import Pango from "gi://Pango"
import AstalHyprland from "gi://AstalHyprland"
import { hyprTick } from "../lib/hyprland"
import { iconForClient, shortTitle } from "../lib/utils"

export default function FocusedTitle() {
  const hypr = AstalHyprland.get_default()
  const client = createBinding(hypr, "focusedClient")

  const liveClient = createComputed(() => {
    void hyprTick()
    try {
      return hypr.get_focused_client?.() ?? client()
    } catch {
      return client()
    }
  })

  const visible = createComputed(() => {
    const c = liveClient()
    if (!c) return false
    try {
      return !!c.get_address() && c.get_address() !== "0x"
    } catch {
      return false
    }
  })

  const title = createComputed(() => {
    const c = liveClient()
    if (!c) return ""
    return shortTitle(c.get_title() || c.get_class() || "")
  })

  const icon = createComputed(() => {
    const c = liveClient()
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
