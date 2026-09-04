export const BLOCK_READ_RECEIPTS_STORAGE_KEY = "blockReadReceipts"
export const READ_RECEIPTS_SETTING_MESSAGE = "b24-sound:read-receipts-setting"

export function isMessageReadRequest(url: string): boolean {
  try {
    const parsed = new URL(url, location.href)
    return (
      parsed.pathname.endsWith("/bitrix/services/main/ajax.php") &&
      parsed.searchParams.get("action") === "im.v2.Chat.Message.read"
    )
  } catch {
    return false
  }
}
