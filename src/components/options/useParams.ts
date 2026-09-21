import { reactive, watch } from 'vue'

/**
 * Shared plumbing for the options editors: a reactive copy of the params with
 * defaults filled in, written back to `update:modelValue` on every change.
 */
export function useParams<T extends Record<string, any>>(
  props: { modelValue: Record<string, any> | undefined },
  emit: (e: 'update:modelValue', v: Record<string, any>) => void,
  defaults: T,
): T {
  const state = reactive({ ...defaults }) as T
  const load = () => {
    const v = props.modelValue || {}
    for (const k of Object.keys(defaults)) {
      ;(state as any)[k] = v[k] !== undefined && v[k] !== null ? v[k] : (defaults as any)[k]
    }
  }
  load()
  watch(
    state,
    () => emit('update:modelValue', { ...(props.modelValue || {}), ...JSON.parse(JSON.stringify(state)) }),
    { deep: true },
  )
  return state
}
