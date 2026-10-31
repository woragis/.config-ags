import { createComputed } from "ags"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"

function readMem() {
  try {
    const [, bytes] = GLib.file_get_contents("/proc/meminfo")
    const text = new TextDecoder().decode(bytes)
    const kb = (key: string) =>
      Number(text.match(new RegExp(`${key}:\\s+(\\d+)`))?.[1] ?? 0)
    const total = kb("MemTotal")
    const avail = kb("MemAvailable")
    const used = Math.max(0, total - avail)
    const pct = total > 0 ? Math.round((used / total) * 100) : 0
    return { total, avail, used, pct }
  } catch {
    return { total: 0, avail: 0, used: 0, pct: 0 }
  }
}

function giB(kb: number) {
  return `${(kb / 1024 / 1024).toFixed(1)}G`
}

export default function Memory() {
  const mem = createPoll(readMem(), 1000, readMem)

  const label = createComputed(() => `${mem().pct}%`)
  const className = createComputed(() => {
    const p = mem().pct
    if (p >= 90) return "Memory module critical"
    if (p >= 80) return "Memory module warning"
    return "Memory module"
  })
  const tip = createComputed(() => {
    const m = mem()
    return `RAM ${giB(m.used)} / ${giB(m.total)}  ·  ${giB(m.avail)} free`
  })

  return (
    <box class={className} spacing={3} tooltipText={tip}>
      <label label="󰍛" />
      <label label={label} />
    </box>
  )
}
