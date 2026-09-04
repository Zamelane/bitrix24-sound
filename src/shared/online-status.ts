export const ONLINE_STATUS_STORAGE_KEY = "showUserOnlineStatus"
export const ONLINE_STATUS_SETTING_MESSAGE = "b24-sound:online-status-setting"
export const ONLINE_ACTIVITY_TTL_MS = 3 * 60 * 1000

interface UserStatusRecord {
  id: string | number
  status: string
  type: "user"
  lastActivityDate?: string | false
  last_activity_date?: string | false
  desktopLastDate?: string | false
  desktop_last_date?: string | false
}

function isUserStatusRecord(value: unknown): value is UserStatusRecord {
  if (!value || typeof value !== "object") {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    (typeof record.id === "string" || typeof record.id === "number") &&
    typeof record.status === "string" &&
    record.type === "user"
  )
}

export function updateOnlineUserIds(
  value: unknown,
  onlineUserIds: Set<string>,
  now = Date.now(),
): void {
  if (isUserStatusRecord(value)) {
    const id = String(value.id)
    if (value.status.toLowerCase() !== "online") {
      onlineUserIds.delete(id)
    } else {
      const activityFields = [
        "lastActivityDate",
        "last_activity_date",
        "desktopLastDate",
        "desktop_last_date",
      ] as const
      const hasActivityDate = activityFields.some((field) => field in value)
      const activityTime = Math.max(
        ...activityFields
          .map((field) => value[field])
          .filter((date): date is string => typeof date === "string")
          .map(Date.parse),
      )

      if (!hasActivityDate) {
        onlineUserIds.add(id)
      } else if (Number.isFinite(activityTime)) {
        const activityAge = now - activityTime
        if (
          activityAge >= -ONLINE_ACTIVITY_TTL_MS &&
          activityAge <= ONLINE_ACTIVITY_TTL_MS
        ) {
          onlineUserIds.add(id)
        } else {
          onlineUserIds.delete(id)
        }
      } else {
        onlineUserIds.delete(id)
      }
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      updateOnlineUserIds(item, onlineUserIds, now)
    }
    return
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      updateOnlineUserIds(child, onlineUserIds, now)
    }
  }
}
