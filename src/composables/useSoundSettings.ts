import {
  isPresetForGroup,
  MAX_CUSTOM_BYTES,
  slotGroup,
  SOUND_SLOTS,
  STORAGE_KEYS,
  type PresetId,
  type SlotSetting,
  type SoundSettingsMap,
  type SoundSlotId,
} from "src/shared/sounds"
import {
  loadCustomSound,
  mergeSoundSettings,
  presetUrl,
  removeCustomSound,
  resolveOriginalSoundUrl,
  saveCustomSound,
  type CustomSoundRecord,
} from "src/shared/storage"

const SELECT_ORIGINAL = "original"
const SELECT_CUSTOM = "custom"

export type SelectValue =
  | typeof SELECT_ORIGINAL
  | PresetId
  | typeof SELECT_CUSTOM

let previewAudio: HTMLAudioElement | null = null

export function useSoundSettings() {
  const { data: settings } = useBrowserLocalStorage<SoundSettingsMap>(
    STORAGE_KEYS.settings,
    mergeSoundSettings(undefined),
  )

  const previewError = ref("")
  const uploadError = ref("")

  const groupedSlots = computed(() => ({
    messages: SOUND_SLOTS.filter((slot) => slot.group === "messages"),
    calls: SOUND_SLOTS.filter((slot) => slot.group === "calls"),
  }))

  function selectValue(slotId: SoundSlotId): SelectValue {
    const setting = settings.value[slotId]
    if (setting.source === "custom") {
      return SELECT_CUSTOM
    }
    if (
      setting.source === "preset" &&
      isPresetForGroup(slotGroup(slotId), setting.presetId)
    ) {
      return setting.presetId
    }
    return SELECT_ORIGINAL
  }

  function applySelect(slotId: SoundSlotId, value: SelectValue) {
    const current = settings.value[slotId]
    const next: SlotSetting = { ...current }
    if (value === SELECT_ORIGINAL) {
      next.source = "original"
    } else if (value === SELECT_CUSTOM) {
      next.source = "custom"
    } else if (isPresetForGroup(slotGroup(slotId), value)) {
      next.source = "preset"
      next.presetId = value
    }
    settings.value[slotId] = next
  }

  async function resolvePlayableUrl(
    slotId: SoundSlotId,
  ): Promise<string | null> {
    const setting = settings.value[slotId]
    if (setting.source === "preset") {
      return presetUrl(setting.presetId)
    }
    if (setting.source === "custom") {
      const custom = await loadCustomSound(slotId)
      return custom?.dataUrl ?? null
    }
    return resolveOriginalSoundUrl(slotId)
  }

  async function preview(slotId: SoundSlotId) {
    previewError.value = ""
    const url = await resolvePlayableUrl(slotId)
    if (!url) {
      previewError.value = "original"
      return
    }
    try {
      previewAudio?.pause()
      previewAudio = new Audio(url)
      await previewAudio.play()
    } catch {
      previewError.value = "original"
    }
  }

  async function uploadCustom(slotId: SoundSlotId, file: File) {
    uploadError.value = ""
    if (file.size > MAX_CUSTOM_BYTES) {
      uploadError.value = "size"
      return
    }
    if (file.type && !file.type.startsWith("audio/")) {
      uploadError.value = "type"
      return
    }

    const dataUrl = await readFileAsDataUrl(file)
    const record: CustomSoundRecord = {
      name: file.name,
      mime: file.type || "audio/mpeg",
      dataUrl,
    }
    await saveCustomSound(slotId, record)
    settings.value[slotId] = {
      ...settings.value[slotId],
      source: "custom",
      customName: file.name,
    }
  }

  async function clearCustom(slotId: SoundSlotId) {
    await removeCustomSound(slotId)
    settings.value[slotId] = {
      ...settings.value[slotId],
      source: "original",
      customName: "",
    }
  }

  return {
    settings,
    groupedSlots,
    previewError,
    uploadError,
    selectValue,
    applySelect,
    preview,
    uploadCustom,
    clearCustom,
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
