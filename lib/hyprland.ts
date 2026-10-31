import { createState } from "ags"
import AstalHyprland from "gi://AstalHyprland"

const hypr = AstalHyprland.get_default()

function liveFocusedId(): number {
  try {
    return (
      hypr.get_focused_workspace?.()?.get_id() ??
      hypr.focusedWorkspace?.get_id() ??
      1
    )
  } catch {
    return 1
  }
}

/** workspace>>3 · workspacev2>>3,name · focusedmon>>eDP-1,3 */
function idFromEvent(event: string, data: string): number | null {
  const ev = event.toLowerCase()
  const parts = data.split(",")
  let raw: string | undefined
  if (ev.startsWith("workspace")) raw = parts[0]
  else if (ev.startsWith("focusedmon")) raw = parts[1] ?? parts.at(-1)
  else if (ev === "activespecial" || ev === "activespecialv2") raw = parts[0]
  if (raw == null || raw === "") return null
  const id = Number(raw)
  return Number.isFinite(id) && id !== 0 ? id : null
}

const [tick, setTick] = createState(0)
const [focusedId, setFocusedId] = createState(liveFocusedId())

function syncFromHypr() {
  const id = liveFocusedId()
  if (id > 0) setFocusedId(id)
  setTick((n) => n + 1)
}

let hooked = false
if (!hooked) {
  hooked = true
  hypr.connect("event", (_h, event: string, data: string) => {
    const parsed = idFromEvent(String(event || ""), String(data || ""))
    if (parsed != null) setFocusedId(parsed)
    else {
      const live = liveFocusedId()
      if (live > 0) setFocusedId(live)
    }
    setTick((n) => n + 1)
  })
  hypr.connect("notify::focused-workspace", syncFromHypr)
  hypr.connect("notify::focused-client", syncFromHypr)
  hypr.connect("notify::clients", syncFromHypr)
  hypr.connect("notify::workspaces", syncFromHypr)
}

/** Bump this in computeds so they re-run on Hyprland IPC events. */
export function hyprTick(): number {
  return tick()
}

export function hyprFocusedId(): number {
  return focusedId()
}

export function hyprland(): AstalHyprland.Hyprland {
  return hypr
}
