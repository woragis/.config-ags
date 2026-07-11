import { createBinding, createComputed, createState } from "ags"
import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import AstalBluetooth from "gi://AstalBluetooth"
import AstalNetwork from "gi://AstalNetwork"
import AstalWp from "gi://AstalWp"

function readCpuMem() {
  try {
    const [, memBytes] = GLib.file_get_contents("/proc/meminfo")
    const memText = new TextDecoder().decode(memBytes)
    const total = Number(memText.match(/MemTotal:\s+(\d+)/)?.[1] ?? 0)
    const avail = Number(memText.match(/MemAvailable:\s+(\d+)/)?.[1] ?? 0)
    const memPct = total > 0 ? Math.round(((total - avail) / total) * 100) : 0

    const [, statBytes] = GLib.file_get_contents("/proc/stat")
    const statText = new TextDecoder().decode(statBytes)
    const cpu = statText.split("\n")[0].split(/\s+/).slice(1).map(Number)
    return { memPct, cpu }
  } catch {
    return { memPct: 0, cpu: [] as number[] }
  }
}

let prevCpu: number[] = []

function cpuUsage(): number {
  const { cpu } = readCpuMem()
  if (cpu.length < 4) return 0
  if (prevCpu.length < 4) {
    prevCpu = cpu
    return 0
  }
  const idle = cpu[3] - prevCpu[3]
  const total = cpu.reduce((a, b) => a + b, 0) - prevCpu.reduce((a, b) => a + b, 0)
  prevCpu = cpu
  if (total <= 0) return 0
  return Math.round((1 - idle / total) * 100)
}

export default function SysMenu() {
  const network = AstalNetwork.get_default()
  const bluetooth = AstalBluetooth.get_default()
  const speaker = AstalWp.get_default()!.defaultSpeaker

  const wifi = createBinding(network, "wifi")
  const wired = createBinding(network, "wired")
  const btPowered = createBinding(bluetooth, "isPowered")
  const btConnected = createBinding(bluetooth, "isConnected")
  const volume = createBinding(speaker, "volume")
  const mute = createBinding(speaker, "mute")

  const [idleOn, setIdleOn] = createState(false)
  const [idlePid, setIdlePid] = createState(0)

  const stats = createPoll({ cpu: 0, mem: 0 }, 2000, () => ({
    cpu: cpuUsage(),
    mem: readCpuMem().memPct,
  }))

  const netLabel = createComputed(() => {
    const w = wifi()
    if (w && w.ssid) return `󰤨  ${w.ssid}`
    if (wired()) return "󰈀  Ethernet"
    return "󰤭  Offline"
  })

  const btLabel = createComputed(() => {
    if (!btPowered()) return "󰂲  Bluetooth off"
    if (btConnected()) return "󰂱  Connected"
    return "󰂯  Bluetooth on"
  })

  const brightness = createPoll(0, 2000, () => {
    try {
      const [, curB] = GLib.file_get_contents(
        "/sys/class/backlight/intel_backlight/brightness",
      )
      const [, maxB] = GLib.file_get_contents(
        "/sys/class/backlight/intel_backlight/max_brightness",
      )
      const cur = Number(new TextDecoder().decode(curB).trim())
      const max = Number(new TextDecoder().decode(maxB).trim())
      return max > 0 ? cur / max : 0
    } catch {
      return 0
    }
  })

  async function setBrightness(value: number) {
    const pct = Math.round(Math.min(1, Math.max(0.01, value)) * 100)
    try {
      await execAsync(`brightnessctl set ${pct}%`)
    } catch {
      // brightnessctl may be missing; ignore
    }
  }

  async function toggleIdle() {
    if (idleOn()) {
      const pid = idlePid()
      if (pid > 0) {
        try {
          await execAsync(`kill ${pid}`)
        } catch {
          // ignore
        }
      }
      setIdleOn(false)
      setIdlePid(0)
      return
    }
    try {
      const out = await execAsync([
        "bash",
        "-c",
        "systemd-inhibit --what=idle --who=ags --why='Manual inhibit' --mode=block sleep infinity & echo $!",
      ])
      const pid = Number(out.trim().split("\n").pop())
      setIdlePid(pid || 0)
      setIdleOn(true)
    } catch (e) {
      printerr(e)
    }
  }

  return (
    <menubutton class="SysMenu" tooltipText="Control center">
      <label label="󰍜" />
      <popover>
        <box
          class="sys-popover"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={4}
          widthRequest={268}
        >
          <label class="section" xalign={0} label="CONNECTIVITY" />

          <button
            class="sys-row"
            onClicked={() => execAsync("kitty -e nmtui").catch(printerr)}
            tooltipText="Network settings"
          >
            <label xalign={0} label={netLabel} />
          </button>

          <button
            class="sys-row"
            onClicked={() => {
              bluetooth.isPowered = !bluetooth.isPowered
            }}
          >
            <label xalign={0} label={btLabel} />
          </button>

          <label class="section" xalign={0} label="LEVELS" />

          <box class="sys-slider-row" spacing={6}>
            <label label="󰕾" />
            <slider
              hexpand
              value={volume}
              onChangeValue={({ value }) => speaker.set_volume(value)}
            />
            <button onClicked={() => (speaker.mute = !mute())}>
              <label label={mute((m) => (m ? "󰝟" : "󰕾"))} />
            </button>
          </box>

          <box class="sys-slider-row" spacing={6}>
            <label label="󰃠" />
            <slider
              hexpand
              value={brightness}
              onChangeValue={({ value }) => setBrightness(value)}
            />
          </box>

          <label class="section" xalign={0} label="QUICK" />

          <button class="sys-row" onClicked={toggleIdle}>
            <label
              xalign={0}
              label={idleOn((v) =>
                v ? "󰒳  Idle inhibit on" : "󰒲  Idle inhibit off",
              )}
            />
          </button>

          <button
            class="sys-row"
            onClicked={() =>
              execAsync(
                `${GLib.getenv("HOME")}/.config/waybar/scripts/switch-layout.sh`,
              ).catch(printerr)
            }
          >
            <label xalign={0} label="󰌌  Keyboard layout" />
          </button>

          <label class="section" xalign={0} label="RESOURCES" />
          <label
            class="sys-stats"
            xalign={0}
            label={stats((s) => `󰻠  CPU ${s.cpu}%   ·   󰍛  RAM ${s.mem}%`)}
          />

          <label class="section" xalign={0} label="SESSION" />
          <box class="sys-power" spacing={4} homogeneous>
            <button
              tooltipText="Lock / DPMS"
              onClicked={() =>
                execAsync(["hyprctl", "dispatch", "dpms", "off"]).catch(printerr)
              }
            >
              <label label="󰌾" />
            </button>
            <button
              tooltipText="Power menu"
              onClicked={() =>
                execAsync(
                  `${GLib.getenv("HOME")}/.config/waybar/scripts/power.sh`,
                ).catch(printerr)
              }
            >
              <label label="󰐥" />
            </button>
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
