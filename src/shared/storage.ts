import {
  customStorageKey,
  defaultSoundSettings,
  PRESET_IDS,
  presetPublicPath,
  SOUND_SLOT_IDS,
  SOUND_SLOTS,
  STORAGE_KEYS,
  type PresetId,
  type SoundSettingsMap,
  type SoundSlotId,
} from "./sounds"

export interface CustomSoundRecord {
  name: string
  mime: string
  dataUrl: string
}

export type ReplacementMap = Record<SoundSlotId, string | null>

function isPresetId(value: string): value is PresetId {
  return (PRESET_IDS as readonly string[]).includes(value)
}

export function mergeSoundSettings(
  stored: Partial<SoundSettingsMap> | undefined,
): SoundSettingsMap {
  const defaults = defaultSoundSettings()
  if (!stored) {
    return defaults
  }

  for (const slotId of SOUND_SLOT_IDS) {
    const incoming = stored[slotId]
    if (!incoming) {
      continue
    }
    defaults[slotId] = {
      source: incoming.source ?? "original",
      presetId: isPresetId(incoming.presetId) ? incoming.presetId : "soft",
      customName: incoming.customName ?? "",
    }
  }

  return defaults
}

export async function loadSoundSettings(): Promise<SoundSettingsMap> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings)
  return mergeSoundSettings(result[STORAGE_KEYS.settings])
}

export async function loadCustomSound(
  slotId: SoundSlotId,
): Promise<CustomSoundRecord | null> {
  const key = customStorageKey(slotId)
  const result = await chrome.storage.local.get(key)
  const record = result[key] as CustomSoundRecord | undefined
  if (!record?.dataUrl) {
    return null
  }
  return record
}

export async function saveCustomSound(
  slotId: SoundSlotId,
  record: CustomSoundRecord,
): Promise<void> {
  await chrome.storage.local.set({ [customStorageKey(slotId)]: record })
}

export async function removeCustomSound(slotId: SoundSlotId): Promise<void> {
  await chrome.storage.local.remove(customStorageKey(slotId))
}

export function presetUrl(presetId: PresetId): string {
  return chrome.runtime.getURL(presetPublicPath(presetId))
}

export async function buildReplacementMap(): Promise<ReplacementMap> {
  const settings = await loadSoundSettings()
  const map = {} as ReplacementMap

  for (const slot of SOUND_SLOTS) {
    const setting = settings[slot.id]
    if (setting.source === "preset") {
      map[slot.id] = presetUrl(setting.presetId)
      continue
    }
    if (setting.source === "custom") {
      const custom = await loadCustomSound(slot.id)
      map[slot.id] = custom?.dataUrl ?? null
      continue
    }
    map[slot.id] = null
  }

  return map
}
