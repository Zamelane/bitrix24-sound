import {
  isBitrixPortalHost,
  SOUND_MAP_MESSAGE,
  type SoundSlotId,
} from "src/shared/sounds"
import {
  buildReplacementMap,
  rememberPortalOrigin,
  type ReplacementMap,
} from "src/shared/storage"

async function toDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function toPageMap(): Promise<ReplacementMap> {
  const map = await buildReplacementMap()
  const pageMap = {} as ReplacementMap

  for (const [slotId, value] of Object.entries(map) as [
    SoundSlotId,
    string | null,
  ][]) {
    if (!value) {
      pageMap[slotId] = null
      continue
    }
    if (value.startsWith("data:")) {
      pageMap[slotId] = value
      continue
    }
    pageMap[slotId] = await toDataUrl(value)
  }

  return pageMap
}

async function publishMap() {
  const map = await toPageMap()
  window.postMessage({ type: SOUND_MAP_MESSAGE, map }, "*")
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) {
    return
  }
  if (event.data?.type === `${SOUND_MAP_MESSAGE}:request`) {
    void publishMap()
  }
})

void publishMap()

if (window.top === window && isBitrixPortalHost(location.hostname)) {
  void rememberPortalOrigin(location.origin)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== `${SOUND_MAP_MESSAGE}:preview`) {
    return
  }

  const path = String(message.path ?? "")
  const url = new URL(path, location.origin).href
  fetch(url, { credentials: "include" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(String(response.status))
      }
      return response.blob()
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        }),
    )
    .then((dataUrl) => sendResponse({ dataUrl }))
    .catch(() => sendResponse({ dataUrl: null }))

  return true
})

chrome.storage.onChanged.addListener(() => {
  void publishMap()
})
