import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"

export default function Clock() {
  const time = createPoll("", 1000, () => {
    return GLib.DateTime.new_now_local().format("%H:%M")!
  })

  const date = createPoll("", 30_000, () => {
    return GLib.DateTime.new_now_local().format("%A, %d %B %Y")!
  })

  const tip = createPoll("", 30_000, () => {
    return GLib.DateTime.new_now_local().format("%A, %d %B %Y")!
  })

  return (
    <menubutton class="Clock module" tooltipText={tip}>
      <label label={time} />
      <popover>
        <box class="clock-popover" orientation={Gtk.Orientation.VERTICAL} spacing={6}>
          <label class="clock-date" label={date} />
          <Gtk.Calendar />
        </box>
      </popover>
    </menubutton>
  )
}
