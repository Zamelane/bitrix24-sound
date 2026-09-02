<script setup lang="ts"></script>

<template>
  <UApp class="app-surface flex min-h-screen flex-col">
    <AppHeader popup-navigation />

    <main class="app-content flex-1">
      <RouterView />
    </main>

    <AppFooter />
  </UApp>
</template>
