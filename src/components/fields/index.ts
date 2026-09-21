import type { Component } from 'vue'
import BooleanField from './BooleanField.vue'
import ColorField from './ColorField.vue'
import CountryField from './CountryField.vue'
import DateField from './DateField.vue'
import FileField from './FileField.vue'
import ImageField from './ImageField.vue'
import LanguageField from './LanguageField.vue'
import LinkField from './LinkField.vue'
import MapField from './MapField.vue'
import NumberField from './NumberField.vue'
import SubField from './SubField.vue'
import TextField from './TextField.vue'

const registry: Record<string, Component> = {
  text: TextField,
  number: NumberField,
  link: LinkField,
  date: DateField,
  boolean: BooleanField,
  sub: SubField,
  color: ColorField,
  image: ImageField,
  file: FileField,
  language: LanguageField,
  country: CountryField,
  map: MapField,
}

/** The read-only cell renderer for a field type (used in tables). */
export function fieldComponent(type: string): Component | null {
  return registry[type] || null
}
