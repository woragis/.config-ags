import { createBinding, createComputed, For } from "ags"
import { Gtk } from "ags/gtk4"
import { exec, execAsync } from "ags/process"
import AstalTray from "gi://AstalTray"
import { hyprTick } from "../lib/hyprland"

const HIDE_WS = "special:trayhide"
const SECONDARY = 3

type HyWin = {
  class?: string
  address?: string
  mapped?: boolean
  hidden?: boolean
  workspace?: { id?: number }
}

/** Map tray SNI id/title → Hyprland window class. */
const HINTS: Array<{ re: RegExp; classes: string[] }> = [
  {
    re: /discord|vesktop|webcord|legcord/,
    classes: ["discord", "vesktop", "webcord", "legcord", "discordcanary"],
  },
  {
    re: /strawberry/,
    classes: ["strawberry", "org.strawberrymusicplayer.strawberry"],
  },
  { re: /spotify/, classes: ["spotify"] },
  {
    re: /telegram/,
    classes: ["org.telegram.desktop", "telegram-desktop", "telegramdesktop"],
  },
  { re: /slack/, classes: ["slack"] },
  { re: /steam/, classes: ["steam"] },
  { re: /signal/, classes: ["signal", "signal-desktop"] },
  { re: /element/, classes: ["element", "element-desktop"] },
  { re: /qbittorrent/, classes: ["org.qbittorrent.qBittorrent", "qbittorrent"] },
]

function itemNeedle(item: AstalTray.TrayItem): string {
  return [
    item.id,
    item.itemId,
    item.title,
    item.iconName,
    item.tooltipText,
    item.tooltipMarkup,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function hintClasses(item: AstalTray.TrayItem): string[] {
  const needle = itemNeedle(item)
  for (const hint of HINTS) {
    if (hint.re.test(needle)) return hint.classes
  }
  return []
}

function listWindows(): HyWin[] {
  try {
    const raw = exec(["hyprctl", "clients", "-j"])
    const parsed = JSON.parse(raw) as HyWin[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function findWindow(item: AstalTray.TrayItem): HyWin | null {
  const classes = hintClasses(item)
  const wins = listWindows()
  if (classes.length > 0) {
    const found = wins.find((w) => {
      const cls = (w.class || "").toLowerCase()
      return classes.some((h) => cls === h || cls.includes(h))
    })
    if (found) return found
  }

  const needle = itemNeedle(item)
  return (
    wins.find((w) => {
      const cls = (w.class || "").toLowerCase()
      return cls.length >= 3 && needle.includes(cls)
    }) ?? null
  )
}

function isShown(win: HyWin): boolean {
  if (win.mapped === false) return false
  if (win.hidden) return false
  const id = win.workspace?.id ?? 0
  return id > 0
}

function hyprDispatch(lua: string) {
  return execAsync(["hyprctl", "dispatch", lua]).catch(printerr)
}

function focusedWorkspaceId(): number {
  try {
    const raw = exec(["hyprctl", "activeworkspace", "-j"])
    const id = Number(JSON.parse(raw)?.id)
    return id > 0 ? id : 1
  } catch {
    return 1
  }
}

function hideWindow(win: HyWin) {
  const cls = win.class
  if (!cls) return
  const here = focusedWorkspaceId()
  // follow=false is required: otherwise Hyprland opens special:trayhide as an overlay
  return hyprDispatch(
    `hl.dsp.window.move({ window = 'class:${cls}', workspace = "${HIDE_WS}", follow = false })`,
  ).then(() => hyprDispatch(`hl.dsp.focus({ workspace = ${here} })`))
}

function showWindow(win: HyWin) {
  const cls = win.class
  if (!cls) return
  const ws = focusedWorkspaceId()
  return hyprDispatch(
    `hl.dsp.window.move({ window = 'class:${cls}', workspace = ${ws}, follow = true })`,
  )
}

function toggleTrayApp(item: AstalTray.TrayItem) {
  const win = findWindow(item)
  if (win && isShown(win)) {
    hideWindow(win)
    return
  }
  if (win) {
    showWindow(win)
    return
  }
  try {
    item.activate(0, 0)
  } catch (err) {
    printerr(err)
  }
}

function TrayItemButton({ item }: { item: AstalTray.TrayItem }) {
  const gicon = createBinding(item, "gicon")
  const title = createBinding(item, "title")
  const id = createBinding(item, "id")
  const status = createBinding(item, "status")

  const open = createComputed(() => {
    void hyprTick()
    const w = findWindow(item)
    return !!(w && isShown(w))
  })

  const className = createComputed(() => {
    const parts = ["tray-item"]
    if (open()) parts.push("open")
    if (status() === AstalTray.Status.NEEDS_ATTENTION) parts.push("attention")
    return parts.join(" ")
  })

  const tip = createComputed(() => {
    const t = title() || id() || "Background app"
    return `${t} — click to show/hide`
  })

  return (
    <button
      class={className}
      tooltipText={tip}
      onClicked={() => toggleTrayApp(item)}
      $={(self) => {
        const syncActions = () => {
          try {
            self.insert_action_group("dbusmenu", item.actionGroup)
          } catch {
            // no menu yet
          }
        }
        syncActions()
        const a = item.connect("notify::action-group", syncActions)

        let popover: Gtk.PopoverMenu | null = null
        const right = new Gtk.GestureClick()
        right.set_button(SECONDARY)
        right.connect("pressed", () => {
          try {
            item.about_to_show()
          } catch {
            // ignore
          }
          syncActions()
          const model = item.menuModel
          if (!model) {
            try {
              item.secondary_activate(0, 0)
            } catch {
              // ignore
            }
            return
          }
          if (!popover) {
            popover = Gtk.PopoverMenu.new_from_model(model)
            popover.set_parent(self)
            popover.set_has_arrow(false)
          } else {
            popover.set_menu_model(model)
          }
          popover.popup()
        })
        self.add_controller(right)

        self.connect("destroy", () => {
          try {
            item.disconnect(a)
          } catch {
            // ignore
          }
        })
      }}
    >
      <image gicon={gicon} pixelSize={16} />
    </button>
  )
}

export default function Tray() {
  const tray = AstalTray.get_default()
  const items = createBinding(tray, "items")
  const visible = createComputed(() => (items()?.length ?? 0) > 0)

  return (
    <box class="Tray cluster" spacing={2} visible={visible}>
      <For each={items} id={(item) => item.itemId || item.id}>
        {(item) => <TrayItemButton item={item} />}
      </For>
    </box>
  )
}
