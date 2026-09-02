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
  <section class="space-y-2">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">
      {{ t("onlineStatus.group") }}
    </h2>
    <div class="rounded-xl border border-default bg-default/40 px-3 py-2.5">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-medium">
            {{ t("onlineStatus.title") }}
          </div>
          <p class="mt-1 text-xs text-muted">
            {{ t("onlineStatus.hint") }}
          </p>
        </div>
        <USwitch v-model="enabled" />
      </div>
    </div>
  </section>
</template>
