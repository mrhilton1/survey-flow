import assert from "node:assert/strict"
import test from "node:test"
import { normalizePlatformScript } from "../lib/platform/script-logic.ts"

test("platform script normalization accepts safe inline and external scripts", () => {
  assert.deepEqual(normalizePlatformScript({
    name: "  GTM  ",
    scope: "global",
    placement: "head",
    environment: "production",
    script_type: "inline",
    content: "window.dataLayer = window.dataLayer || [];",
    enabled: true,
    display_order: 10
  }), {
    name: "GTM",
    description: null,
    scope: "global",
    workspace_id: null,
    placement: "head",
    environment: "production",
    script_type: "inline",
    content: "window.dataLayer = window.dataLayer || [];",
    src_url: null,
    enabled: true,
    display_order: 10
  })

  const external = normalizePlatformScript({
    name: "Chat",
    script_type: "external",
    src_url: "https://cdn.example.com/chat.js"
  })
  assert.equal(external.script_type, "external")
  assert.equal(external.src_url, "https://cdn.example.com/chat.js")
})

test("platform script normalization rejects incomplete or unsafe scripts", () => {
  assert.match(normalizePlatformScript({ name: "x", content: "x" }).error || "", /at least 2/)
  assert.match(normalizePlatformScript({ name: "Chat", scope: "workspace", content: "x" }).error || "", /Workspace scope/)
  assert.match(normalizePlatformScript({ name: "Chat", script_type: "external", src_url: "http://example.com/chat.js" }).error || "", /HTTPS/)
  assert.match(normalizePlatformScript({ name: "Chat", script_type: "inline", content: "" }).error || "", /content/)
})

