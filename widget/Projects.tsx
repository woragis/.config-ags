import { createState } from "ags"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { exec, execAsync } from "ags/process"
import { createPoll } from "ags/time"
import app from "ags/gtk4/app"

type Project = {
  name: string
  unit: string
  url: string
  icon: string
}

/** Local systems listen on 127.0.0.1 from port 10000 up. Trends uses 10002 for the panel and 10003 for the API. */
const PROJECTS: Project[] = [
  {
    name: "Conversas",
    unit: "conversations",
    url: "http://127.0.0.1:10000",
    icon: "󰭹",
  },
  {
    name: "Domínios",
    unit: "domains-finder",
    url: "http://127.0.0.1:10001",
    icon: "󰖟",
  },
  {
    name: "Trends",
    unit: "trends.target",
    url: "http://127.0.0.1:10002",
    icon: "󰄧",
  },
]

function unitActive(unit: string): boolean {
  try {
    return exec(["systemctl", "--user", "is-active", unit]).trim() === "active"
  } catch {
    return false
  }
}

function readStatus(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const project of PROJECTS) next[project.unit] = unitActive(project.unit)
  return next
}

export default function Projects({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  let win: Astal.Window
  let shown = false
  let busy = false
  const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor
  const [active, setActive] = createState<Record<string, boolean>>({})

  function refresh() {
    setActive(readStatus())
  }

  createPoll(0, 1000, () => {
    if (shown) refresh()
    return 0
  })

  function hide() {
    win.visible = false
  }

  async function toggle(project: Project) {
    if (busy) return
    busy = true
    const on = !!active()[project.unit]
    try {
      await execAsync(["systemctl", "--user", on ? "stop" : "start", project.unit])
      setActive({ ...active(), [project.unit]: !on })
      if (!on) execAsync(["xdg-open", project.url]).catch(printerr)
    } catch (error) {
      printerr(error)
    } finally {
      busy = false
      refresh()
    }
  }

  function open(project: Project) {
    execAsync(["xdg-open", project.url]).catch(printerr)
  }

  function logs(project: Project) {
    execAsync([
      "ghostty",
      "-e",
      "journalctl",
      "--user",
      "-u",
      project.unit,
      "-f",
    ]).catch(printerr)
  }

  return (
    <window
      $={(self) => {
        win = self
        const keys = new Gtk.EventControllerKey()
        keys.connect("key-pressed", (_controller, keyval) => {
          if (keyval === Gdk.KEY_Escape) {
            hide()
            return true
          }
          return false
        })
        self.add_controller(keys)
        self.connect("notify::visible", () => {
          shown = self.visible
          if (shown) refresh()
        })
      }}
      visible={false}
      name="projects"
      namespace="projects"
      class="Projects"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT | BOTTOM}
      application={app}
    >
      <overlay hexpand vexpand>
        <box
          class="projects-backdrop"
          hexpand
          vexpand
          $={(self) => {
            const click = new Gtk.GestureClick()
            click.connect("pressed", () => hide())
            self.add_controller(click)
          }}
        />
        <box
          $type="overlay"
          class="projects-card"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={12}
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.CENTER}
        >
          <label class="projects-title" xalign={0} label="Projetos locais" />
          {PROJECTS.map((project) => (
            <box class="projects-row" spacing={12}>
              <label class="projects-glyph" label={project.icon} />
              <box
                orientation={Gtk.Orientation.VERTICAL}
                hexpand
                valign={Gtk.Align.CENTER}
              >
                <label class="projects-name" xalign={0} label={project.name} />
                <label
                  class={active((state) =>
                    state[project.unit] ? "projects-status on" : "projects-status",
                  )}
                  xalign={0}
                  label={active((state) =>
                    state[project.unit] ? "ligado" : "desligado",
                  )}
                />
              </box>
              <button
                class={active((state) =>
                  state[project.unit] ? "projects-action power on" : "projects-action power",
                )}
                tooltipText={active((state) =>
                  state[project.unit] ? "Desligar" : "Ligar",
                )}
                onClicked={() => toggle(project)}
              >
                <label label="󰐥" />
              </button>
              <button
                class="projects-action"
                tooltipText="Abrir"
                onClicked={() => open(project)}
              >
                <label label="󰖟" />
              </button>
              <button
                class="projects-action"
                tooltipText="Logs"
                onClicked={() => logs(project)}
              >
                <label label="󰒍" />
              </button>
            </box>
          ))}
        </box>
      </overlay>
    </window>
  )
}
