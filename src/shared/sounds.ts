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

export const MESSAGE_ONLY_PRESET_IDS = [
  "msg-appear",
  "msg-calm",
  "msg-iridescent",
  "msg-level-up",
  "msg-melody",
  "msg-pager",
  "msg-radio",
  "msg-sms",
  "msg-sms-in",
  "msg-soft",
  "msg-space",
  "msg-welcome",
] as const

export const CALL_ONLY_PRESET_IDS = [
  "call-huawei",
  "call-iphone",
  "call-lg",
  "call-nokia",
  "call-ring",
  "call-tada",
  "call-xiaomi",
] as const

export const ERROR_PRESET_IDS = [
  "err-buzz",
  "err-dragon",
  "err-fail",
  "err-windows",
  "err-wrong",
] as const

export const MESSAGE_PRESET_IDS = [
  ...MESSAGE_ONLY_PRESET_IDS,
  ...ERROR_PRESET_IDS,
] as const

export const CALL_PRESET_IDS = [
  ...CALL_ONLY_PRESET_IDS,
  ...ERROR_PRESET_IDS,
] as const

export const PRESET_IDS = [...MESSAGE_PRESET_IDS, ...CALL_PRESET_IDS] as const

export type PresetId = (typeof PRESET_IDS)[number]

export type SoundSourceType = "original" | "preset" | "custom"

export interface SlotSetting {
  source: SoundSourceType
  presetId: PresetId
  customName: string
}

export type SoundSettingsMap = Record<SoundSlotId, SlotSetting>

export function presetsForGroup(group: SoundGroup): readonly PresetId[] {
  return group === "calls" ? CALL_PRESET_IDS : MESSAGE_PRESET_IDS
}

export function defaultPresetId(group: SoundGroup): PresetId {
  const presets = presetsForGroup(group)
  return (presets[0] ?? MESSAGE_PRESET_IDS[0]) as PresetId
}

export function isPresetForGroup(
  group: SoundGroup,
  value: string,
): value is PresetId {
  return (presetsForGroup(group) as readonly string[]).includes(value)
}

export function slotGroup(slotId: SoundSlotId): SoundGroup {
  return SOUND_SLOTS.find((slot) => slot.id === slotId)?.group ?? "messages"
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
    SOUND_SLOTS.map((slot) => [
      slot.id,
      {
        source: "original" as const,
        presetId: defaultPresetId(slot.group),
        customName: "",
      },
    ]),
  ) as SoundSettingsMap
}

export function customStorageKey(slotId: SoundSlotId): string {
  return `${STORAGE_KEYS.customPrefix}${slotId}`
}

export function slotIdForUrl(url: string): SoundSlotId | null {
  if (!url.includes("/im/audio/")) {
    return null
  }

  const [rawPath, queryPart = ""] = url.split("?")
  let pathPart = rawPath
  if (rawPath.includes("://")) {
    try {
      pathPart = new URL(rawPath).pathname
    } catch {
      return null
    }
  }

  for (const item of SOUND_SLOTS) {
    const audioName =
      item.path
        .split("/")
        .pop()
        ?.replace(/\.mp3$/i, "") ?? ""
    const matchesFile =
      pathPart.endsWith(`${audioName}.mp3`) ||
      pathPart.endsWith(`${audioName}.ogg`) ||
      pathPart.endsWith(`${audioName}.wav`) ||
      pathPart.endsWith(item.path)

    if (!matchesFile) {
      continue
    }

    if (
      item.id === "video-ringtone-modern" &&
      queryPart &&
      !queryPart.startsWith("v2")
    ) {
      continue
    }

    return item.id
  }

  return null
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
