import { loadPuter } from '@/core/platform'
import type { SyncProvider, SyncProviderType } from '../types'

/** Stores the database in the user's Puter cloud drive under ~/CocktailCMS. */
export class PuterProvider implements SyncProvider {
  readonly type: SyncProviderType = 'puter'
  readonly name = 'Puter'
  private folder = 'CocktailCMS'

  private async sdk() {
    return loadPuter()
  }

  async isSignedIn() {
    try {
      const p = await this.sdk()
      return !!p.auth.isSignedIn()
    } catch {
      return false
    }
  }

  async signIn() {
    const p = await this.sdk()
    if (!p.auth.isSignedIn()) await p.auth.signIn()
    await p.fs.mkdir(this.folder, { createMissingParents: true }).catch(() => {})
  }

  async signOut() {
    const p = await this.sdk()
    await p.auth.signOut()
  }

  private path(name: string) {
    return `${this.folder}/${name}`
  }

  async readBytes(name: string) {
    const p = await this.sdk()
    try {
      const blob = await p.fs.read(this.path(name))
      return new Uint8Array(await blob.arrayBuffer())
    } catch {
      return null
    }
  }

  async writeBytes(name: string, bytes: Uint8Array, mime: string) {
    const p = await this.sdk()
    await p.fs.mkdir(this.folder, { createMissingParents: true }).catch(() => {})
    await p.fs.write(this.path(name), new Blob([bytes as BlobPart], { type: mime }), { overwrite: true })
  }

  async readText(name: string) {
    const b = await this.readBytes(name)
    return b ? new TextDecoder().decode(b) : null
  }

  async writeText(name: string, text: string, mime: string) {
    await this.writeBytes(name, new TextEncoder().encode(text), mime)
  }
}
