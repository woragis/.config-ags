import { createBinding, createComputed } from "ags"
import AstalBattery from "gi://AstalBattery"

export default function Battery() {
  const battery = AstalBattery.get_default()
  const present = createBinding(battery, "isPresent")
  const percent = createBinding(battery, "percentage")
  const icon = createBinding(battery, "iconName")
  const charging = createBinding(battery, "charging")
  const timeToEmpty = createBinding(battery, "timeToEmpty")
  const timeToFull = createBinding(battery, "timeToFull")

  const label = createComputed(() => `${Math.floor(percent() * 100)}%`)
  const className = createComputed(() => {
    const p = percent() * 100
    if (charging()) return "Battery module charging"
    if (p <= 15) return "Battery module critical"
    if (p <= 30) return "Battery module warning"
    return "Battery module"
  })

  const tip = createComputed(() => {
    const p = Math.floor(percent() * 100)
    if (charging()) {
      const t = timeToFull()
      if (t > 0) {
        const m = Math.round(t / 60)
        return `Charging ${p}% · ${m}m to full`
      }
      return `Charging ${p}%`
    }
    const t = timeToEmpty()
    if (t > 0) {
      const m = Math.round(t / 60)
      return `Battery ${p}% · ${m}m remaining`
    }
    return `Battery ${p}%`
  })

  return (
    <box class={className} spacing={3} visible={present} tooltipText={tip}>
      <image iconName={icon} pixelSize={14} />
      <label label={label} />
    </box>
  )
}
