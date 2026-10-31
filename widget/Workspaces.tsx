import { createBinding, createComputed, For } from "ags"
import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import AstalHyprland from "gi://AstalHyprland"
import { hyprFocusedId, hyprTick } from "../lib/hyprland"
import { iconForClient } from "../lib/utils"

const MAX_ICONS = 3
/** Always show at least this many slots; expand when higher IDs are used. */
const MIN_WORKSPACES = 5
const MAX_WORKSPACES = 20

/**
 * Hyprland lua-config builds parse `hyprctl dispatch` as Lua.
 * Classic `workspace 3` / `focuswindow` fail — use hl.dsp.* forms instead.
 */
function focusWorkspace(id: number | string) {
  return execAsync([
    "hyprctl",
    "dispatch",
    `hl.dsp.focus({ workspace = ${typeof id === "number" ? id : JSON.stringify(id)} })`,
  ]).catch(printerr)
}

function focusWindow(address: string) {
  const raw = String(address || "").trim()
  if (!raw) return Promise.resolve()
  const addr = raw.startsWith("address:") ? raw : `address:${raw}`
  // Focusing a window also switches to its workspace.
  return execAsync([
    "hyprctl",
    "dispatch",
    `hl.dsp.focus({ window = '${addr}' })`,
  ]).catch(printerr)
}

/** Switch workspace then focus the window (sequential — avoid races). */
async function activateClient(workspaceId: number, address: string) {
  await focusWorkspace(workspaceId)
  await focusWindow(address)
}

function getClients(hypr: AstalHyprland.Hyprland): AstalHyprland.Client[] {
  try {
    if (typeof hypr.get_clients === "function") return hypr.get_clients() ?? []
  } catch {
    // fall through
  }
  return (hypr.clients as AstalHyprland.Client[] | null) ?? []
}

function getWorkspaces(hypr: AstalHyprland.Hyprland): AstalHyprland.Workspace[] {
  try {
    if (typeof hypr.get_workspaces === "function") return hypr.get_workspaces() ?? []
  } catch {
    // fall through
  }
  return (hypr.workspaces as AstalHyprland.Workspace[] | null) ?? []
}

function focusedWorkspaceId(hypr: AstalHyprland.Hyprland): number {
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

/**
 * Show 1..N where N is at least MIN_WORKSPACES and expands to the highest
 * occupied / focused positive workspace (capped).
 *
 * Prefer the `workspaces` binding so creating/moving to WS 6+ updates the bar
 * even when the clients array reference does not change.
 */
function allPositiveWorkspaceIds(
  workspaces: AstalHyprland.Workspace[],
  clients: AstalHyprland.Client[],
  focusedId: number,
): number[] {
  let maxId = MIN_WORKSPACES
  if (focusedId > maxId) maxId = focusedId

  for (const w of workspaces) {
    try {
      const id = w.get_id()
      if (id != null && id > 0 && id > maxId) maxId = id
    } catch {
      // ignore
    }
  }

  for (const c of clients) {
    try {
      const id = c.get_workspace()?.get_id()
      if (id != null && id > 0 && id > maxId) maxId = id
    } catch {
      // ignore
    }
  }

  maxId = Math.min(Math.max(maxId, MIN_WORKSPACES), MAX_WORKSPACES)
  return Array.from({ length: maxId }, (_, i) => i + 1)
}

function clientsOnWorkspace(
  id: number,
  workspaces: AstalHyprland.Workspace[],
  clients: AstalHyprland.Client[],
): AstalHyprland.Client[] {
  const ws = workspaces.find((w) => {
    try {
      return w.get_id() === id
    } catch {
      return false
    }
  })
  if (ws) {
    try {
      const list = ws.get_clients?.() ?? []
      if (list.length > 0) return list
    } catch {
      // fall through to global filter
    }
  }
  return clients.filter((c) => {
    try {
      return c.get_workspace()?.get_id() === id
    } catch {
      return false
    }
  })
}

function occupiedWorkspaceIds(
  workspaces: AstalHyprland.Workspace[],
  clients: AstalHyprland.Client[],
  ids: number[],
): number[] {
  return ids.filter((id) => clientsOnWorkspace(id, workspaces, clients).length > 0)
}

/** Cycle focus among occupied workspaces only. */
function cycleOccupied(delta: number) {
  const hypr = AstalHyprland.get_default()
  const clients = getClients(hypr)
  const workspaces = getWorkspaces(hypr)
  const focusedId = focusedWorkspaceId(hypr)
  const ids = allPositiveWorkspaceIds(workspaces, clients, focusedId)
  const occupied = occupiedWorkspaceIds(workspaces, clients, ids)
  if (occupied.length === 0) return

  let idx = occupied.indexOf(focusedId)
  if (idx < 0) {
    focusWorkspace(occupied[delta > 0 ? 0 : occupied.length - 1])
    return
  }
  const next = occupied[(idx + delta + occupied.length) % occupied.length]
  if (next !== focusedId) focusWorkspace(next)
}

function WorkspaceButton({ id }: { id: number }) {
  const hypr = AstalHyprland.get_default()
  const clients = createBinding(hypr, "clients")
  const workspaces = createBinding(hypr, "workspaces")

  const wsClients = createComputed(() => {
    void hyprTick()
    return clientsOnWorkspace(id, workspaces() ?? [], clients() ?? [])
  })

  const visible = createComputed(() => wsClients().slice(0, MAX_ICONS))
  const overflow = createComputed(() => Math.max(0, wsClients().length - MAX_ICONS))
  const isActive = createComputed(() => {
    void hyprTick()
    try {
      return hyprFocusedId() === id
    } catch {
      return false
    }
  })
  const isOccupied = createComputed(() => wsClients().length > 0)

  // Active: index · empty inactive: dot · occupied: icons (+ index when active)
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
        onClicked={() => focusWorkspace(id)}
        tooltipText={`Workspace ${id}`}
      >
        <label class="ws-id" label={`${id}`} />
      </button>

      <button
        class="ws-dot-btn"
        visible={showDot}
        onClicked={() => focusWorkspace(id)}
        tooltipText={`Workspace ${id} (empty)`}
      >
        <label class="ws-dot" label="·" />
      </button>

      <box class="ws-icons" spacing={1} visible={showIcons}>
        <For each={visible} id={(c) => c.get_address()}>
          {(client) => (
            <button
              class="ws-app"
              tooltipText={client.get_title() || `Workspace ${id}`}
              onClicked={() => {
                const addr = client.get_address()
                void activateClient(id, addr)
              }}
            >
              <image iconName={iconForClient(client)} pixelSize={16} />
            </button>
          )}
        </For>
        <button
          class="ws-overflow-btn"
          visible={overflow((n) => n > 0)}
          onClicked={() => focusWorkspace(id)}
          tooltipText={`Go to workspace ${id}`}
        >
          <label class="ws-overflow" label={overflow((n) => `+${n}`)} />
        </button>
      </box>
    </box>
  )
}

export default function Workspaces() {
  const hypr = AstalHyprland.get_default()
  const clients = createBinding(hypr, "clients")
  const workspaces = createBinding(hypr, "workspaces")

  const workspaceIds = createComputed(() => {
    void hyprTick()
    return allPositiveWorkspaceIds(
      workspaces() ?? [],
      clients() ?? [],
      hyprFocusedId(),
    )
  })

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
      <For each={workspaceIds}>{(id) => <WorkspaceButton id={id} />}</For>
    </box>
  )
}
