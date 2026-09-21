import { marked } from 'marked'

marked.use({ gfm: true, breaks: true })

export function renderMarkdown(src: string | null | undefined): string {
  if (!src) return ''
  const html = marked.parse(src, { async: false }) as string
  // strip script tags defensively; content is the user's own but be safe
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
}
