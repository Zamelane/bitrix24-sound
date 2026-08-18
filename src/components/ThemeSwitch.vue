<script lang="ts" setup>
import { useTheme, applyTheme } from "src/composables/useTheme"

const { isDark, toggleDark } = useTheme()
applyTheme(isDark.value ? "dark" : "light")
</script>

<template>
  <UButton
    :icon="isDark ? 'lucide:moon' : 'lucide:sun'"
    variant="ghost"
    @click="toggleDark"
  />
</template>
