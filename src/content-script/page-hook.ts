import {
  INCOMING_MESSAGE_SLOT_IDS,
  isIncomingMessageSlot,
  SITE_ENABLE_MESSAGE,
  SOUND_MAP_MESSAGE,
  slotIdForUrl,
  type SoundSlotId,
} from "src/shared/sounds"
import { ONLINE_STATUS_SETTING_MESSAGE } from "src/shared/online-status"

type ReplacementMap = Record<string, string | null>

const INCOMING_DEBOUNCE_KEY = "b24-sound:incoming-at"
const INCOMING_DEBOUNCE_MS = 500
const RECENT_ITEM_SELECTOR = '[data-testid^="im-recent-item-"][data-id]'
const ONLINE_AVATAR_CLASS = "b24-sound-online-avatar"
const ONLINE_INDICATOR_CLASS = "b24-sound-online-indicator"

let replacementMap: ReplacementMap = {}
let mapReady = false
let siteEnabled = false
let patchesInstalled = false
const pendingMapWaiters: Array<() => void> = []
const onlineUserIds = new Set<string>()
const processedStatusPayloads = new WeakSet<object>()
let showOnlineStatus = false
let recentListObserver: MutationObserver | null = null
let onlineStatusRenderFrame: number | null = null

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

function isOnlineStatusApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url, location.href)
    const action = parsed.searchParams.get("action")
    return (
      action === "ui.entityselector.load" ||
      action === "im.v2.Chat.Message.list" ||
      /\/rest\/(?:\d+\/[^/]+\/)?batch\.json$/i.test(parsed.pathname) ||
      /\/rest\/(?:\d+\/[^/]+\/)?im\.user\.get\.json$/i.test(
        parsed.pathname,
      )
    )
  } catch {
    return false
  }
}

