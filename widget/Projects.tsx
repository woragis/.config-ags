import { Astal, Gdk, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import app from "ags/gtk4/app"

const API = "http://127.0.0.1:10000/api/projects"
type Component = { id: string; name: string; kind: string; unit?: string; observeUnit?: string; port: number; state: string }
type Project = { id: number; slug: string; name: string; icon: string; url?: string; state: string; note?: string; groupUnit?: string; components?: Component[]; autostartEnabled: boolean; autostartSupported: boolean }

const stateLabel = (state: string) => ({ active: "ligado", partial: "parcial", failed: "falhou", unavailable: "indisponível", missing: "não localizado", manual: "sem serviço", inactive: "desligado" }[state] ?? state)
const stateClass = (state: string) => state === "active" ? "on" : state === "partial" ? "partial" : state === "failed" ? "failed" : ""

export default function Projects({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  let win: Astal.Window
  let list: Gtk.Box
  let shown = false
  let busy = false
  let refreshing = false
  const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor

  async function fetchProjects(): Promise<Project[]> {
    const raw = await execAsync(["curl", "--fail", "--silent", "--show-error", "--max-time", "3", API])
    return JSON.parse(raw).projects as Project[]
  }

  async function refresh() {
    if (!shown || refreshing) return
    refreshing = true
    try {
      const projects = await fetchProjects()
      for (let child = list.get_first_child(); child;) { const next = child.get_next_sibling(); list.remove(child); child = next }
      for (const project of projects) list.append(projectRow(project))
    } catch (error) {
      printerr(`Projects Index indisponível: ${error}`)
    } finally { refreshing = false }
  }

  async function run(project: Project, action: "start" | "stop", component?: Component) {
    if (busy) return
    busy = true
    try {
      const suffix = component ? `?component=${encodeURIComponent(component.id)}` : ""
      await execAsync([
        "curl", "--fail", "--silent", "--show-error", "--max-time", "50",
        "-X", "POST", "-H", "Origin: http://127.0.0.1:10000",
        `${API}/${project.id}/actions/${action}${suffix}`,
      ])
    } catch (error) {
      printerr(`Falha ao ${action === "start" ? "ligar" : "parar"} ${project.name}: ${error}`)
    } finally {
      busy = false
      await refresh()
    }
  }

  async function setAutostart(project: Project, enabled: boolean) {
    if (busy) return
    busy = true
    try {
      await execAsync([
        "curl", "--fail", "--silent", "--show-error", "--max-time", "25",
        "-X", "POST", "-H", "Origin: http://127.0.0.1:10000",
        `${API}/${project.id}/autostart/${enabled ? "enable" : "disable"}`,
      ])
    } catch (error) {
      printerr(`Falha ao alterar inicialização de ${project.name}: ${error}`)
    } finally { busy = false; await refresh() }
  }

  async function disableAllAutostart() {
    if (busy) return
    busy = true
    try {
      await execAsync([
        "curl", "--fail", "--silent", "--show-error", "--max-time", "35",
        "-X", "POST", "-H", "Origin: http://127.0.0.1:10000",
        "http://127.0.0.1:10000/api/autostart/disable",
      ])
    } catch (error) {
      printerr(`Falha ao desativar inicialização automática: ${error}`)
    } finally { busy = false; await refresh() }
  }

  function projectRow(project: Project) {
    const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 5 })
    row.add_css_class("projects-entry")
    const head = new Gtk.Box({ spacing: 9, valign: Gtk.Align.CENTER })
    const index = new Gtk.Label({ label: String(project.id).padStart(2, "0") }); index.add_css_class("projects-index")
    const icon = new Gtk.Label({ label: project.icon }); icon.add_css_class("projects-glyph")
    const title = new Gtk.Label({ label: project.name, xalign: 0, hexpand: true }); title.add_css_class("projects-name")
    const status = new Gtk.Label({ label: stateLabel(project.state) }); status.add_css_class("projects-status"); const css=stateClass(project.state); if(css) status.add_css_class(css)
    head.append(index); head.append(icon); head.append(title); head.append(status)
    if (project.url) {
      const open = new Gtk.Button({ label: "Abrir" }); open.add_css_class("projects-action")
      open.connect("clicked", () => execAsync(["xdg-open", project.url!]).catch(printerr)); head.append(open)
    }
    if (project.autostartSupported) {
      const boot = new Gtk.Button({ label: project.autostartEnabled ? "Desativar boot" : "Ativar boot" })
      boot.add_css_class("projects-action")
      if (project.autostartEnabled) boot.add_css_class("primary")
      boot.connect("clicked", () => setAutostart(project, !project.autostartEnabled))
      head.append(boot)
    }
    if (project.groupUnit) {
      const start = new Gtk.Button({ label: "Ligar tudo" }); start.add_css_class("projects-action"); start.add_css_class("primary")
      start.connect("clicked", () => run(project, "start")); head.append(start)
      const stop = new Gtk.Button({ label: "Parar" }); stop.add_css_class("projects-action")
      stop.connect("clicked", () => run(project, "stop")); head.append(stop)
    }
    row.append(head)
    if (project.note) { const note=new Gtk.Label({label:project.note,xalign:0,wrap:true}); note.add_css_class("projects-note"); row.append(note) }
    for (const component of project.components ?? []) {
      const item = new Gtk.Box({ spacing: 7, valign: Gtk.Align.CENTER })
      item.add_css_class("projects-component")
      const label = new Gtk.Label({ label: `• ${component.name}${component.port ? `  :${component.port}` : ""}`, xalign:0, hexpand:true }); item.append(label)
      const componentStatus = new Gtk.Label({ label:stateLabel(component.state) }); componentStatus.add_css_class("projects-status"); const componentCss=stateClass(component.state); if(componentCss) componentStatus.add_css_class(componentCss); item.append(componentStatus)
      if (component.unit) {
        const start = new Gtk.Button({ label:"Ligar" }); start.add_css_class("projects-action"); start.connect("clicked",()=>run(project,"start",component)); item.append(start)
        const stop = new Gtk.Button({ label:"Parar" }); stop.add_css_class("projects-action"); stop.connect("clicked",()=>run(project,"stop",component)); item.append(stop)
        const logs = new Gtk.Button({ label:"Logs" }); logs.add_css_class("projects-action");
        logs.connect("clicked",()=>execAsync(["ghostty","-e","journalctl","--user","-u",component.unit!,"-f"]).catch(printerr)); item.append(logs)
      }
      row.append(item)
    }
    return row
  }

  function hide() { win.visible = false }

  return (
    <window
      $={(self) => {
        win = self
        const keys = new Gtk.EventControllerKey()
        keys.connect("key-pressed", (_controller, keyval) => { if (keyval === Gdk.KEY_Escape) { hide(); return true } return false })
        self.add_controller(keys)
        self.connect("notify::visible", () => { shown=self.visible; if(shown) refresh() })
      }}
      visible={false} name="projects" namespace="projects" class="Projects"
      gdkmonitor={gdkmonitor} exclusivity={Astal.Exclusivity.IGNORE} layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE} anchor={TOP|LEFT|RIGHT|BOTTOM} application={app}
    >
      <overlay hexpand vexpand>
        <box class="projects-backdrop" hexpand vexpand $={(self)=>{const click=new Gtk.GestureClick();click.connect("pressed",()=>hide());self.add_controller(click)}} />
        <box $type="overlay" class="projects-card" orientation={Gtk.Orientation.VERTICAL} spacing={10} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
          <box spacing={10} valign={Gtk.Align.CENTER}>
            <label class="projects-title" xalign={0} hexpand label="PROJETOS LOCAIS · ORDEM DO CATÁLOGO" />
            <button class="projects-action" onClicked={disableAllAutostart}><label label="Desativar boot" /></button>
            <button class="projects-action" onClicked={refresh}><label label="Atualizar" /></button>
            <button class="projects-action" onClicked={hide}><label label="Fechar  Esc" /></button>
          </box>
          <scrolledwindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
            $={(self)=>{ list=new Gtk.Box({orientation:Gtk.Orientation.VERTICAL,spacing:7}); self.set_child(list); self.set_min_content_height(Math.max(320, gdkmonitor.geometry.height-220)); self.set_max_content_height(Math.max(320, gdkmonitor.geometry.height-150)); self.set_propagate_natural_height(false) }}
          />
          <label class="projects-footnote" xalign={0} label="Estado e ações vêm do Projects Index · localhost:10000" />
        </box>
      </overlay>
    </window>
  )
}
