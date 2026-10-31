import app from "ags/gtk4/app"
import style from "./style.css"
import Bar from "./widget/Bar"
import Projects from "./widget/Projects"
import Gtk from "gi://Gtk?version=4.0"
import Adw from "gi://Adw?version=1"

const ICON_THEME = "Papirus-Dark"

app.start({
  css: style,
  // Widget chrome (Adwaita dark via StyleManager). Icons are Papirus.
  gtkTheme: "Adwaita",
  iconTheme: ICON_THEME,
  cursorTheme: "Adwaita",
  main() {
    try {
      Adw.StyleManager.get_default().set_color_scheme(Adw.ColorScheme.PREFER_DARK)
    } catch {
      // ignore
    }

    const settings = Gtk.Settings.get_default()
    if (settings) {
      settings.gtkIconThemeName = ICON_THEME
      settings.gtkCursorThemeName = "Adwaita"
      settings.gtkFontName = "JetBrainsMono Nerd Font 12"
    }

    const monitors = app.get_monitors()
    for (const monitor of monitors) {
      Bar({ gdkmonitor: monitor })
    }
    if (monitors[0]) Projects({ gdkmonitor: monitors[0] })
  },
})
