import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { onCleanup } from "ags"
import Workspaces from "./Workspaces"
import FocusedTitle from "./FocusedTitle"
import Media from "./Media"
import Volume from "./Volume"
import Battery from "./Battery"
import Clock from "./Clock"
import SysMenu from "./SysMenu"

export default function Bar({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  let win: Astal.Window
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  onCleanup(() => win.destroy())

  return (
    <window
      $={(self) => (win = self)}
      visible
      name={`bar-${gdkmonitor.get_connector()}`}
      class="Bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
      css="min-height: 56px;"
    >
      <centerbox cssName="bar-center">
        <box $type="start" class="Left" spacing={7} valign={Gtk.Align.CENTER}>
          <Workspaces />
          <FocusedTitle />
        </box>

        <box $type="center" class="Center" valign={Gtk.Align.CENTER}>
          <Media />
        </box>

        <box $type="end" class="Right" spacing={2} valign={Gtk.Align.CENTER}>
          <Volume />
          <Battery />
          <Clock />
          <SysMenu />
        </box>
      </centerbox>
    </window>
  )
}
