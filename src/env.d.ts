/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// tinyjs.app frontend bridge (present only inside the tinyjs webview)
interface TinyBridge {
  api: {
    call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
    on(event: string, handler: (data: unknown) => void): () => void
  }
  app?: {
    paths(): Promise<Record<string, string>>
  }
  system?: {
    os(): string
    capabilities(): Promise<Record<string, unknown>>
  }
}

// Puter.js (present only when the Puter SDK script has been loaded)
interface PuterFs {
  write(path: string, data: string | Blob | File | ArrayBuffer | Uint8Array, opts?: Record<string, unknown>): Promise<unknown>
  read(path: string): Promise<Blob>
  mkdir(path: string, opts?: Record<string, unknown>): Promise<unknown>
  stat(path: string): Promise<{ size: number; modified: number; name: string }>
  delete(path: string, opts?: Record<string, unknown>): Promise<unknown>
}
interface PuterSdk {
  fs: PuterFs
  auth: {
    signIn(): Promise<unknown>
    signOut(): Promise<unknown>
    isSignedIn(): boolean
    getUser(): Promise<{ username: string }>
  }
  env?: string
}

interface Window {
  tiny?: TinyBridge
  puter?: PuterSdk
  google?: any
}
