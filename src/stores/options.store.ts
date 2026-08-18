import { useTheme } from "src/composables/useTheme"
import {
  useBrowserLocalStorage,
  useBrowserSyncStorage,
} from "src/composables/useBrowserStorage"

export const useOptionsStore = defineStore("options", () => {
  const { isDark, toggleDark } = useTheme()

  const { data: profile } = useBrowserSyncStorage<{
    name: string
    age: number
  }>("profile", {
    name: "Mario",
    age: 24,
  })

  const { data: others } = useBrowserLocalStorage<{
    awesome: boolean
    counter: number
  }>("options", {
    awesome: true,
    counter: 0,
  })

  return {
    isDark,
    toggleDark,
    profile,
    others,
  }
})
