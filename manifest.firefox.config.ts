import { defineManifest } from "@crxjs/vite-plugin"
import ManifestConfig from "./manifest.config"

// @ts-expect-error ManifestConfig provides all required fields
export default defineManifest((env) => ({
  ...ManifestConfig,
  browser_specific_settings: {
    gecko: {
      id:
        (env as unknown as Record<string, string | undefined>)[
          "FIREFOX_ADDON_ID"
        ] || "bitrix24-sound@zamelane",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  },
  background: {
    scripts: ["src/background/index.ts"],
    type: "module",
    persistent: false,
  },
  permissions: [
    // @ts-expect-error background permission is not supported in Firefox
    ...ManifestConfig.permissions.filter(
      (permission: string) => permission !== "background",
    ),
  ],
}))