function isUserStatusRecord(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { id: string | number; status: string } {
  return (
    (typeof value.id === "string" || typeof value.id === "number") &&
    typeof value.status === "string" &&
    (value.type === "user" ||
      typeof value.name === "string" ||
      typeof value.firstName === "string" ||
      typeof value.first_name === "string")
  )
}

function collectUserStatuses(value: unknown): number {
  if (Array.isArray(value)) {
    let found = 0
    for (const item of value) {
      found += collectUserStatuses(item)
    }
    return found
  }
  if (!value || typeof value !== "object") {
    return 0
  }

  const record = value as Record<string, unknown>
  let found = 0
  if (isUserStatusRecord(record)) {
    found += 1
    const id = String(record.id)
    if (record.status.toLowerCase() === "online") {
      onlineUserIds.add(id)
    } else {
      onlineUserIds.delete(id)
    }
  }

  for (const child of Object.values(record)) {
    found += collectUserStatuses(child)
  }
  return found
}

function updateRecentOnlineIndicators(root: ParentNode = document) {
  if (!showOnlineStatus) {
    return
  }

  for (const item of Array.from(root.querySelectorAll(RECENT_ITEM_SELECTOR))) {
    const id = item.getAttribute("data-id")
    const avatar = item.querySelector(
      ".bx-im-list-recent-item__avatar_content",
    )
    if (!id || !(avatar instanceof HTMLElement)) {
      continue
    }

    const indicator = avatar.querySelector(`.${ONLINE_INDICATOR_CLASS}`)
    if (!onlineUserIds.has(id)) {
      indicator?.remove()
      avatar.classList.remove(ONLINE_AVATAR_CLASS)
      continue
    }

    avatar.classList.add(ONLINE_AVATAR_CLASS)
    if (!indicator) {
      const dot = document.createElement("span")
      dot.className = ONLINE_INDICATOR_CLASS
      dot.title = "Онлайн"
      dot.setAttribute("aria-label", "Онлайн")
      avatar.append(dot)
    }
  }
}

function scheduleOnlineStatusRender() {
  if (!showOnlineStatus || onlineStatusRenderFrame !== null) {
    return
  }
  onlineStatusRenderFrame = requestAnimationFrame(() => {
    onlineStatusRenderFrame = null
    updateRecentOnlineIndicators()
  })
}

function removeOnlineIndicators() {
  for (const indicator of Array.from(
    document.querySelectorAll(`.${ONLINE_INDICATOR_CLASS}`),
  )) {
    indicator.remove()
  }
  for (const avatar of Array.from(
    document.querySelectorAll(`.${ONLINE_AVATAR_CLASS}`),
  )) {
    avatar.classList.remove(ONLINE_AVATAR_CLASS)
  }
}

function setOnlineStatusEnabled(enabled: boolean) {
  showOnlineStatus = enabled
  recentListObserver?.disconnect()
  recentListObserver = null
  if (onlineStatusRenderFrame !== null) {
    cancelAnimationFrame(onlineStatusRenderFrame)
    onlineStatusRenderFrame = null
  }

  if (!enabled) {
    removeOnlineIndicators()
    return
  }

  updateRecentOnlineIndicators()
  console.info("[Bitrix24 Sound] Online status enabled", {
    knownOnlineUsers: onlineUserIds.size,
    recentItems: document.querySelectorAll(RECENT_ITEM_SELECTOR).length,
    indicators: document.querySelectorAll(`.${ONLINE_INDICATOR_CLASS}`).length,
  })
  recentListObserver = new MutationObserver(() => {
    scheduleOnlineStatusRender()
  })
  recentListObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

function processOnlineStatusPayload(payload: unknown, source = "response") {
  if (payload && typeof payload === "object") {
    if (processedStatusPayloads.has(payload)) {
      return
    }
    processedStatusPayloads.add(payload)
  }
  const found = collectUserStatuses(payload)
  if (found > 0) {
    console.info("[Bitrix24 Sound] User statuses received", {
      source,
      records: found,
      onlineUsers: onlineUserIds.size,
    })
  }
  scheduleOnlineStatusRender()
}

function inspectFetchResponse(url: string, response: Response) {
  if (!isOnlineStatusApiUrl(url)) {
    return
  }
  void response
    .clone()
    .json()
    .then((payload) => processOnlineStatusPayload(payload, `fetch: ${url}`))
    .catch(() => undefined)
}

function inspectXhrResponse(xhr: XMLHttpRequest) {
  try {
    if (xhr.responseType === "json") {
      processOnlineStatusPayload(xhr.response, "XMLHttpRequest")
      return
    }
    if (xhr.responseType === "" || xhr.responseType === "text") {
      const text = xhr.responseText
      if (
        text.includes('"status"') &&
        (text.includes('"lastActivityDate"') ||
          text.includes('"last_activity_date"'))
      ) {
        processOnlineStatusPayload(JSON.parse(text), "XMLHttpRequest")
      }
    }
  } catch {
    // Ignore non-JSON and inaccessible responses.
  }
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
  const nativeResponseJson = Response.prototype.json
  Response.prototype.json = function <T>(): Promise<T> {
    return nativeResponseJson.call(this).then((payload: T) => {
      processOnlineStatusPayload(payload, "Response.json")
      return payload
    })
  }

  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = resolveRequestUrl(input)
    const slotId = siteEnabled ? slotIdForUrl(url) : null

    if (!slotId) {
      const request = nativeFetch(input, init)
      if (isOnlineStatusApiUrl(url)) {
        void request
          .then((response) => inspectFetchResponse(url, response))
          .catch(() => undefined)
      }
      return request
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
    slotId?: string
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
    xhrMeta.delete(this)
    const slotId = siteEnabled ? slotIdForUrl(String(url)) : null
    if (slotId) {
      xhrMeta.set(this, {
        slotId: slotId ?? undefined,
        method,
        url: String(url),
        async: async ?? true,
        username,
        password,
      })
    }
    this.addEventListener("load", () => inspectXhrResponse(this), {
      once: true,
    })
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
    if (!meta?.slotId || !siteEnabled) {
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
  if (data?.type === ONLINE_STATUS_SETTING_MESSAGE) {
    setOnlineStatusEnabled(
      (event.data as { enabled?: boolean }).enabled === true,
    )
    return
  }
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

installPatches()
