<script setup lang="ts"></script>

<template>
  <div class="flex justify-between gap-4 p-2 bg-neutral">
    <RouterLink
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
      <ThemeSwitch />
    </div>
  </div>
</template>

<style scoped></style>
