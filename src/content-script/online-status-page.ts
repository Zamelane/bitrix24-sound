import {
  ONLINE_STATUS_SETTING_MESSAGE,
  updateOnlineUserIds,
} from "src/shared/online-status"

const RECENT_ITEM_SELECTOR = '[data-testid^="im-recent-item-"][data-id]'
const AVATAR_SELECTOR = ".bx-im-list-recent-item__avatar_content"
const AVATAR_CLASS = "b24-sound-online-avatar"
const INDICATOR_CLASS = "b24-sound-online-indicator"

function isStatusApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url, location.href)
    const action = parsed.searchParams.get("action")
    return (
      action === "ui.entityselector.load" ||
      action === "im.v2.Chat.Message.list" ||
      /\/rest\/(?:\d+\/[^/]+\/)?(?:batch|im\.user\.get)\.json$/i.test(
        parsed.pathname,
      )
    )
  } catch {
    return false
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input
  }
  return input instanceof URL ? input.href : input.url
}

export function installOnlineStatusFeature() {
  const onlineUserIds = new Set<string>()
  const processedPayloads = new WeakSet<object>()
  let enabled = false
  let observer: MutationObserver | null = null
  let renderFrame: number | null = null

  function render() {
    if (!enabled) {
      return
    }

    for (const item of Array.from(
      document.querySelectorAll(RECENT_ITEM_SELECTOR),
    )) {
      const id = item.getAttribute("data-id")
      const avatar = item.querySelector(AVATAR_SELECTOR)
      if (!id || !(avatar instanceof HTMLElement)) {
        continue
      }

      const indicator = avatar.querySelector(`.${INDICATOR_CLASS}`)
      if (!onlineUserIds.has(id)) {
        indicator?.remove()
        avatar.classList.remove(AVATAR_CLASS)
        continue
      }

      avatar.classList.add(AVATAR_CLASS)
      if (!indicator) {
        const dot = document.createElement("span")
        dot.className = INDICATOR_CLASS
        dot.setAttribute("aria-hidden", "true")
        avatar.append(dot)
      }
    }
  }

  function scheduleRender() {
    if (!enabled || renderFrame !== null) {
      return
    }
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null
      render()
    })
  }

  function removeIndicators() {
    for (const indicator of Array.from(
      document.querySelectorAll(`.${INDICATOR_CLASS}`),
    )) {
      indicator.remove()
    }
    for (const avatar of Array.from(
      document.querySelectorAll(`.${AVATAR_CLASS}`),
    )) {
      avatar.classList.remove(AVATAR_CLASS)
    }
  }

  function setEnabled(value: boolean) {
    enabled = value
    observer?.disconnect()
    observer = null
    if (renderFrame !== null) {
      cancelAnimationFrame(renderFrame)
      renderFrame = null
    }

    if (!enabled) {
      removeIndicators()
      return
    }

    render()
    observer = new MutationObserver(scheduleRender)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  }

  function processPayload(payload: unknown) {
    if (payload && typeof payload === "object") {
      if (processedPayloads.has(payload)) {
        return
      }
      processedPayloads.add(payload)
    }
    updateOnlineUserIds(payload, onlineUserIds)
    scheduleRender()
  }

  const nativeFetch = window.fetch.bind(window)
  const nativeResponseJson = Response.prototype.json
  Response.prototype.json = function <T>(): Promise<T> {
    return nativeResponseJson.call(this).then((payload: T) => {
      processPayload(payload)
      return payload
    })
  }

  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = requestUrl(input)
    const request = nativeFetch(input, init)
    if (isStatusApiUrl(url)) {
      void request
        .then((response) => response.clone().json())
        .then(processPayload)
        .catch(() => undefined)
    }
    return request
  }

  const observedRequests = new WeakMap<XMLHttpRequest, boolean>()
  const observedXhrs = new WeakSet<XMLHttpRequest>()
  const nativeOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    observedRequests.set(this, isStatusApiUrl(String(url)))
    if (!observedXhrs.has(this)) {
      observedXhrs.add(this)
      this.addEventListener("load", () => {
        try {
          if (this.responseType === "json") {
            processPayload(this.response)
            return
          }
          if (this.responseType !== "" && this.responseType !== "text") {
            return
          }
          const text = this.responseText
          if (
            observedRequests.get(this) ||
            (text.includes('"status"') &&
              (text.includes('"lastActivityDate"') ||
                text.includes('"last_activity_date"')))
          ) {
            processPayload(JSON.parse(text))
          }
        } catch {
          // The response is not readable JSON.
        }
      })
    }
    return nativeOpen.call(
      this,
      method,
      url,
      async ?? true,
      username,
      password,
    )
  }

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) {
      return
    }
    const data = event.data as { type?: string; enabled?: boolean } | null
    if (data?.type === ONLINE_STATUS_SETTING_MESSAGE) {
      setEnabled(data.enabled === true)
    }
  })
}
