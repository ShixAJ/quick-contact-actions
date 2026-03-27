import { Action, ActionPanel, environment, Icon, Image, List, useNavigation } from "@raycast/api";
import { getAvatarIcon } from "@raycast/utils";
import { execFile } from "child_process";
import { join } from "path";
import { useEffect, useRef, useState } from "react";

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

// Uses a bundled Swift script that calls CNContactStore directly.
// This uses the native Contacts permission (no Automation permission needed).
async function fetchContacts(): Promise<Contact[]> {
  const scriptPath = join(environment.assetsPath, "get-contacts.swift");
  const imageDir = join(environment.supportPath, "avatars");
  const json = await new Promise<string>((resolve, reject) => {
    execFile("/usr/bin/swift", [scriptPath, imageDir], { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
  return JSON.parse(json) as Contact[];
}

function ContactActions({ contact }: { contact: Contact }) {
  const { phones, emails } = contact;

  return (
    <List navigationTitle={contact.name} searchBarPlaceholder="Filter actions…">
      {phones.length > 0 && (
        <List.Section title="FaceTime Video">
          {phones.map((p, i) => (
            <List.Item
              key={`video-${i}`}
              title={p.label}
              subtitle={p.value}
              icon={Icon.Video}
              actions={
                <ActionPanel>
                  <Action.Open
                    title="Start FaceTime Video"
                    icon={Icon.Video}
                    target={`facetime://${p.value.replace(/\s/g, "")}`}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {(phones.length > 0 || emails.length > 0) && (
        <List.Section title="FaceTime Audio">
          {phones.map((p, i) => (
            <List.Item
              key={`audio-p-${i}`}
              title={p.label}
              subtitle={p.value}
              icon={Icon.Phone}
              actions={
                <ActionPanel>
                  <Action.Open
                    title="Start FaceTime Audio"
                    icon={Icon.Phone}
                    target={`facetime-audio://${p.value.replace(/\s/g, "")}`}
                  />
                </ActionPanel>
              }
            />
          ))}
          {emails.map((e, i) => (
            <List.Item
              key={`audio-e-${i}`}
              title={e.label}
              subtitle={e.value}
              icon={Icon.Envelope}
              actions={
                <ActionPanel>
                  <Action.Open
                    title="Start FaceTime Audio"
                    icon={Icon.Phone}
                    target={`facetime-audio://${e.value}`}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {phones.length > 0 && (
        <List.Section title="Phone">
          {phones.map((p, i) => (
            <List.Item
              key={`call-${i}`}
              title={p.label}
              subtitle={p.value}
              icon={Icon.Mobile}
              actions={
                <ActionPanel>
                  <Action.Open title="Call" icon={Icon.Mobile} target={`tel:${p.value.replace(/[^+\d]/g, "")}`} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {phones.length > 0 && (
        <List.Section title="Message">
          {phones.map((p, i) => (
            <List.Item
              key={`sms-${i}`}
              title={p.label}
              subtitle={p.value}
              icon={Icon.Message}
              actions={
                <ActionPanel>
                  <Action.Open
                    title="Send Message"
                    icon={Icon.Message}
                    target={`sms:${p.value.replace(/[^+\d]/g, "")}`}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {emails.length > 0 && (
        <List.Section title="Email">
          {emails.map((e, i) => (
            <List.Item
              key={`email-${i}`}
              title={e.label}
              subtitle={e.value}
              icon={Icon.Envelope}
              actions={
                <ActionPanel>
                  <Action.Open title="Send Email" icon={Icon.Envelope} target={`mailto:${e.value}`} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

export default function Command(props: { arguments: { contact?: string } }) {
  const contactArg = props.arguments.contact?.trim() ?? "";
  const [searchText, setSearchText] = useState(contactArg);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const { push } = useNavigation();
  const didAutoNav = useRef(false);

  useEffect(() => {
    fetchContacts()
      .then(setContacts)
      .catch((e: Error) => setError(e.message ?? "Failed to load contacts"))
      .finally(() => setIsLoading(false));
  }, []);

  // Auto-navigate when argument provided and exactly one contact matches
  useEffect(() => {
    if (!isLoading && contactArg && !didAutoNav.current) {
      const matches = contacts.filter((c) => c.name.toLowerCase().includes(contactArg.toLowerCase()));
      if (matches.length === 1) {
        didAutoNav.current = true;
        push(<ContactActions contact={matches[0]} />);
      }
    }
  }, [isLoading, contacts]);

  // When searchText is controlled, Raycast disables built-in filtering — filter and rank manually.
  // Score: 3 = exact, 2 = name starts with query, 1 = any word starts with query, 0 = substring anywhere.
  const displayedContacts = searchText
    ? contacts
        .flatMap((c) => {
          const lower = c.name.toLowerCase();
          const q = searchText.toLowerCase();
          let score: number;
          if (lower === q) score = 3;
          else if (lower.startsWith(q)) score = 2;
          else if (lower.split(" ").some((w) => w.startsWith(q))) score = 1;
          else if (lower.includes(q)) score = 0;
          else return [];
          return [{ contact: c, score }];
        })
        .sort((a, b) => b.score - a.score)
        .map(({ contact }) => contact)
    : contacts;

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search contacts…"
    >
      {error ? (
        <List.EmptyView title="Could not load contacts" description={error} icon={Icon.Warning} />
      ) : (
        displayedContacts.map((contact) => (
          <List.Item
            key={contact.id}
            title={contact.name}
            icon={
              contact.imagePath ? { source: contact.imagePath, mask: Image.Mask.Circle } : getAvatarIcon(contact.name)
            }
            actions={
              <ActionPanel>
                <Action.Push
                  title="Show Actions"
                  target={<ContactActions contact={contact} />}
                  icon={Icon.ChevronRight}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
