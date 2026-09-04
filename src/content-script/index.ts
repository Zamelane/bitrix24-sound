import {
  isBitrixPortalHost,
  SITE_ENABLE_MESSAGE,
  SOUND_MAP_MESSAGE,
  STORAGE_KEYS,
} from "src/shared/sounds"
import {
  buildReplacementMap,
  isOriginAllowed,
  rememberPortalOrigin,
} from "src/shared/storage"
import {
  ONLINE_STATUS_SETTING_MESSAGE,
  ONLINE_STATUS_STORAGE_KEY,
} from "src/shared/online-status"
import {
  BLOCK_READ_RECEIPTS_STORAGE_KEY,
  READ_RECEIPTS_SETTING_MESSAGE,
} from "src/shared/read-receipts"
import "./index.css"

let siteActive = false

async function publishMap() {
  if (!siteActive) {
    return
  }
  const map = await buildReplacementMap()
  window.postMessage({ type: SOUND_MAP_MESSAGE, map }, "*")
}

async function publishOnlineStatusSetting() {
  if (!siteActive) {
    return
  }
  const result = await chrome.storage.local.get(ONLINE_STATUS_STORAGE_KEY)
  window.postMessage(
    {
      type: ONLINE_STATUS_SETTING_MESSAGE,
      enabled: result[ONLINE_STATUS_STORAGE_KEY] === true,
    },
    "*",
  )
}

async function publishReadReceiptSetting() {
  if (!siteActive) {
    return
  }
  const result = await chrome.storage.local.get(BLOCK_READ_RECEIPTS_STORAGE_KEY)
  window.postMessage(
    {
      type: READ_RECEIPTS_SETTING_MESSAGE,
      enabled: result[BLOCK_READ_RECEIPTS_STORAGE_KEY] === true,
    },
    "*",
  )
}

async function activateSite() {
  if (siteActive) {
    await Promise.all([
      publishMap(),
      publishOnlineStatusSetting(),
      publishReadReceiptSetting(),
    ])
    return
  }
  siteActive = true
  window.postMessage({ type: SITE_ENABLE_MESSAGE }, "*")
  await Promise.all([
    publishMap(),
    publishOnlineStatusSetting(),
    publishReadReceiptSetting(),
  ])
  if (window.top === window) {
    void rememberPortalOrigin(location.origin)
  }
}

async function boot() {
  if (await isOriginAllowed(location.origin, location.hostname)) {
    await activateSite()
  }
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) {
    return
  }
  const type = event.data?.type
  if (type === `${SOUND_MAP_MESSAGE}:request`) {
    void publishMap()
  }
  if (type === `${ONLINE_STATUS_SETTING_MESSAGE}:request`) {
    void publishOnlineStatusSetting()
  }
  if (type === `${READ_RECEIPTS_SETTING_MESSAGE}:request`) {
    void publishReadReceiptSetting()
  }
})

void boot()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === `${SITE_ENABLE_MESSAGE}:status`) {
    void isOriginAllowed(location.origin, location.hostname).then((allowed) => {
      sendResponse({
        allowed,
        auto: isBitrixPortalHost(location.hostname),
        origin: location.origin,
      })
    })
    return true
  }

  if (message?.type === `${SITE_ENABLE_MESSAGE}:activate`) {
    void activateSite().then(() => sendResponse({ ok: true }))
    return true
  }

  if (message?.type !== `${SOUND_MAP_MESSAGE}:preview`) {
    return
  }

  if (!siteActive) {
    sendResponse({ dataUrl: null })
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

  if (keys.includes(STORAGE_KEYS.enabledOrigins)) {
    void isOriginAllowed(location.origin, location.hostname).then((allowed) => {
      if (allowed) {
        void activateSite()
        return
      }
      if (siteActive) {
        location.reload()
      }
    })
  }

  if (!siteActive) {
    return
  }

  const affectsSounds =
    keys.includes(STORAGE_KEYS.settings) ||
    keys.some((key) => key.startsWith("customSound:"))
  if (affectsSounds) {
    void publishMap()
  }

  if (keys.includes(ONLINE_STATUS_STORAGE_KEY)) {
    void publishOnlineStatusSetting()
  }

  if (keys.includes(BLOCK_READ_RECEIPTS_STORAGE_KEY)) {
    void publishReadReceiptSetting()
  }
})
