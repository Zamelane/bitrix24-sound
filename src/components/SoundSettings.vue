<script setup lang="ts">
import { useSoundSettings } from "src/composables/useSoundSettings"
import SoundSlotRow from "src/components/SoundSlotRow.vue"

const {
  groupedSlots,
  previewError,
  uploadError,
  selectValue,
  applySelect,
  preview,
  uploadCustom,
  clearCustom,
  settings,
} = useSoundSettings()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-5">
    <section
      v-for="(slots, group) in groupedSlots"
      :key="group"
      class="space-y-2"
    >
      <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">
        {{ t(`sounds.groups.${group}`) }}
      </h2>
      <SoundSlotRow
        v-for="slot in slots"
        :key="slot.id"
        :sound-slot="slot"
        :model-value="selectValue(slot.id)"
        :custom-name="settings[slot.id].customName"
        @update:model-value="applySelect(slot.id, $event)"
        @preview="preview(slot.id)"
        @upload="uploadCustom(slot.id, $event)"
        @clear="clearCustom(slot.id)"
      />
    </section>

    <p class="text-xs text-muted">
      {{ t("sounds.hints.custom") }}
    </p>
    <p
      v-if="previewError === 'original'"
      class="text-xs text-muted"
    >
      {{ t("sounds.hints.originalPreview") }}
    </p>
    <p
      v-if="uploadError === 'size'"
      class="text-xs text-error"
    >
      {{ t("sounds.hints.size") }}
    </p>
    <p
      v-if="uploadError === 'type'"
      class="text-xs text-error"
    >
      {{ t("sounds.hints.type") }}
    </p>
  </div>
</template>
