export const SOUND_SLOT_IDS = [
  "reminder",
  "new-message-1",
  "new-message-2",
  "send",
  "video-dialtone",
  "video-ringtone",
  "video-ringtone-modern",
  "video-start",
  "video-stop",
  "video-error",
] as const

export type SoundSlotId = (typeof SOUND_SLOT_IDS)[number]

export type SoundGroup = "messages" | "calls"

export interface SoundSlot {
  id: SoundSlotId
  path: string
  group: SoundGroup
}

export const SOUND_SLOTS: SoundSlot[] = [
  {
    id: "reminder",
    path: "/bitrix/js/im/audio/reminder.mp3",
    group: "messages",
  },
  {
    id: "new-message-1",
    path: "/bitrix/js/im/audio/new-message-1.mp3",
    group: "messages",
  },
  {
    id: "new-message-2",
    path: "/bitrix/js/im/audio/new-message-2.mp3",
    group: "messages",
  },
  {
    id: "send",
    path: "/bitrix/js/im/audio/send.mp3",
    group: "messages",
  },
  {
    id: "video-dialtone",
    path: "/bitrix/js/im/audio/video-dialtone.mp3",
    group: "calls",
  },
  {
    id: "video-ringtone",
    path: "/bitrix/js/im/audio/video-ringtone.mp3",
    group: "calls",
  },
  {
    id: "video-ringtone-modern",
    path: "/bitrix/js/im/audio/video-ringtone-modern.mp3",
    group: "calls",
  },
  {
    id: "video-start",
    path: "/bitrix/js/im/audio/video-start.mp3",
    group: "calls",
  },
  {
    id: "video-stop",
    path: "/bitrix/js/im/audio/video-stop.mp3",
    group: "calls",
  },
  {
    id: "video-error",
    path: "/bitrix/js/im/audio/video-error.mp3",
    group: "calls",
  },
]

export const PRESET_IDS = ["soft", "pop", "bell", "digital", "chime"] as const

export type PresetId = (typeof PRESET_IDS)[number]

export type SoundSourceType = "original" | "preset" | "custom"

export interface SlotSetting {
  source: SoundSourceType
  presetId: PresetId
  customName: string
}

export type SoundSettingsMap = Record<SoundSlotId, SlotSetting>

export const DEFAULT_SLOT_SETTING: SlotSetting = {
  source: "original",
  presetId: "soft",
  customName: "",
}

export const STORAGE_KEYS = {
  settings: "soundSettings",
  customPrefix: "customSound:",
  portalOrigin: "bitrixOrigin",
} as const

export const SOUND_MAP_MESSAGE = "b24-sound:map"
export const MAX_CUSTOM_BYTES = 2 * 1024 * 1024

export function defaultSoundSettings(): SoundSettingsMap {
  return Object.fromEntries(
    SOUND_SLOTS.map((slot) => [slot.id, { ...DEFAULT_SLOT_SETTING }]),
  ) as SoundSettingsMap
}

export function customStorageKey(slotId: SoundSlotId): string {
  return `${STORAGE_KEYS.customPrefix}${slotId}`
}

export function slotIdForUrl(url: string): SoundSlotId | null {
  const normalized = url.split("?")[0]
  const slot = SOUND_SLOTS.find(
    (item) => normalized.endsWith(item.path) || normalized.includes(item.path),
  )
  return slot?.id ?? null
}

export function presetPublicPath(presetId: PresetId): string {
  return `sounds/presets/${presetId}.mp3`
}

export function slotFilePath(slotId: SoundSlotId): string | null {
  const slot = SOUND_SLOTS.find((item) => item.id === slotId)
  if (!slot) {
    return null
  }
  if (slot.id === "video-ringtone-modern") {
    return `${slot.path}?v2`
  }
  return slot.path
}

export function isBitrixPortalHost(hostname: string): boolean {
  return /(^|\.)bitrix24\.[a-z.]+$/i.test(hostname)
}
