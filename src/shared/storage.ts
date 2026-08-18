import {
  customStorageKey,
  defaultSoundSettings,
  isBitrixPortalHost,
  PRESET_IDS,
  presetPublicPath,
  slotFilePath,
  SOUND_MAP_MESSAGE,
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

export async function rememberPortalOrigin(origin: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.portalOrigin]: origin })
}

export async function resolvePortalOrigin(): Promise<string | null> {
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.url) {
      continue
    }
    try {
      const url = new URL(tab.url)
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        continue
      }
      if (isBitrixPortalHost(url.hostname)) {
        await rememberPortalOrigin(url.origin)
        return url.origin
      }
    } catch {
      continue
    }
  }

  const stored = await chrome.storage.local.get(STORAGE_KEYS.portalOrigin)
  const origin = stored[STORAGE_KEYS.portalOrigin]
  return typeof origin === "string" && origin ? origin : null
}

export async function resolveOriginalSoundUrl(
  slotId: SoundSlotId,
): Promise<string | null> {
  const path = slotFilePath(slotId)
  if (!path) {
    return null
  }

  const tabs = await chrome.tabs.query({})
  const bitrixTab = tabs.find((tab) => {
    if (!tab.id || !tab.url) {
      return false
    }
    try {
      return isBitrixPortalHost(new URL(tab.url).hostname)
    } catch {
      return false
    }
  })

  if (bitrixTab?.id) {
    try {
      const response = (await chrome.tabs.sendMessage(
        bitrixTab.id,
        {
          type: `${SOUND_MAP_MESSAGE}:preview`,
          path,
        },
        { frameId: 0 },
      )) as { dataUrl?: string | null } | undefined
      if (response?.dataUrl) {
        return response.dataUrl
      }
    } catch {
      // Tab may not have the content script yet.
    }
  }

  const origin = bitrixTab?.url
    ? new URL(bitrixTab.url).origin
    : await resolvePortalOrigin()
  if (!origin) {
    return null
  }
  return new URL(path, origin).href
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
