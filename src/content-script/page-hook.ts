import { SOUND_MAP_MESSAGE, slotIdForUrl } from "src/shared/sounds"

type ReplacementMap = Record<string, string | null>

let replacementMap: ReplacementMap = {}
let mapReady = false
const pendingMapWaiters: Array<() => void> = []

const OriginalAudio = window.Audio

function markMapReady() {
  if (mapReady) {
    return
  }
  mapReady = true
  for (const resolve of pendingMapWaiters) {
    resolve()
  }
  pendingMapWaiters.length = 0
  patchExistingBitrixAudio()
}

function whenMapReady(): Promise<void> {
  if (mapReady) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    pendingMapWaiters.push(resolve)
  })
}

function resolveAudioUrl(url: string): string {
  const slotId = slotIdForUrl(url)
  if (!slotId || !mapReady) {
    return url
  }
  return replacementMap[slotId] ?? url
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input
  }
  if (input instanceof URL) {
    return input.href
  }
  return input.url
}

function patchExistingBitrixAudio() {
  for (const node of Array.from(
    document.querySelectorAll("audio source, video source, audio[src]"),
  )) {
    if (
      !(node instanceof HTMLMediaElement || node instanceof HTMLSourceElement)
    ) {
      continue
    }
    const current = node.getAttribute("src")
    if (!current) {
      continue
    }
    const next = resolveAudioUrl(current)
    if (next !== current) {
      node.setAttribute("src", next)
    }
  }
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
  if (!mapReady) {
    markMapReady()
    return
  }
  patchExistingBitrixAudio()
})

window.postMessage({ type: `${SOUND_MAP_MESSAGE}:request` }, "*")

function PatchedAudio(src?: string) {
  const audio = new OriginalAudio()
  if (src) {
    audio.src = resolveAudioUrl(src)
  }
  return audio
}
PatchedAudio.prototype = OriginalAudio.prototype
Object.defineProperty(PatchedAudio, "name", { value: "Audio" })
window.Audio = PatchedAudio as unknown as typeof Audio

const srcDescriptor = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  "src",
)
if (srcDescriptor?.set && srcDescriptor.get) {
  Object.defineProperty(HTMLMediaElement.prototype, "src", {
    configurable: true,
    enumerable: srcDescriptor.enumerable,
    get: srcDescriptor.get,
    set(value: string) {
      srcDescriptor.set!.call(this, resolveAudioUrl(value))
    },
  })
}

const nativeSetAttribute = Element.prototype.setAttribute
Element.prototype.setAttribute = function (
  name: string,
  value: string,
  ...rest: []
) {
  if (name === "src" && slotIdForUrl(value)) {
    value = resolveAudioUrl(value)
  }
  return nativeSetAttribute.call(this, name, value, ...rest)
}

const nativeFetch = window.fetch.bind(window)
window.fetch = function (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = resolveRequestUrl(input)
  const slotId = slotIdForUrl(url)

  if (!slotId) {
    return nativeFetch(input, init)
  }

  return whenMapReady().then(() => {
    const next = replacementMap[slotId]
    if (!next) {
      return nativeFetch(input, init)
    }

    if (typeof input === "string" || input instanceof URL) {
      return nativeFetch(next, init)
    }

    return nativeFetch(new Request(next, input), init)
  })
}

interface XhrMeta {
  slotId: string
  method: string
  url: string
  async: boolean
  username?: string | null
  password?: string | null
}

const xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>()

const nativeXhrOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null,
) {
  const slotId = slotIdForUrl(String(url))
  if (slotId) {
    xhrMeta.set(this, {
      slotId,
      method,
      url: String(url),
      async: async ?? true,
      username,
      password,
    })
  }
  return nativeXhrOpen.call(
    this,
    method,
    url,
    async ?? true,
    username,
    password,
  )
}

const nativeXhrSend = XMLHttpRequest.prototype.send
XMLHttpRequest.prototype.send = function (
  body?: Document | XMLHttpRequestBodyInit | null,
) {
  const meta = xhrMeta.get(this)
  if (!meta) {
    return nativeXhrSend.call(this, body)
  }

  const run = () => {
    const next = replacementMap[meta.slotId as keyof ReplacementMap]
    if (next) {
      nativeXhrOpen.call(
        this,
        meta.method,
        next,
        meta.async,
        meta.username,
        meta.password,
      )
    }
    return nativeXhrSend.call(this, body)
  }

  if (!mapReady) {
    void whenMapReady().then(run)
    return
  }

  return run()
}
