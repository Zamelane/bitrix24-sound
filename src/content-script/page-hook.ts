import { SOUND_MAP_MESSAGE, slotIdForUrl } from "src/shared/sounds"

type ReplacementMap = Record<string, string | null>

let replacementMap: ReplacementMap = {}

function replacementFor(url: string | null | undefined): string | null {
  if (!url) {
    return null
  }
  const slotId = slotIdForUrl(url)
  if (!slotId) {
    return null
  }
  return replacementMap[slotId] ?? null
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) {
    return
  }
  const data = event.data as { type?: string; map?: ReplacementMap } | null
  if (data?.type !== SOUND_MAP_MESSAGE) {
    return
  }
  replacementMap = data.map ?? {}
})

window.postMessage({ type: `${SOUND_MAP_MESSAGE}:request` }, "*")

const mediaSrc = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  "src",
)

if (mediaSrc?.get && mediaSrc.set) {
  Object.defineProperty(HTMLMediaElement.prototype, "src", {
    configurable: true,
    enumerable: mediaSrc.enumerable,
    get() {
      return mediaSrc.get!.call(this)
    },
    set(value: string) {
      mediaSrc.set!.call(this, replacementFor(String(value)) ?? value)
    },
  })
}

const OriginalAudio = window.Audio
function PatchedAudio(src?: string) {
  const audio = new OriginalAudio()
  if (src) {
    audio.src = src
  }
  return audio
}
PatchedAudio.prototype = OriginalAudio.prototype
Object.defineProperty(PatchedAudio, "name", { value: "Audio" })
window.Audio = PatchedAudio as unknown as typeof Audio

const nativePlay = HTMLMediaElement.prototype.play
HTMLMediaElement.prototype.play = function (
  this: HTMLMediaElement,
  ...args: Parameters<typeof nativePlay>
) {
  const current = this.currentSrc || this.src
  const next = replacementFor(current)
  if (next && this.src !== next) {
    this.src = next
  }
  return nativePlay.apply(this, args)
}

const nativeSetAttribute = Element.prototype.setAttribute
Element.prototype.setAttribute = function (name, value) {
  const tag = this.tagName
  if (
    name.toLowerCase() === "src" &&
    (this instanceof HTMLMediaElement || tag === "EMBED" || tag === "SOURCE")
  ) {
    const next = replacementFor(String(value))
    return nativeSetAttribute.call(this, name, next ?? value)
  }
  return nativeSetAttribute.call(this, name, value)
}

const nativeFetch = window.fetch.bind(window)
window.fetch = function (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  const next = replacementFor(url)
  if (!next) {
    return nativeFetch(input, init)
  }
  if (typeof input === "string" || input instanceof URL) {
    return nativeFetch(next, init)
  }
  return nativeFetch(new Request(next, input), init)
}

const nativeXhrOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null,
) {
  const next = replacementFor(String(url)) ?? url
  return nativeXhrOpen.call(
    this,
    method,
    next,
    async ?? true,
    username,
    password,
  )
}
