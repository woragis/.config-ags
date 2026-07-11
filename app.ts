import app from "ags/gtk4/app"
import style from "./style.css"
import Bar from "./widget/Bar"
import Gtk from "gi://Gtk?version=4.0"
import Adw from "gi://Adw?version=1"

app.start({
  css: style,
  gtkTheme: "Adwaita",
  main() {
    try {
      Adw.init()
      Adw.StyleManager.get_default().set_color_scheme(Adw.ColorScheme.PREFER_DARK)
    } catch {
      // Adwaita StyleManager unavailable — fall back below
    }

    const settings = Gtk.Settings.get_default()
    if (settings) {
      settings.gtkIconThemeName = "Papirus-Dark"
      settings.gtkCursorThemeName = "Adwaita"
      settings.gtkFontName = "JetBrainsMono Nerd Font 11"
    }

    for (const monitor of app.get_monitors()) {
      Bar({ gdkmonitor: monitor })
    }
  },
})
