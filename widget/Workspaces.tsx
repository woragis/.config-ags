import { createBinding, createComputed, For } from "ags"
import { execAsync } from "ags/process"
import AstalHyprland from "gi://AstalHyprland"
import { iconForClient } from "../lib/utils"

const MAX_ICONS = 3
const WORKSPACE_IDS = [1, 2, 3, 4, 5]

function dispatch(...args: string[]) {
  execAsync(["hyprctl", "dispatch", ...args]).catch(printerr)
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

  // Parent is a box (not a button) so app icon buttons are not nested —
  // nested Gtk.Buttons eat/break workspace clicks.
  const className = createComputed(() => {
    const parts = ["workspace"]
    if (isActive()) parts.push("active")
    if (isOccupied()) parts.push("occupied")
    else parts.push("empty")
    return parts.join(" ")
  })

  return (
    <box class={className} spacing={2}>
      <button
        class="ws-id-btn"
        onClicked={() => dispatch("workspace", `${id}`)}
        tooltipText={`Workspace ${id}`}
      >
        <label class="ws-id" label={`${id}`} />
      </button>

      <box class="ws-icons" spacing={1} visible={isOccupied}>
        <For each={visible}>
          {(client) => (
            <button
              class="ws-app"
              tooltipText={client.get_title()}
              onClicked={() =>
                dispatch("focuswindow", `address:${client.get_address()}`)
              }
            >
              <image iconName={iconForClient(client)} pixelSize={16} />
            </button>
          )}
        </For>
        <label
          class="ws-overflow"
          visible={overflow((n) => n > 0)}
          label={overflow((n) => `+${n}`)}
        />
      </box>
    </box>
  )
}

export default function Workspaces() {
  return (
    <box class="Workspaces cluster" spacing={2}>
      {WORKSPACE_IDS.map((id) => (
        <WorkspaceButton id={id} />
      ))}
    </box>
  )
}
