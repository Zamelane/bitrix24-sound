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

async function publishMap() {
  const map = await buildReplacementMap()
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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return
  }
  const keys = Object.keys(changes)
  const affectsSounds =
    keys.includes("soundSettings") ||
    keys.some((key) => key.startsWith("customSound:"))
  if (affectsSounds) {
    void publishMap()
  }
})
