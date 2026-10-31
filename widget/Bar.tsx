import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { onCleanup } from "ags"
import Workspaces from "./Workspaces"
import FocusedTitle from "./FocusedTitle"
import Media from "./Media"
import Volume from "./Volume"
import Memory from "./Memory"
import Battery from "./Battery"
import Clock from "./Clock"
import Tray from "./Tray"
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
    >
      <overlay class="bar-shell">
        <centerbox hexpand cssName="bar-center">
          <box $type="start" class="Left" spacing={10} valign={Gtk.Align.CENTER}>
            <Workspaces />
            <FocusedTitle />
          </box>
          <box $type="center" />
          <box $type="end" class="Right" spacing={4} valign={Gtk.Align.CENTER}>
            <Volume />
            <Memory />
            <Battery />
            <Clock />
            <Tray />
            <SysMenu />
          </box>
        </centerbox>
        <Media $type="overlay" />
      </overlay>
    </window>
  )
}
