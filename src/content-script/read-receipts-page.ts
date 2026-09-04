import {
  isMessageReadRequest,
  READ_RECEIPTS_SETTING_MESSAGE,
} from "src/shared/read-receipts"

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input
  }
  return input instanceof URL ? input.href : input.url
}

function requestParameters(
  body?: BodyInit | Document | null,
): URLSearchParams | FormData | null {
  if (typeof body === "string" || body instanceof URLSearchParams) {
    return new URLSearchParams(body)
  }
  return body instanceof FormData ? body : null
}

function createSuccessResponse(body?: BodyInit | Document | null): string {
  const parameters = requestParameters(body)
  const chatId = Number(parameters?.get("chatId")) || 0
  const viewedMessages: number[] = []

  if (parameters) {
    parameters.forEach((value, name) => {
      if (/^ids\[\d+\]$/.test(name)) {
        const id = Number(value)
        if (Number.isFinite(id)) {
          viewedMessages.push(id)
        }
      }
    })
  }

  return JSON.stringify({
    status: "success",
    data: {
      chatId,
      lastId: viewedMessages.at(-1) ?? 0,
      counter: 0,
      viewedMessages,
    },
    errors: [],
  })
}

export function installReadReceiptBlocker() {
  let enabled = false

  const nativeFetch = window.fetch.bind(window)
  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (enabled && isMessageReadRequest(requestUrl(input))) {
      return Promise.resolve(
        new Response(createSuccessResponse(init?.body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
    }
    return nativeFetch(input, init)
  }

  const blockedRequests = new WeakMap<XMLHttpRequest, boolean>()
  const nativeOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    blockedRequests.set(this, isMessageReadRequest(String(url)))
    return nativeOpen.call(this, method, url, async ?? true, username, password)
  }

  const nativeSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    if (!enabled || !blockedRequests.get(this)) {
      return nativeSend.call(this, body)
    }

    const responseType = this.responseType
    const responseUrl = URL.createObjectURL(
      new Blob([createSuccessResponse(body)], { type: "application/json" }),
    )
    nativeOpen.call(this, "GET", responseUrl, true)
    this.responseType = responseType
    this.addEventListener("loadend", () => URL.revokeObjectURL(responseUrl), {
      once: true,
    })
    return nativeSend.call(this)
  }

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) {
      return
    }
    const data = event.data as { type?: string; enabled?: boolean } | null
    if (data?.type === READ_RECEIPTS_SETTING_MESSAGE) {
      enabled = data.enabled === true
    }
  })

  window.postMessage({ type: `${READ_RECEIPTS_SETTING_MESSAGE}:request` }, "*")
}
