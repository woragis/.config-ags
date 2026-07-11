import AstalApps from "gi://AstalApps"
import AstalHyprland from "gi://AstalHyprland"
import Gtk from "gi://Gtk?version=4.0"
import Gdk from "gi://Gdk?version=4.0"

const apps = new AstalApps.Apps()

/** Prefer real Papirus app icons over Adwaita generic names. */
const CLASS_ICON: Record<string, string> = {
  kitty: "kitty",
  thunar: "thunar",
  "thunar-manager": "thunar",
  strawberry: "strawberry",
  "org.strawberrymusicplayer.strawberry": "strawberry",
  librewolf: "librewolf",
  firefox: "firefox",
  "firefox-esr": "firefox",
  cursor: "cursor",
  "code-oss": "code-oss",
  code: "code",
  Code: "code",
  "dev.zed.Zed": "zed",
  zed: "zed",
  discord: "discord",
  spotify: "spotify",
  chromium: "chromium",
  "google-chrome": "google-chrome",
  foot: "foot",
  alacritty: "Alacritty",
  wezterm: "org.wezfurlong.wezterm",
  "org.wezfurlong.wezterm": "org.wezfurlong.wezterm",
  rofi: "rofi",
  walker: "applications-system",
  mpv: "mpv",
  imv: "imv",
  btop: "utilities-system-monitor",
}

function iconTheme(): Gtk.IconTheme | null {
  try {
    const display = Gdk.Display.get_default()
    if (!display) return null
    return Gtk.IconTheme.get_for_display(display)
  } catch {
    return null
  }
}

function hasIcon(name: string): boolean {
  if (!name) return false
  const theme = iconTheme()
  if (!theme) return true // optimistic if theme not ready yet
  try {
    return theme.has_icon(name)
  } catch {
    return false
  }
}

function firstExisting(...names: Array<string | null | undefined>): string | null {
  for (const name of names) {
    if (name && hasIcon(name)) return name
  }
  return null
}

export function clientClass(client: AstalHyprland.Client): string {
  return client.get_class() || client.get_initial_class() || ""
}

export function iconForClass(cls: string): string {
  if (!cls) return "application-x-executable"

  const lower = cls.toLowerCase()
  const mapped = CLASS_ICON[cls] || CLASS_ICON[lower]

  let desktopIcon: string | undefined
  try {
    const exact = apps.exact_query(cls)
    desktopIcon = exact[0]?.iconName
    if (!desktopIcon) {
      const fuzzy = apps.fuzzy_query(cls)
      desktopIcon = fuzzy[0]?.iconName
    }
  } catch {
    // ignore lookup errors
  }

  return (
    firstExisting(
      mapped,
      cls,
      lower,
      desktopIcon,
      // last-resort generics (often Adwaita) — only if nothing else exists
      "application-x-executable",
    ) || "application-x-executable"
  )
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
