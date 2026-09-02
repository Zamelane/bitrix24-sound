<script setup lang="ts"></script>

<template>
  <UApp class="app-surface flex min-h-screen flex-col">
    <AppHeader />

    <main class="app-content prose flex-1 dark:prose-invert">
      <RouterView />
    </main>

    <AppFooter />
  </UApp>
</template>
