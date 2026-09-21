import type { Component } from 'vue'
import BooleanOptions from './BooleanOptions.vue'
import ColorOptions from './ColorOptions.vue'
import CountryOptions from './CountryOptions.vue'
import DateOptions from './DateOptions.vue'
import FileOptions from './FileOptions.vue'
import ImageOptions from './ImageOptions.vue'
import LanguageOptions from './LanguageOptions.vue'
import LinkOptions from './LinkOptions.vue'
import MapOptions from './MapOptions.vue'
import NumberOptions from './NumberOptions.vue'
import SubOptions from './SubOptions.vue'
import TextOptions from './TextOptions.vue'

const registry: Record<string, Component> = {
  text: TextOptions,
  number: NumberOptions,
  link: LinkOptions,
  date: DateOptions,
  boolean: BooleanOptions,
  sub: SubOptions,
  color: ColorOptions,
  image: ImageOptions,
  file: FileOptions,
  language: LanguageOptions,
  country: CountryOptions,
  map: MapOptions,
}

/** The per-type settings editor shown in the field editor sheet. */
export function optionsComponent(type: string): Component | null {
  return registry[type] || null
}
