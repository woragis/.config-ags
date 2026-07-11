import AstalApps from "gi://AstalApps"
import AstalHyprland from "gi://AstalHyprland"

const apps = new AstalApps.Apps()

const CLASS_ICON: Record<string, string> = {
  kitty: "utilities-terminal",
  thunar: "system-file-manager",
  "org.gnome.Nautilus": "system-file-manager",
  librewolf: "librewolf",
  firefox: "firefox",
  strawberry: "strawberry",
  cursor: "cursor",
  "code-oss": "code",
  Code: "code",
}

export function clientClass(client: AstalHyprland.Client): string {
  return client.get_class() || client.get_initial_class() || ""
}

export function iconForClass(cls: string): string {
  if (!cls) return "application-x-executable"
  if (CLASS_ICON[cls]) return CLASS_ICON[cls]

  const lower = cls.toLowerCase()
  if (CLASS_ICON[lower]) return CLASS_ICON[lower]

  try {
    const exact = apps.exact_query(cls)
    if (exact[0]?.iconName) return exact[0].iconName
    const fuzzy = apps.fuzzy_query(cls)
    if (fuzzy[0]?.iconName) return fuzzy[0].iconName
  } catch {
    // ignore lookup errors
  }

  return lower || "application-x-executable"
}

export function iconForClient(client: AstalHyprland.Client): string {
  return iconForClass(clientClass(client))
}

export function shortTitle(title: string, max = 28): string {
  const t = title.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, "0")}`
}
