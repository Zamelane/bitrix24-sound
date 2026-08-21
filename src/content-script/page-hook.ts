import {
  INCOMING_MESSAGE_SLOT_IDS,
  isIncomingMessageSlot,
  SITE_ENABLE_MESSAGE,
  SOUND_MAP_MESSAGE,
  slotIdForUrl,
  type SoundSlotId,
} from "src/shared/sounds"

type ReplacementMap = Record<string, string | null>

const INCOMING_DEBOUNCE_KEY = "b24-sound:incoming-at"
const INCOMING_DEBOUNCE_MS = 500

let replacementMap: ReplacementMap = {}
let mapReady = false
let siteEnabled = false
let patchesInstalled = false
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
  if (!siteEnabled) {
    return url
  }
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

function slotFromMedia(media: HTMLMediaElement): SoundSlotId | null {
  const direct = slotIdForUrl(media.currentSrc || media.src)
  if (direct) {
    return direct
  }

  for (const source of Array.from(media.querySelectorAll("source"))) {
    const slotId = slotIdForUrl(source.getAttribute("src") ?? "")
    if (slotId) {
      return slotId
    }
  }

  return null
}

function replacementForSlot(slotId: SoundSlotId): string | null {
  if (!siteEnabled || !mapReady) {
    return null
  }
  return replacementMap[slotId] ?? null
}

function shouldPlayIncomingSound(): boolean {
  const now = Date.now()
  try {
    const previous = Number(localStorage.getItem(INCOMING_DEBOUNCE_KEY) ?? 0)
    if (previous > 0 && now - previous < INCOMING_DEBOUNCE_MS) {
      return false
    }
    localStorage.setItem(INCOMING_DEBOUNCE_KEY, String(now))
  } catch {
    // Ignore storage errors and allow playback.
  }
  return true
}

function collapseBitrixAudio(media: HTMLMediaElement) {
  const slotId = slotFromMedia(media)
  const replacement = slotId ? replacementForSlot(slotId) : null
  if (!slotId || !replacement) {
    return
  }

  while (media.firstChild) {
    media.removeChild(media.firstChild)
  }
  media.src = replacement
}

function patchExistingBitrixAudio() {
  if (!siteEnabled) {
    return
  }

  for (const media of Array.from(document.querySelectorAll("audio"))) {
    collapseBitrixAudio(media)
  }

  for (const source of Array.from(document.querySelectorAll("audio source"))) {
    const current = source.getAttribute("src")
    if (!current) {
      continue
    }
    const next = resolveAudioUrl(current)
    if (next !== current) {
      source.setAttribute("src", next)
    }
  }
}

function installPatches() {
  if (patchesInstalled) {
    return
  }
  patchesInstalled = true

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
    if (name === "src" && siteEnabled && slotIdForUrl(value)) {
      value = resolveAudioUrl(value)
    }
    return nativeSetAttribute.call(this, name, value, ...rest)
  }

  const nativePlay = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (
    this: HTMLMediaElement,
    ...args: Parameters<typeof nativePlay>
  ) {
    if (siteEnabled) {
      collapseBitrixAudio(this)

      const slotId = slotFromMedia(this)
      const replacement = slotId ? replacementForSlot(slotId) : null
      if (slotId && replacement) {
        if (this.currentSrc !== replacement && this.src !== replacement) {
          this.src = replacement
        }

        if (
          isIncomingMessageSlot(slotId) &&
          INCOMING_MESSAGE_SLOT_IDS.some((id) => replacementForSlot(id)) &&
          !shouldPlayIncomingSound()
        ) {
          return Promise.resolve()
        }
      }
    }

    return nativePlay.apply(this, args)
  }

  const nativeFetch = window.fetch.bind(window)
  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = resolveRequestUrl(input)
    const slotId = siteEnabled ? slotIdForUrl(url) : null

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
    const slotId = siteEnabled ? slotIdForUrl(String(url)) : null
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
    if (!meta || !siteEnabled) {
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
}

function enableSite() {
  if (siteEnabled) {
    return
  }
  siteEnabled = true
  installPatches()
  window.postMessage({ type: `${SOUND_MAP_MESSAGE}:request` }, "*")
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) {
    return
  }
  const data = event.data as { type?: string; map?: ReplacementMap } | null
  if (data?.type === SITE_ENABLE_MESSAGE) {
    enableSite()
    return
  }
  if (data?.type !== SOUND_MAP_MESSAGE) {
    return
  }
  if (!siteEnabled) {
    return
  }
  replacementMap = data.map ?? {}
  if (!mapReady) {
    markMapReady()
    return
  }
  patchExistingBitrixAudio()
})
