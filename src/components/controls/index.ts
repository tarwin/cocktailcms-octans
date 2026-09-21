import type { Component } from 'vue'
import BooleanControl from './BooleanControl.vue'
import ColorControl from './ColorControl.vue'
import CountryControl from './CountryControl.vue'
import DateControl from './DateControl.vue'
import FileControl from './FileControl.vue'
import ImageControl from './ImageControl.vue'
import LanguageControl from './LanguageControl.vue'
import LinkControl from './LinkControl.vue'
import MapControl from './MapControl.vue'
import NumberControl from './NumberControl.vue'
import SubControl from './SubControl.vue'
import TextControl from './TextControl.vue'

const registry: Record<string, Component> = {
  text: TextControl,
  number: NumberControl,
  link: LinkControl,
  date: DateControl,
  boolean: BooleanControl,
  sub: SubControl,
  color: ColorControl,
  image: ImageControl,
  file: FileControl,
  language: LanguageControl,
  country: CountryControl,
  map: MapControl,
}

/** The editable input for a field type (used in the record sheet). */
export function controlComponent(type: string): Component | null {
  return registry[type] || null
}

/** What every control exposes to the record editor. */
export interface ControlHandle {
  field?: { id: number }
  validate?: () => boolean
  focus?: () => void
  addError?: (msg: string) => void
  linkedDataUpdated?: (linkId: number) => void
  afterSavedFromChild?: (rowId: number, recordId: number) => void
}
