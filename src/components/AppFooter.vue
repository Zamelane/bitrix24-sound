<script setup lang="ts">
const commit = __GIT_COMMIT__
const githubUrl = __GITHUB_URL__
</script>

<template>
  <footer class="app-footer">
    <span class="tracking-[0.08em]">{{ commit }}</span>
    <UButton
      :href="githubUrl"
      target="_blank"
      rel="noopener noreferrer"
      icon="ph:github-logo"
      variant="ghost"
      color="neutral"
      size="xs"
      square
      class="icon-button"
      :title="githubUrl"
    />
  </footer>
</template>
