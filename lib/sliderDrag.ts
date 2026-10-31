import { createComputed, createState } from "ags"
import { Gtk } from "ags/gtk4"
import type Astal from "gi://Astal?version=4.0"

type Slider = Astal.Slider

/**
 * Keep a slider draggable when its value is also driven by an external binding
 * (MPRIS position, PipeWire volume, etc.). While the pointer is down, freeze
 * external updates and use a local draft value instead.
 */
export function useDraggableSlider(external: () => number) {
  const [dragging, setDragging] = createState(false)
  const [draft, setDraft] = createState(0)

  const value = createComputed(() => (dragging() ? draft() : external()))

  function onChangeValue({ value: next }: { value: number }) {
    setDraft(next)
  }

  function setup(self: Slider, onCommit: (value: number) => void) {
    let held = false

    const begin = () => {
      held = true
      setDraft(self.get_value())
      setDragging(true)
    }

    const finish = () => {
      if (!held) return
      held = false
      const v = self.get_value()
      setDraft(v)
      setDragging(false)
      onCommit(v)
    }

    const cancel = () => {
      if (!held) return
      held = false
      setDragging(false)
    }

    const click = new Gtk.GestureClick()
    click.set_button(1)
    click.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
    click.connect("pressed", begin)
    click.connect("released", finish)
    click.connect("cancel", cancel)
    click.connect("unpaired-release", finish)
    click.connect("end", finish)
    self.add_controller(click)
  }

  return { value, dragging, draft, onChangeValue, setup }
}
