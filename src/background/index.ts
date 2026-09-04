import { BLOCK_READ_RECEIPTS_STORAGE_KEY } from "src/shared/read-receipts"

self.onerror = function (message, source, lineno, colno, error) {
  console.info("Error: " + message)
  console.info("Source: " + source)
  console.info("Line: " + lineno)
  console.info("Column: " + colno)
  console.info("Error object: " + error)
}

const READ_RECEIPTS_RULE_ID = 240301
const readReceiptsRule: chrome.declarativeNetRequest.Rule = {
  id: READ_RECEIPTS_RULE_ID,
  priority: 1,
  action: { type: "block" },
  condition: {
    regexFilter:
      "^https?://[^/]+/bitrix/services/main/ajax\\.php\\?([^#]*&)?action=im\\.v2\\.Chat\\.Message\\.read(&|$)",
    resourceTypes: ["xmlhttprequest"],
  },
}

function updateReadReceiptsRule() {
  void syncReadReceiptsRule().catch((error: unknown) => {
    console.error("Failed to update the read receipt blocking rule", error)
  })
}

async function syncReadReceiptsRule() {
  const stored = await chrome.storage.local.get(
    BLOCK_READ_RECEIPTS_STORAGE_KEY,
  )
  const enabled = stored[BLOCK_READ_RECEIPTS_STORAGE_KEY] === true

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [READ_RECEIPTS_RULE_ID],
    addRules: enabled ? [readReceiptsRule] : [],
  })
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    Object.hasOwn(changes, BLOCK_READ_RECEIPTS_STORAGE_KEY)
  ) {
    updateReadReceiptsRule()
  }
})

updateReadReceiptsRule()

export {}
