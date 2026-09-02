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
  <div class="flex justify-between gap-4 p-2 bg-neutral">
    <div
      v-if="isPopupSettings"
      class="flex items-center gap-1"
    >
      <UButton
        icon="lucide:arrow-left"
        variant="ghost"
        square
        :aria-label="$t('settings.back')"
        :title="$t('settings.back')"
        @click="closePopupSettings"
      />
      <div class="font-semibold text-primary">
        {{ $t("onlineStatus.settingsTitle") }}
      </div>
    </div>
    <RouterLink
      v-else
      to="/"
      class="flex gap-2 items-center"
    >
      <img
        src="@assets/logo.png"
        alt="logo"
        class="h-8 w-auto"
      />
      <div class="font-semibold text-primary">
        Bitrix24 Sound
      </div>
    </RouterLink>
    <div class="flex gap-2 justify-center">
      <UButton
        v-if="popupNavigation && !isPopupSettings"
        icon="lucide:settings"
        variant="ghost"
        square
        :aria-label="$t('settings.open')"
        :title="$t('settings.open')"
        @click="openPopupSettings"
      />
      <ThemeSwitch />
    </div>
  </div>
</template>

<style scoped></style>
