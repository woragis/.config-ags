import { createBinding, createComputed } from "ags"
import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import AstalMpris from "gi://AstalMpris"
import Pango from "gi://Pango"
import { formatTime } from "../lib/utils"

export default function Media() {
  const player = AstalMpris.Player.new("org.mpris.MediaPlayer2.strawberry")
  const available = createBinding(player, "available")
  const title = createBinding(player, "title")
  const artist = createBinding(player, "artist")
  const cover = createBinding(player, "coverArt")
  const position = createBinding(player, "position")
  const length = createBinding(player, "length")
  const status = createBinding(player, "playbackStatus")
  const canPrev = createBinding(player, "canGoPrevious")
  const canNext = createBinding(player, "canGoNext")
  const canControl = createBinding(player, "canControl")
  const canSeek = createBinding(player, "canSeek")

  const playing = createComputed(
    () => status() === AstalMpris.PlaybackStatus.PLAYING,
  )

  const chipClass = createComputed(() => {
    if (!available()) return "Media module idle"
    if (playing()) return "Media module playing"
    return "Media module paused"
  })

  const chipLabel = createComputed(() => {
    if (!available()) return ""
    const t = title() || "Unknown"
    const a = artist()
    const text = a ? `${a} — ${t}` : t
    return text.length > 32 ? `${text.slice(0, 31)}…` : text
  })

  const showText = createComputed(() => available())

  const tip = createComputed(() => {
    if (!available()) return "Strawberry — nothing playing"
    const t = title() || "Unknown"
    const a = artist()
    return a ? `${a} — ${t}` : t
  })

  const progress = createComputed(() => {
    const len = length()
    const pos = position()
    if (!len || len <= 0 || pos < 0) return 0
    return Math.min(1, pos / len)
  })

  const timeLabel = createComputed(() => {
    if (!available()) return ""
    return `${formatTime(position())} / ${formatTime(length())}`
  })

  return (
    <menubutton class={chipClass} tooltipText={tip}>
      <box spacing={6}>
        <label class="media-icon" label="󰓇" />
        <label
          class="media-text"
          label={chipLabel}
          visible={showText}
          maxWidthChars={32}
          ellipsize={Pango.EllipsizeMode.END}
        />
      </box>
      <popover>
        <box class="media-popover" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
          <box spacing={10} visible={available}>
            <box class="cover" overflow={Gtk.Overflow.HIDDEN}>
              <image
                pixelSize={64}
                file={cover}
                visible={cover((c) => !!c)}
              />
              <label
                label="󰓇"
                visible={cover((c) => !c)}
                css="font-size: 36px; color: #565f89;"
              />
            </box>
            <box
              orientation={Gtk.Orientation.VERTICAL}
              valign={Gtk.Align.CENTER}
              spacing={2}
              hexpand
            >
              <label
                class="track-title"
                xalign={0}
                label={title((t) => t || "No title")}
                maxWidthChars={26}
                ellipsize={Pango.EllipsizeMode.END}
              />
              <label
                class="track-artist"
                xalign={0}
                label={artist((a) => a || "—")}
                maxWidthChars={26}
                ellipsize={Pango.EllipsizeMode.END}
              />
              <label class="track-time" xalign={0} label={timeLabel} />
            </box>
          </box>

          <label
            class="media-empty"
            visible={available((a) => !a)}
            label="Nothing playing"
          />

          <slider
            visible={available}
            sensitive={canSeek}
            value={progress}
            onChangeValue={({ value }) => {
              const len = length()
              if (len > 0) player.set_position(value * len)
            }}
          />

          <box spacing={4} halign={Gtk.Align.CENTER}>
            <button
              sensitive={canPrev}
              onClicked={() => player.previous()}
              tooltipText="Previous"
            >
              <label label="󰒮" />
            </button>
            <button
              class="play"
              sensitive={canControl}
              onClicked={() => player.play_pause()}
              tooltipText="Play / Pause"
            >
              <label label={playing((p) => (p ? "󰏤" : "󰐊"))} />
            </button>
            <button
              sensitive={canNext}
              onClicked={() => player.next()}
              tooltipText="Next"
            >
              <label label="󰒭" />
            </button>
            <button
              onClicked={() => {
                if (player.available && player.canRaise) player.raise()
                else execAsync("strawberry").catch(printerr)
              }}
              tooltipText="Open Strawberry"
            >
              <label label="󰓇" />
            </button>
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
