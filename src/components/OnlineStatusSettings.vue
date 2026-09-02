<script setup lang="ts">
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"
import { ONLINE_STATUS_STORAGE_KEY } from "src/shared/online-status"

const { t } = useI18n()
const { data: enabled } = useBrowserLocalStorage(
  ONLINE_STATUS_STORAGE_KEY,
  false,
)
</script>

<template>
  <section class="space-y-2.5">
    <h2 class="section-label">
      {{ t("onlineStatus.group") }}
    </h2>
    <div class="settings-card">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-medium">
            {{ t("onlineStatus.title") }}
          </div>
          <p class="mt-1 text-[11px] leading-relaxed text-muted">
            {{ t("onlineStatus.hint") }}
          </p>
        </div>
        <USwitch v-model="enabled" />
      </div>
    </div>
  </section>
</template>
