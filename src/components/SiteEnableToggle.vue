<script setup lang="ts">
import { isBitrixPortalHost, SITE_ENABLE_MESSAGE } from "src/shared/sounds"
import { isHttpPageUrl, setOriginEnabled } from "src/shared/storage"

const { t } = useI18n()

const tabId = ref<number | null>(null)
const origin = ref<string | null>(null)
const hostname = ref<string | null>(null)
const enabled = ref(false)
const isAuto = ref(false)
const supported = ref(false)
const busy = ref(false)

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  tabId.value = tab?.id ?? null
  supported.value = isHttpPageUrl(tab?.url)
  origin.value = null
  hostname.value = null
  enabled.value = false
  isAuto.value = false

  if (!tab?.id || !tab.url || !supported.value) {
    return
  }

  try {
    const url = new URL(tab.url)
    origin.value = url.origin
    hostname.value = url.hostname
    isAuto.value = isBitrixPortalHost(url.hostname)

    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: `${SITE_ENABLE_MESSAGE}:status`,
    })) as { allowed?: boolean; auto?: boolean; origin?: string } | undefined

    enabled.value = Boolean(response?.allowed)
    isAuto.value = Boolean(response?.auto) || isAuto.value
    if (response?.origin) {
      origin.value = response.origin
    }
  } catch {
    if (hostname.value) {
      isAuto.value = isBitrixPortalHost(hostname.value)
      enabled.value = isAuto.value
    }
  }
}

async function onToggle(value: boolean | "indeterminate") {
  if (
    typeof value !== "boolean" ||
    !origin.value ||
    !tabId.value ||
    isAuto.value
  ) {
    return
  }

  busy.value = true
  try {
    await setOriginEnabled(origin.value, value)
    enabled.value = value
    if (value) {
      try {
        await chrome.tabs.sendMessage(tabId.value, {
          type: `${SITE_ENABLE_MESSAGE}:activate`,
        })
      } catch {
        await chrome.tabs.reload(tabId.value)
      }
    } else {
      await chrome.tabs.reload(tabId.value)
    }
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div
    v-if="supported"
    class="settings-card mb-5"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="truncate text-sm font-medium">
          {{ isAuto ? t("site.autoTitle") : t("site.toggleTitle") }}
        </div>
        <div class="truncate text-[10px] text-muted">
          {{ hostname }}
        </div>
      </div>
      <USwitch
        :model-value="enabled"
        :disabled="isAuto || busy"
        @update:model-value="onToggle"
      />
    </div>
    <p
      class="mt-2.5 border-t border-default pt-2.5 text-[11px] leading-relaxed text-muted"
    >
      {{ isAuto ? t("site.autoHint") : t("site.toggleHint") }}
    </p>
  </div>
</template>
