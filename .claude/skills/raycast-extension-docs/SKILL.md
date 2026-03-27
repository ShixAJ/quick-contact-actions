---
name: raycast-extension-docs
description: Use when building, modifying, or debugging Raycast extensions in this project. Invoke whenever working with Raycast APIs (List, ActionPanel, Actions, runAppleScript, getAvatarIcon, etc.), configuring the manifest (package.json), handling extension lifecycle, or preparing to publish. Use even for small questions about props, permissions, or component behaviour — the bundled docs are authoritative.
---

# Raycast Extension Docs

Use the bundled docs in `references/` as the source of truth. Read only the files relevant to the task — do not load everything.

## Quick Routing

| Need | Path |
|------|------|
| `List`, `Detail`, `Form`, `Grid`, `ActionPanel`, `Action` | `references/api-reference/user-interface/` |
| `runAppleScript`, `getAvatarIcon`, `showFailureToast` | `references/utils-reference/functions/` |
| `showToast`, `showHUD`, `Alert` | `references/api-reference/feedback/` |
| `Clipboard`, `Storage`, `Cache`, `AI`, `Environment` | `references/api-reference/` |
| Manifest fields, permissions, command modes | `references/information/manifest.md` |
| File structure, best practices, security | `references/information/` |
| Getting started, debugging, publishing | `references/basics/` |
| Real-world extension patterns | `references/examples/` |

Start with `references/SUMMARY.md` when unsure which file to open.

## Working Approach

1. Map the task to the table above and open only that file.
2. Extract the relevant props/signatures — do not read docs you don't need.
3. Cross-check component props in `api-reference/user-interface/` before writing JSX.
4. Verify manifest fields against `information/manifest.md` before touching `package.json`.
5. When the docs are silent on something, say so.
