<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    popupNavigation?: boolean
  }>(),
  {
    popupNavigation: false,
  },
)

const route = useRoute()
const router = useRouter()
const isPopupSettings = computed(
  () => props.popupNavigation && route.path === "/action-popup/settings",
)

function openPopupSettings() {
  void router.push("/action-popup/settings")
}

function closePopupSettings() {
  void router.push("/action-popup")
}
</script>

<template>
  <header class="app-header">
    <div
      v-if="isPopupSettings"
      class="flex min-w-0 items-center gap-2"
    >
      <UButton
        icon="lucide:arrow-left"
        variant="ghost"
        color="neutral"
        square
        class="icon-button"
        :aria-label="$t('settings.back')"
        :title="$t('settings.back')"
        @click="closePopupSettings"
      />
      <div class="truncate text-sm font-medium tracking-tight">
        {{ $t("settings.additionalTitle") }}
      </div>
    </div>
    <RouterLink
      v-else
      to="/"
      class="flex min-w-0 items-center gap-2.5"
    >
      <!-- <span class="grid size-8 place-items-center rounded-lg bg-white">
        <img
          src="@assets/logo.png"
          alt=""
          class="size-6 rounded-[6px] object-contain"
        />
      </span> -->
      <div class="truncate text-sm font-medium tracking-tight">
        Bitrix24
        <span class="text-[#3ad353]">Sound</span>
      </div>
    </RouterLink>
    <div class="flex items-center gap-1">
      <UButton
        v-if="popupNavigation && !isPopupSettings"
        icon="lucide:settings"
        variant="ghost"
        color="neutral"
        square
        class="icon-button"
        :aria-label="$t('settings.open')"
        :title="$t('settings.open')"
        @click="openPopupSettings"
      />
      <ThemeSwitch />
    </div>
  </header>
</template>
