import { createBinding, createComputed, For } from "ags"
import { Gtk } from "ags/gtk4"
import { exec, execAsync } from "ags/process"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import AstalMpris from "gi://AstalMpris"
import Pango from "gi://Pango"
import { formatTime } from "../lib/utils"
import { useDraggableSlider } from "../lib/sliderDrag"

const MUSIC_ICON = "󰝚" // nf-md-music (note), not Spotify
const SEEK_STEP = 10
const SUBS_BIN = `${GLib.get_home_dir()}/.local/bin/subs`

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

  function openStrawberry() {
    if (player.available && player.canRaise) player.raise()
    else execAsync("strawberry").catch(printerr)
  }

  const subsInfo = createPoll(
    {
      running: false,
      paused: false,
      playlist: "",
      title: "",
      position: 0,
      duration: 0,
      volume: 80 as number | null,
      shuffle: true,
      loop: "folder",
      playlists: [] as string[],
    },
    1000,
    () => {
      try {
        return JSON.parse(exec([SUBS_BIN, "info"]))
      } catch {
        return {
          running: false,
          paused: false,
          playlist: "",
          title: "",
          position: 0,
          duration: 0,
          volume: null,
          shuffle: true,
          loop: "folder",
          playlists: [],
        }
      }
    },
  )

  const playlists = createComputed(() => {
    const fromInfo = subsInfo().playlists
    if (fromInfo && fromInfo.length > 0) return fromInfo as string[]
    try {
      return exec([SUBS_BIN, "list"])
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    } catch {
      return [] as string[]
    }
  })

  const subsRunning = createComputed(() => !!subsInfo().running)
  const subsCurrent = createComputed(() => String(subsInfo().playlist || ""))
  const subsTitle = createComputed(() => String(subsInfo().title || ""))
  const subsPaused = createComputed(() => !!subsInfo().paused)
  const subsShuffle = createComputed(() => !!subsInfo().shuffle)
  const subsLoop = createComputed(() => String(subsInfo().loop || "folder"))
  const subsProgress = createComputed(() => {
    const d = Number(subsInfo().duration || 0)
    const p = Number(subsInfo().position || 0)
    if (!d || d <= 0) return 0
    return Math.min(1, p / d)
  })
  const subsElapsed = createComputed(() => formatTime(Number(subsInfo().position || 0)))
  const subsTotal = createComputed(() => formatTime(Number(subsInfo().duration || 0)))
  const subsVolPct = createComputed(() => {
    const v = subsInfo().volume
    if (v == null || Number.isNaN(Number(v))) return "—"
    return `${Math.round(Number(v))}%`
  })

  const subsSeekSlider = useDraggableSlider(() => subsProgress())
  const subsVolSlider = useDraggableSlider(() => {
    const v = subsInfo().volume
    if (v == null) return 0.8
    return Math.min(1, Math.max(0, Number(v) / 100))
  })

  const loopSubsClass = createComputed(() =>
    subsLoop() === "chain" ? "media-btn active" : "media-btn",
  )
  const shuffleSubsClass = createComputed(() =>
    subsShuffle() ? "media-btn active" : "media-btn",
  )
  const loopSubsIcon = createComputed(() =>
    subsLoop() === "chain" ? "󰕇" : "󰑖",
  )
  const loopSubsTip = createComputed(() =>
    subsLoop() === "chain"
      ? "Loop: chain all playlists"
      : "Loop: this playlist",
  )

  const playing = createComputed(
    () => status() === AstalMpris.PlaybackStatus.PLAYING,
  )

  const chipClass = createComputed(() => {
    if (subsRunning()) return "Media module playing"
    if (!available()) return "Media module idle"
    if (playing()) return "Media module playing"
    return "Media module paused"
  })

  const chipLabel = createComputed(() => {
    if (subsRunning()) {
      const cur = subsCurrent() || "subs"
      const t = subsTitle()
      if (t) {
        const short = t.length > 22 ? `${t.slice(0, 21)}…` : t
        return `◈ ${short}`
      }
      return `◈ ${cur}`
    }
    if (!available()) return ""
    const t = title() || "Unknown"
    const a = artist()
    const text = a ? `${a} — ${t}` : t
    return text.length > 32 ? `${text.slice(0, 31)}…` : text
  })

  const showText = createComputed(() => available() || subsRunning())

  const tip = createComputed(() => {
    if (subsRunning()) {
      const pl = subsCurrent() || "subs"
      const t = subsTitle()
      return t ? `Subliminals — ${pl}: ${t}` : `Subliminals — ${pl}`
    }
    if (!available()) return "Click for player controls"
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

  function playSubs(name: string) {
    if (subsRunning() && subsCurrent() === name) return
    execAsync([SUBS_BIN, "play", name]).catch(printerr)
  }

  function stopSubs() {
    execAsync([SUBS_BIN, "stop"]).catch(printerr)
  }

  function toggleSubs() {
    execAsync([SUBS_BIN, "toggle"]).catch(printerr)
  }

  function subsNext() {
    execAsync([SUBS_BIN, "next"]).catch(printerr)
  }

  function subsPrev() {
    execAsync([SUBS_BIN, "prev"]).catch(printerr)
  }

  function subsNextPlaylist() {
    execAsync([SUBS_BIN, "next-playlist"]).catch(printerr)
  }

  function subsPrevPlaylist() {
    execAsync([SUBS_BIN, "prev-playlist"]).catch(printerr)
  }

  function subsSeekBy(delta: number) {
    execAsync([SUBS_BIN, "seek", String(delta)]).catch(printerr)
  }

  function subsToggleShuffle() {
    execAsync([SUBS_BIN, "shuffle", "toggle"]).catch(printerr)
  }

  function subsToggleLoop() {
    execAsync([SUBS_BIN, "loop", "toggle"]).catch(printerr)
  }

  function commitSubsSeek(value: number) {
    const d = Number(subsInfo().duration || 0)
    if (!d || d <= 0) return
    const target = Math.max(0, Math.min(d, value * d))
    const cur = Number(subsInfo().position || 0)
    execAsync([SUBS_BIN, "seek", String(target - cur)]).catch(printerr)
  }

  function commitSubsVolume(value: number) {
    const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
    // Persist even when idle; applies live if mpv is running
    execAsync([SUBS_BIN, "volume", String(pct)]).catch(printerr)
  }

  return (
    <menubutton
      class={chipClass}
      tooltipText={tip}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.CENTER}
    >
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
              spacing={4}
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
              <button
                class="sys-row"
                onClicked={openStrawberry}
                tooltipText="Open Strawberry"
              >
                <label xalign={0} label="Open" />
              </button>
            </box>
          </box>

          <box
            spacing={8}
            visible={available((a) => !a)}
            valign={Gtk.Align.CENTER}
          >
            <label class="media-empty" hexpand xalign={0} label="Nothing playing" />
            <button class="sys-row" onClicked={openStrawberry}>
              <label label="Open Strawberry" />
            </button>
          </box>

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
              <label label="󰓗" />
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
              onClicked={openStrawberry}
              tooltipText="Open Strawberry"
            >
              <label label={MUSIC_ICON} />
            </button>
          </box>

          {/* Strawberry intensity — player-only, not system volume */}
          <box
            class="media-intensity"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={4}
            visible={showVolume}
          >
            <label class="section" xalign={0} label="STRAWBERRY INTENSITY" />
            <box
              class="media-volume"
              spacing={8}
              tooltipText="Strawberry intensity only — system volume is the bar module on the right"
            >
              <label label="󰎈" />
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

          {/* Subliminals — always in the popover, no secret gesture */}
          <box
            class="subs-panel"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
          >
            <label class="section" xalign={0} label="SUBLIMINALS" />

            <label
              class="track-title"
              xalign={0}
              visible={subsRunning}
              label={subsTitle((t) => t || "—")}
              maxWidthChars={36}
              ellipsize={Pango.EllipsizeMode.END}
            />
            <label
              class="track-artist"
              xalign={0}
              visible={subsRunning}
              label={subsCurrent((c) => (c ? `playlist · ${c}` : ""))}
            />

            {/* Seek */}
            <box
              orientation={Gtk.Orientation.VERTICAL}
              spacing={4}
              visible={subsRunning}
            >
              <slider
                class="media-seek"
                hexpand
                value={subsSeekSlider.value}
                onChangeValue={subsSeekSlider.onChangeValue}
                $={(self) => subsSeekSlider.setup(self, commitSubsSeek)}
              />
              <box hexpand>
                <label class="track-time" xalign={0} hexpand label={subsElapsed} />
                <label class="track-time" xalign={1} label={subsTotal} />
              </box>
            </box>

            {/* Transport — same idea as Strawberry */}
            <box spacing={4} halign={Gtk.Align.CENTER} visible={subsRunning}>
              <button
                class="media-btn"
                onClicked={() => subsSeekBy(-SEEK_STEP)}
                tooltipText={`Back ${SEEK_STEP}s`}
              >
                <label label="󰓕" />
              </button>
              <button class="media-btn" onClicked={subsPrev} tooltipText="Previous track">
                <label label="󰒮" />
              </button>
              <button
                class="media-btn play"
                onClicked={toggleSubs}
                tooltipText="Play / Pause"
              >
                <label label={subsPaused((p) => (p ? "󰐊" : "󰏤"))} />
              </button>
              <button class="media-btn" onClicked={subsNext} tooltipText="Next track">
                <label label="󰒭" />
              </button>
              <button
                class="media-btn"
                onClicked={() => subsSeekBy(SEEK_STEP)}
                tooltipText={`Forward ${SEEK_STEP}s`}
              >
                <label label="󰓗" />
              </button>
            </box>

            {/* Modes + playlist skip */}
            <box spacing={4} halign={Gtk.Align.CENTER}>
              <button
                class="media-btn"
                onClicked={subsPrevPlaylist}
                tooltipText="Previous playlist"
              >
                <label label="󰘀" />
              </button>
              <button
                class={shuffleSubsClass}
                onClicked={subsToggleShuffle}
                tooltipText="Shuffle (applies on next playlist start)"
              >
                <label label="󰒝" />
              </button>
              <button
                class={loopSubsClass}
                onClicked={subsToggleLoop}
                tooltipText={loopSubsTip}
              >
                <label label={loopSubsIcon} />
              </button>
              <button
                class="media-btn"
                sensitive={subsRunning}
                onClicked={stopSubs}
                tooltipText="Stop"
              >
                <label label="󰓛" />
              </button>
              <button
                class="media-btn"
                onClicked={subsNextPlaylist}
                tooltipText="Next playlist"
              >
                <label label="󰘁" />
              </button>
            </box>

            {/* Subliminal intensity — mpv player-only */}
            <box
              class="media-intensity"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={4}
            >
              <label class="section" xalign={0} label="SUBS INTENSITY" />
              <box
                class="media-volume"
                spacing={8}
                tooltipText="Subliminal intensity only — system volume is the bar module on the right"
              >
                <label label="󰎈" />
                <slider
                  class="media-vol"
                  hexpand
                  value={subsVolSlider.value}
                  onChangeValue={subsVolSlider.onChangeValue}
                  $={(self) => subsVolSlider.setup(self, commitSubsVolume)}
                />
                <label class="track-time" label={subsVolPct} widthChars={4} />
              </box>
            </box>

            <label class="section" xalign={0} label="PLAYLISTS" />
            <box
              class="subs-playlists"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={4}
            >
              <For each={playlists}>
                {(name: string) => (
                  <button
                    class="sys-row subs-playlist"
                    onClicked={() => playSubs(name)}
                  >
                    <label
                      xalign={0}
                      hexpand
                      label={subsCurrent((c) => (c === name ? `▶ ${name}` : name))}
                    />
                  </button>
                )}
              </For>
              <label
                class="media-empty"
                visible={playlists((p) => p.length === 0)}
                label="No playlists in ~/.subs"
              />
            </box>
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
