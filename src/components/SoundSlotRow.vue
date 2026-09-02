<script setup lang="ts">
import type { SoundSlot } from "src/shared/sounds"
import { presetsForGroup } from "src/shared/sounds"
import type { SelectValue } from "src/composables/useSoundSettings"

const props = defineProps<{
  soundSlot: SoundSlot
  modelValue: SelectValue
  customName: string
}>()

const emit = defineEmits<{
  "update:modelValue": [value: SelectValue]
  preview: []
  upload: [file: File]
  clear: []
}>()

const { t } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)

const options = computed(() => [
  { label: t("sounds.presets.original"), value: "original" },
  ...presetsForGroup(props.soundSlot.group).map((id) => ({
    label: t(`sounds.presets.${id}`),
    value: id,
  })),
  { label: t("sounds.presets.custom"), value: "custom" },
])

function onSelect(value: SelectValue) {
  emit("update:modelValue", value)
  if (value === "custom" && !props.customName) {
    fileInput.value?.click()
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (file) {
    emit("upload", file)
  }
}
</script>

<template>
  <div class="settings-card">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="truncate text-sm font-medium">
          {{ t(`sounds.slots.${soundSlot.id}`) }}
        </div>
        <div class="truncate text-[10px] text-muted">
          {{ soundSlot.path }}
        </div>
      </div>
      <div class="flex shrink-0 gap-1">
        <UButton
          icon="ph:play"
          size="xs"
          color="neutral"
          variant="ghost"
          class="icon-button"
          :title="t('sounds.actions.preview')"
          @click="emit('preview')"
        />
        <UButton
          icon="ph:upload-simple"
          size="xs"
          color="neutral"
          variant="ghost"
          class="icon-button"
          :title="t('sounds.actions.upload')"
          @click="fileInput?.click()"
        />
      </div>
    </div>

    <div class="mt-3 flex items-center gap-2">
      <USelect
        :model-value="modelValue"
        :items="options"
        value-key="value"
        class="w-full"
        size="sm"
        @update:model-value="onSelect($event as SelectValue)"
      />
    </div>

    <div
      v-if="customName"
      class="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted"
    >
      <span class="truncate">{{ customName }}</span>
      <UButton
        size="xs"
        color="neutral"
        variant="link"
        class="px-0"
        @click="emit('clear')"
      >
        {{ t("sounds.actions.remove") }}
      </UButton>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm,audio/*"
      class="hidden"
      @change="onFileChange"
    />
  </div>
</template>
