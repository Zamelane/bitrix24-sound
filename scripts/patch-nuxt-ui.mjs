/**
 * Patches @nuxt/ui colors plugin to remove inline script injection
 * that violates Chrome Extension Manifest V3 CSP.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const file = resolve(
  "node_modules/@nuxt/ui/dist/runtime/plugins/colors.js",
)

let content = readFileSync(file, "utf-8")

const needle = `headData.script = [{
      innerHTML: "document.head.removeChild(document.querySelector('[data-nuxt-ui-colors]'))"
    }]`

if (content.includes(needle)) {
  content = content.replace(
    needle,
    `requestAnimationFrame(() => {
      const el = document.querySelector('[data-nuxt-ui-colors]');
      if (el) el.remove();
    })`,
  )
  writeFileSync(file, content, "utf-8")
  console.info("[patch] @nuxt/ui colors.js patched for CSP compliance")
} else {
  console.info("[patch] @nuxt/ui colors.js already patched or changed")
}
