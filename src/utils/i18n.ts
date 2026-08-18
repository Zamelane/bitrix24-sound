import messages from "@intlify/unplugin-vue-i18n/messages"
import { createI18n } from "vue-i18n"

export const i18n = createI18n({
  globalInjection: true,
  legacy: false,
  locale: "ru",
  fallbackLocale: "ru",
  messages,
})

// restore locale from local storage

const { data } = useBrowserLocalStorage<string>("user-locale", "ru")

i18n.global.locale.value = data.value
