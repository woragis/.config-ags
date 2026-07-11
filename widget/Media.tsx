import { createBinding, createComputed } from "ags"
import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import AstalMpris from "gi://AstalMpris"
import Pango from "gi://Pango"
import { formatTime } from "../lib/utils"
import { useDraggableSlider } from "../lib/sliderDrag"

const MUSIC_ICON = "󰝚" // nf-md-music (note), not Spotify
const SEEK_STEP = 10

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
  const volume = createBinding(player, "volume")
  const loopStatus = createBinding(player, "loopStatus")
  const shuffleStatus = createBinding(player, "shuffleStatus")

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

  const seekSlider = useDraggableSlider(() => progress())
  const volSlider = useDraggableSlider(() => {
    const v = volume()
    return v < 0 ? 0 : v
  })

  const elapsed = createComputed(() => {
    if (seekSlider.dragging()) {
      return formatTime(seekSlider.draft() * (length() || 0))
    }
    return formatTime(position())
  })
  const total = createComputed(() => formatTime(length()))

  const shuffleSupported = createComputed(
    () => shuffleStatus() !== AstalMpris.Shuffle.UNSUPPORTED,
  )

  const loopIcon = createComputed(() => {
    switch (loopStatus()) {
      case AstalMpris.Loop.TRACK:
        return "󰑘"
      case AstalMpris.Loop.PLAYLIST:
        return "󰕇"
      default:
        return "󰑖"
    }
  })

  const loopClass = createComputed(() => {
    const s = loopStatus()
    if (s === AstalMpris.Loop.TRACK || s === AstalMpris.Loop.PLAYLIST) {
      return "media-btn active"
    }
    return "media-btn"
  })

  const loopSupported = createComputed(
    () => loopStatus() !== AstalMpris.Loop.UNSUPPORTED,
  )

  const volumePct = createComputed(() => {
    if (volSlider.dragging()) return `${Math.round(volSlider.draft() * 100)}%`
    const v = volume()
    if (v < 0) return "—"
    return `${Math.round(v * 100)}%`
  })

  const volumeSupported = createComputed(() => volume() >= 0)
  const showVolume = createComputed(() => available() && volumeSupported())

  const shuffleClass = createComputed(() =>
    shuffleStatus() === AstalMpris.Shuffle.ON ? "media-btn active" : "media-btn",
  )

  function seekBy(delta: number) {
    if (!player.canSeek) return
    const len = player.length
    if (!len || len <= 0) return
    const next = Math.min(len, Math.max(0, player.position + delta))
    player.set_position(next)
  }

  function commitSeek(value: number) {
    const len = length()
    if (len > 0 && player.canSeek) player.set_position(value * len)
  }

  function commitVolume(value: number) {
    player.set_volume(Math.min(1, Math.max(0, value)))
  }

  return (
    <menubutton class={chipClass} tooltipText={tip}>
      <box spacing={6}>
        <label class="media-icon" label={MUSIC_ICON} />
        <label
          class="media-text"
          label={chipLabel}
          visible={showText}
          maxWidthChars={32}
          ellipsize={Pango.EllipsizeMode.END}
        />
      </box>
      <popover>
        <box class="media-popover" orientation={Gtk.Orientation.VERTICAL} spacing={10}>
          <box spacing={10} visible={available}>
            <box class="cover" overflow={Gtk.Overflow.HIDDEN}>
              <image
                pixelSize={72}
                file={cover}
                visible={cover((c) => !!c)}
              />
              <label
                label={MUSIC_ICON}
                visible={cover((c) => !c)}
                css="font-size: 48px; color: #565f89;"
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
                maxWidthChars={28}
                ellipsize={Pango.EllipsizeMode.END}
              />
              <label
                class="track-artist"
                xalign={0}
                label={artist((a) => a || "—")}
                maxWidthChars={28}
                ellipsize={Pango.EllipsizeMode.END}
              />
            </box>
          </box>

          <label
            class="media-empty"
            visible={available((a) => !a)}
            label="Nothing playing"
          />

          {/* Progress */}
          <box
            class="media-progress"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={4}
            visible={available}
          >
            <slider
              class="media-seek"
              hexpand
              sensitive={canSeek}
              value={seekSlider.value}
              onChangeValue={seekSlider.onChangeValue}
              $={(self) => seekSlider.setup(self, commitSeek)}
            />
            <box hexpand>
              <label class="track-time" xalign={0} hexpand label={elapsed} />
              <label class="track-time" xalign={1} label={total} />
            </box>
          </box>

          {/* Transport */}
          <box
            class="media-transport"
            spacing={4}
            halign={Gtk.Align.CENTER}
            visible={available}
          >
            <button
              class="media-btn"
              sensitive={canSeek}
              onClicked={() => seekBy(-SEEK_STEP)}
              tooltipText={`Back ${SEEK_STEP}s`}
            >
              <label label="󰓕" />
            </button>
            <button
              class="media-btn"
              sensitive={canPrev}
              onClicked={() => player.previous()}
              tooltipText="Previous"
            >
              <label label="󰒮" />
            </button>
            <button
              class="media-btn play"
              sensitive={canControl}
              onClicked={() => player.play_pause()}
              tooltipText="Play / Pause"
            >
              <label label={playing((p) => (p ? "󰏤" : "󰐊"))} />
            </button>
            <button
              class="media-btn"
              sensitive={canNext}
              onClicked={() => player.next()}
              tooltipText="Next"
            >
              <label label="󰒭" />
            </button>
            <button
              class="media-btn"
              sensitive={canSeek}
              onClicked={() => seekBy(SEEK_STEP)}
              tooltipText={`Forward ${SEEK_STEP}s`}
            >
              <label label="󰓖" />
            </button>
          </box>

          {/* Mode + open */}
          <box
            class="media-modes"
            spacing={4}
            halign={Gtk.Align.CENTER}
            visible={available}
          >
            <button
              class={shuffleClass}
              sensitive={shuffleSupported}
              onClicked={() => player.shuffle()}
              tooltipText="Shuffle"
            >
              <label label="󰒝" />
            </button>
            <button
              class={loopClass}
              sensitive={loopSupported}
              onClicked={() => player.loop()}
              tooltipText="Repeat"
            >
              <label label={loopIcon} />
            </button>
            <button
              class="media-btn"
              sensitive={canControl}
              onClicked={() => player.stop()}
              tooltipText="Stop"
            >
              <label label="󰓛" />
            </button>
            <button
              class="media-btn"
              onClicked={() => {
                if (player.available && player.canRaise) player.raise()
                else execAsync("strawberry").catch(printerr)
              }}
              tooltipText="Open Strawberry"
            >
              <label label={MUSIC_ICON} />
            </button>
          </box>

          {/* Player volume */}
          <box
            class="media-volume"
            spacing={8}
            visible={showVolume}
          >
            <label label="󰕾" />
            <slider
              class="media-vol"
              hexpand
              value={volSlider.value}
              onChangeValue={volSlider.onChangeValue}
              $={(self) => volSlider.setup(self, commitVolume)}
            />
            <label class="track-time" label={volumePct} widthChars={4} />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
