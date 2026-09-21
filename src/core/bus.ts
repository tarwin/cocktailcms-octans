// A tiny typed event emitter, replacing the Vue 2 `new Vue()` event bus.
type Handler = (...args: any[]) => void

export class EventBus {
  private handlers = new Map<string, Set<Handler>>()

  on(event: string, handler: Handler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler)
  }

  emit(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach((h) => {
      try {
        h(...args)
      } catch (e) {
        console.error(`bus handler for "${event}" failed`, e)
      }
    })
  }
}

export const bus = new EventBus()
