<script setup lang="ts">
const commit = __GIT_COMMIT__
const githubUrl = __GITHUB_URL__
</script>

<template>
  <footer
    class="flex justify-between items-center gap-2 px-3 py-2 text-[11px] text-muted border-t border-default"
  >
    <span class="font-mono tracking-wide">{{ commit }}</span>
    <UButton
      :href="githubUrl"
      target="_blank"
      rel="noopener noreferrer"
      icon="ph:github-logo"
      variant="ghost"
      color="neutral"
      size="xs"
      square
      :title="githubUrl"
    />
  </footer>
</template>
