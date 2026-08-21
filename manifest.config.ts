import { env } from "node:process"
import type { ManifestV3Export } from "@crxjs/vite-plugin"
import packageJson from "./package.json" with { type: "json" }

const { version, name, description, displayName } = packageJson
const [major, minor, patch, label = "0"] = version
  .replace(/[^\d.-]+/g, "")
  .split(/[.-]/)

const bitrixMatches = [
  "*://*.bitrix24.ru/*",
  "*://bitrix24.ru/*",
  // нужно для кастомных порталов Bitrix24
  "*://*/*",
]

export default {
  author: "Zamelane <zamelane@vk.com>",
  name: env.mode === "staging" ? `[INTERNAL] ${name}` : displayName || name,
  description,
  version: `${major}.${minor}.${patch}.${label}`,
  version_name: version,
  manifest_version: 3,
  action: {
    default_popup: "src/ui/action-popup/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      all_frames: true,
      js: ["src/content-script/page-hook.ts"],
      matches: bitrixMatches,
      run_at: "document_start",
      world: "MAIN",
    },
    {
      all_frames: true,
      js: ["src/content-script/index.ts"],
      matches: bitrixMatches,
      run_at: "document_start",
    },
  ],
  options_page: "src/ui/options-page/index.html",
  offline_enabled: true,
  host_permissions: bitrixMatches,
  permissions: ["storage", "unlimitedStorage", "tabs"],
  web_accessible_resources: [
    {
      resources: ["sounds/presets/*.mp3"],
      matches: bitrixMatches,
      use_dynamic_url: false,
    },
  ],
  browser_specific_settings: {
    gecko: {
      data_collection_permissions: {
        required: ["none"],
      },
    },
  },
  icons: {
    16: "src/assets/logo-16.png",
    24: "src/assets/logo-24.png",
    32: "src/assets/logo-32.png",
    128: "src/assets/logo-128.png",
  },
} as unknown as ManifestV3Export
