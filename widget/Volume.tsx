import { createBinding, createComputed } from "ags"
import { Gtk } from "ags/gtk4"
import AstalWp from "gi://AstalWp"
import { useDraggableSlider } from "../lib/sliderDrag"

export default function Volume() {
  const speaker = AstalWp.get_default()!.defaultSpeaker
  const volume = createBinding(speaker, "volume")
  const mute = createBinding(speaker, "mute")
  const icon = createBinding(speaker, "volumeIcon")
  const volSlider = useDraggableSlider(() => volume())

  const label = createComputed(() => {
    if (mute()) return "mute"
    const v = volSlider.dragging() ? volSlider.draft() : volume()
    return `${Math.round(v * 100)}%`
  })

  const className = createComputed(() =>
    mute() ? "Volume module muted" : "Volume module",
  )

  const tip = createComputed(() => {
    if (mute()) return "Muted — scroll to change"
    return `Volume ${Math.round(volume() * 100)}% — scroll to change`
  })

  function commitVolume(value: number) {
    speaker.set_volume(Math.min(1, Math.max(0, value)))
  }

  return (
    <menubutton class={className} tooltipText={tip}>
      <box
        spacing={4}
        $={(self) => {
          const scroll = new Gtk.EventControllerScroll({
            flags: Gtk.EventControllerScrollFlags.VERTICAL,
          })
          scroll.connect("scroll", (_c, _dx, dy) => {
            const delta = dy < 0 ? 0.03 : -0.03
            speaker.volume = Math.min(1, Math.max(0, speaker.volume + delta))
            return true
          })
          self.add_controller(scroll)
        }}
      >
        <image iconName={icon} pixelSize={14} />
        <label label={label} />
      </box>
      <popover>
        <box
          class="volume-popover"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={6}
          widthRequest={220}
        >
          <box spacing={8}>
            <button
              onClicked={() => (speaker.mute = !speaker.mute)}
              tooltipText="Toggle mute"
            >
              <image iconName={icon} />
            </button>
            <slider
              hexpand
              value={volSlider.value}
              onChangeValue={(e) => {
                volSlider.onChangeValue(e)
                // Live preview while dragging feels right for volume
                speaker.set_volume(Math.min(1, Math.max(0, e.value)))
              }}
              $={(self) => volSlider.setup(self, commitVolume)}
            />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
