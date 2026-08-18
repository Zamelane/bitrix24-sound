import messages from "@intlify/unplugin-vue-i18n/messages"
import { createI18n } from "vue-i18n"
import { useBrowserLocalStorage } from "src/composables/useBrowserStorage"

export const i18n = createI18n({
  globalInjection: true,
  legacy: false,
  locale: "ru",
  fallbackLocale: "ru",
  messages,
})

const { data } = useBrowserLocalStorage<string>("user-locale", "ru")

i18n.global.locale.value = data.value
