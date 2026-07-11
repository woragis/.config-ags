import { createBinding, createComputed, For } from "ags"
import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import AstalHyprland from "gi://AstalHyprland"
import { iconForClient } from "../lib/utils"

const MAX_ICONS = 3
const WORKSPACE_IDS = [1, 2, 3, 4, 5]

function dispatch(...args: string[]) {
  execAsync(["hyprctl", "dispatch", ...args]).catch(printerr)
}

function getClients(hypr: AstalHyprland.Hyprland): AstalHyprland.Client[] {
  try {
    if (typeof hypr.get_clients === "function") return hypr.get_clients() ?? []
  } catch {
    // fall through
  }
  return (hypr.clients as AstalHyprland.Client[] | null) ?? []
}

function occupiedWorkspaceIds(clients: AstalHyprland.Client[]): number[] {
  const present = new Set<number>()
  for (const c of clients) {
    try {
      const id = c.get_workspace()?.get_id()
      if (id != null && WORKSPACE_IDS.includes(id)) present.add(id)
    } catch {
      // ignore
    }
  }
  return WORKSPACE_IDS.filter((id) => present.has(id))
}

/** Cycle focus among occupied workspaces only. */
function cycleOccupied(delta: number) {
  const hypr = AstalHyprland.get_default()
  const occupied = occupiedWorkspaceIds(getClients(hypr))
  if (occupied.length === 0) return

  let current = -1
  try {
    current =
      hypr.get_focused_workspace?.()?.get_id() ??
      hypr.focusedWorkspace?.get_id() ??
      -1
  } catch {
    current = -1
  }

  let idx = occupied.indexOf(current)
  if (idx < 0) {
    dispatch("workspace", `${occupied[delta > 0 ? 0 : occupied.length - 1]}`)
    return
  }
  const next = occupied[(idx + delta + occupied.length) % occupied.length]
  if (next !== current) dispatch("workspace", `${next}`)
}

function WorkspaceButton({ id }: { id: number }) {
  const hypr = AstalHyprland.get_default()
  const clients = createBinding(hypr, "clients")
  const focused = createBinding(hypr, "focusedWorkspace")

  const wsClients = createComputed(() => {
    const list = clients()
    if (!list) return []
    return list.filter((c) => {
      try {
        return c.get_workspace()?.get_id() === id
      } catch {
        return false
      }
    })
  })

  const visible = createComputed(() => wsClients().slice(0, MAX_ICONS))
  const overflow = createComputed(() => Math.max(0, wsClients().length - MAX_ICONS))
  const isActive = createComputed(() => {
    try {
      return focused()?.get_id() === id
    } catch {
      return false
    }
  })
  const isOccupied = createComputed(() => wsClients().length > 0)

  // C active: quiet index · D inactive empty: dot · inactive occupied: icons only
  const showIndex = createComputed(() => isActive())
  const showDot = createComputed(() => !isActive() && !isOccupied())
  const showIcons = createComputed(() => isOccupied())

  const className = createComputed(() => {
    const parts = ["workspace"]
    if (isActive()) parts.push("active")
    if (isOccupied()) parts.push("occupied")
    else parts.push("empty")
    return parts.join(" ")
  })

  const tip = createComputed(() => {
    const n = wsClients().length
    if (n === 0) return `Workspace ${id} (empty)`
    return `Workspace ${id} · ${n} window${n === 1 ? "" : "s"}`
  })

  return (
    <box class={className} spacing={2} tooltipText={tip}>
      <button
        class="ws-index-btn"
        visible={showIndex}
        onClicked={() => dispatch("workspace", `${id}`)}
        tooltipText={`Workspace ${id}`}
      >
        <label class="ws-id" label={`${id}`} />
      </button>

      <button
        class="ws-dot-btn"
        visible={showDot}
        onClicked={() => dispatch("workspace", `${id}`)}
        tooltipText={`Workspace ${id} (empty)`}
      >
        <label class="ws-dot" label="●" />
      </button>

      <box class="ws-icons" spacing={1} visible={showIcons}>
        <For each={visible}>
          {(client) => (
            <button
              class="ws-app"
              tooltipText={client.get_title()}
              onClicked={() =>
                dispatch("focuswindow", `address:${client.get_address()}`)
              }
            >
              <image iconName={iconForClient(client)} pixelSize={22} />
            </button>
          )}
        </For>
        <button
          class="ws-overflow-btn"
          visible={overflow((n) => n > 0)}
          onClicked={() => dispatch("workspace", `${id}`)}
          tooltipText={`Go to workspace ${id}`}
        >
          <label class="ws-overflow" label={overflow((n) => `+${n}`)} />
        </button>
      </box>
    </box>
  )
}

export default function Workspaces() {
  return (
    <box
      class="Workspaces cluster"
      spacing={2}
      tooltipText="Scroll: cycle occupied workspaces"
      $={(self) => {
        const scroll = new Gtk.EventControllerScroll({
          flags: Gtk.EventControllerScrollFlags.VERTICAL,
        })
        scroll.connect("scroll", (_c, _dx, dy) => {
          if (dy === 0) return false
          cycleOccupied(dy > 0 ? 1 : -1)
          return true
        })
        self.add_controller(scroll)
      }}
    >
      {WORKSPACE_IDS.map((id) => (
        <WorkspaceButton id={id} />
      ))}
    </box>
  )
}
