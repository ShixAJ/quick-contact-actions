import {
    Action,
    ActionPanel,
    closeMainWindow,
    environment,
    Icon,
    Image,
    List,
    showToast,
    Toast,
} from "@raycast/api";
import { getAvatarIcon } from "@raycast/utils";
import { execFile, exec } from "child_process";
import { join } from "path";
import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────

interface ContactValue {
    label: string;
    value: string;
}

interface Contact {
    id: string;
    name: string;
    phones: ContactValue[];
    emails: ContactValue[];
    imagePath?: string;
}

// ── Contact fetching ───────────────────────────────────────────────────

// Uses a pre-compiled Swift binary that calls CNContactStore directly.
// Compile at build time: swiftc assets/get-contacts.swift -o assets/get-contacts
async function fetchContacts(): Promise<Contact[]> {
    const binaryPath = join(environment.assetsPath, "get-contacts");
    const imageDir = join(environment.supportPath, "avatars");
    const json = await new Promise<string>((resolve, reject) => {
        execFile(binaryPath, [imageDir], { timeout: 10000 }, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout);
        });
    });
    return JSON.parse(json) as Contact[];
}

// ── FaceTime / call helpers ────────────────────────────────────────────

// Opens FaceTime and auto-clicks the call button via AppleScript to skip
// the confirmation dialog. This mimics Spotlight's instant-call behavior.
function startFaceTime(target: string, video: boolean) {
    const scheme = video ? "facetime" : "facetime-audio";
    const clean = target.replace(/\s/g, "");
    closeMainWindow();
    exec(`
    open "${scheme}://${clean}" && sleep 0.8 && \
    osascript -e '
      tell application "System Events"
        tell process "FaceTime"
          try
            click button 1 of window 1
          end try
        end tell
      end tell
    '
  `);
}

function startPhoneCall(number: string) {
    const clean = number.replace(/[^+\d]/g, "");
    closeMainWindow();
    exec(`open "tel:${clean}"`);
}

function startMessage(number: string) {
    const clean = number.replace(/[^+\d]/g, "");
    closeMainWindow();
    exec(`open "sms:${clean}"`);
}

function startEmail(email: string) {
    closeMainWindow();
    exec(`open "mailto:${email}"`);
}

// ── Search scoring ─────────────────────────────────────────────────────

function scoreContact(contact: Contact, query: string): number {
    const q = query.toLowerCase();
    const name = contact.name.toLowerCase();

    // Name matching (highest priority)
    if (name === q) return 100;
    if (name.startsWith(q)) return 80;
    if (name.split(" ").some((w) => w.startsWith(q))) return 60;
    if (name.includes(q)) return 40;

    // Phone number matching
    const qDigits = q.replace(/\D/g, "");
    if (qDigits.length >= 3) {
        const phoneMatch = contact.phones.some((p) => p.value.replace(/\D/g, "").includes(qDigits));
        if (phoneMatch) return 30;
    }

    // Email matching
    if (contact.emails.some((e) => e.value.toLowerCase().includes(q))) return 20;

    return -1; // no match
}

// ── Main command ───────────────────────────────────────────────────────

export default function Command() {
    const [searchText, setSearchText] = useState("");
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchContacts()
            .then(setContacts)
            .catch((e: Error) => {
                showToast({ style: Toast.Style.Failure, title: "Failed to load contacts", message: e.message });
            })
            .finally(() => setIsLoading(false));
    }, []);

    const displayed = searchText
        ? contacts
            .map((c) => ({ contact: c, score: scoreContact(c, searchText) }))
            .filter(({ score }) => score >= 0)
            .sort((a, b) => b.score - a.score)
            .map(({ contact }) => contact)
        : contacts;

    return (
        <List isLoading={isLoading} searchText={searchText} onSearchTextChange={setSearchText} searchBarPlaceholder="Search contacts…">
            {displayed.map((contact) => (
                <List.Item
                    key={contact.id}
                    title={contact.name}
                    subtitle={contactSubtitle(contact)}
                    icon={
                        contact.imagePath ? { source: contact.imagePath, mask: Image.Mask.Circle } : getAvatarIcon(contact.name)
                    }
                    actions={
                        <ActionPanel>
                            {/* FaceTime Video */}
                            {contact.phones.length > 0 && (
                                <Action
                                    title="FaceTime Video"
                                    icon={Icon.Video}
                                    onAction={() => startFaceTime(contact.phones[0].value, true)}
                                />
                            )}

                            {/* FaceTime Audio */}
                            {contact.phones.length > 0 && (
                                <Action
                                    title="FaceTime Audio"
                                    icon={Icon.Phone}
                                    onAction={() => startFaceTime(contact.phones[0].value, false)}
                                />
                            )}

                            {/* Phone call */}
                            {contact.phones.length > 0 && (
                                <Action
                                    title="Call"
                                    icon={Icon.Mobile}
                                    onAction={() => startPhoneCall(contact.phones[0].value)}
                                />
                            )}

                            {/* iMessage */}
                            {contact.phones.length > 0 && (
                                <Action
                                    title="Send Message"
                                    icon={Icon.Message}
                                    onAction={() => startMessage(contact.phones[0].value)}
                                />
                            )}

                            {/* Email */}
                            {contact.emails.length > 0 && (
                                <Action
                                    title="Send Email"
                                    icon={Icon.Envelope}
                                    onAction={() => startEmail(contact.emails[0].value)}
                                />
                            )}

                            {/* Submenus for additional numbers / emails */}
                            {contact.phones.length > 1 && (
                                <ActionPanel.Submenu title="Other Phone Numbers" icon={Icon.List}>
                                    {contact.phones.slice(1).map((p, i) => (
                                        <Action
                                            key={`alt-phone-${i}`}
                                            title={`${p.label}: ${p.value}`}
                                            icon={Icon.Phone}
                                            onAction={() => startFaceTime(p.value, true)}
                                        />
                                    ))}
                                </ActionPanel.Submenu>
                            )}
                            {contact.emails.length > 1 && (
                                <ActionPanel.Submenu title="Other Emails" icon={Icon.List}>
                                    {contact.emails.slice(1).map((e, i) => (
                                        <Action
                                            key={`alt-email-${i}`}
                                            title={`${e.label}: ${e.value}`}
                                            icon={Icon.Envelope}
                                            onAction={() => startEmail(e.value)}
                                        />
                                    ))}
                                </ActionPanel.Submenu>
                            )}
                        </ActionPanel>
                    }
                />
            ))}
        </List>
    );
}

// Show primary phone or email as subtitle
function contactSubtitle(contact: Contact): string {
    if (contact.phones.length > 0) return contact.phones[0].value;
    if (contact.emails.length > 0) return contact.emails[0].value;
    return "";
}