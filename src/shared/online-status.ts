export const ONLINE_STATUS_STORAGE_KEY = "showUserOnlineStatus"
export const ONLINE_STATUS_SETTING_MESSAGE = "b24-sound:online-status-setting"

interface UserStatusRecord {
  id: string | number
  status: string
  type: "user"
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
): void {
  if (isUserStatusRecord(value)) {
    const id = String(value.id)
    if (value.status.toLowerCase() === "online") {
      onlineUserIds.add(id)
    } else {
      onlineUserIds.delete(id)
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      updateOnlineUserIds(item, onlineUserIds)
    }
    return
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      updateOnlineUserIds(child, onlineUserIds)
    }
  }
}
