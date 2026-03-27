# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Run extension in Raycast dev mode (hot reload)
npm run build      # Build and type-check
npm run lint       # Lint with @raycast/eslint-config
npm run fix-lint   # Auto-fix lint issues
```

## Architecture

Single-command Raycast extension (`view` mode) for Spotlight-style contact quick-actions on macOS.

**Entry point:** `src/quick-contact-actions.tsx`

**Two-view flow:**
1. `Command` — `List` of all contacts, filtered by search. Contacts loaded once via AppleScript from the macOS Contacts app (`fetchContacts`). Avatar via `getAvatarIcon` from `@raycast/utils`.
2. `ContactActions` — pushed on Enter. `List` with five sections: FaceTime Video, FaceTime Audio, Phone, Message, Email. Sections are omitted when a contact has no matching values.

**Contact fetching:** `getContacts()` is not available in the bundled `@raycast/api` version. Contacts are fetched via `runAppleScript` talking to the Contacts app, with `∆`/`§`/`≡`/`¦` delimiters for parsing.

**FaceTime calls:** Use `open location "facetime[‑audio]://number"` via `runAppleScript` with the phone/email as a safe argument (never string-interpolated). A follow-up System Events block clicks the "Open FaceTime" dialog button if one appears — this bypasses the manual confirmation click. Errors are swallowed because FaceTime sometimes opens directly with no dialog.

**Permissions:** `"contacts"` in `package.json` (macOS only — `"platforms": ["macOS"]`).

## Local skill

`@.claude/skills/raycast-extension-docs` — Raycast API docs for this project. Invoke via the `Skill` tool when working with Raycast APIs, manifest fields, or UI components.
