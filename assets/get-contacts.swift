import Foundation
import Contacts
import AppKit

// Image cache dir passed as first argument (environment.supportPath from Raycast)
let imageDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : NSTemporaryDirectory()
let imageDirURL = URL(fileURLWithPath: imageDir, isDirectory: true)
try? FileManager.default.createDirectory(at: imageDirURL, withIntermediateDirectories: true)

func generateInitialsAvatar(name: String, size: CGFloat = 120) -> Data? {
  // Extract up to 2 initials from the first two words
  let words = name.split(separator: " ").map { String($0) }
  let initials: String
  if words.count >= 2, let f = words[0].first, let s = words[1].first {
    initials = "\(f)\(s)".uppercased()
  } else if let f = words.first?.first {
    initials = String(f).uppercased()
  } else {
    initials = "?"
  }

  // Pick a background color based on a simple hash of the name
  let colors: [NSColor] = [
    .systemRed, .systemBlue, .systemGreen, .systemOrange,
    .systemPurple, .systemPink, .systemTeal, .systemIndigo,
  ]
  let hash = name.unicodeScalars.reduce(0) { ($0 &* 31) &+ Int($1.value) }
  let color = colors[abs(hash) % colors.count]

  let imageSize = NSSize(width: size, height: size)
  let image = NSImage(size: imageSize)
  image.lockFocus()

  // Draw filled circle
  color.setFill()
  NSBezierPath(ovalIn: NSRect(origin: .zero, size: imageSize)).fill()

  // Draw initials centered in white
  let font = NSFont.systemFont(ofSize: size * 0.4, weight: .medium)
  let attrs: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor.white,
  ]
  let str = NSAttributedString(string: initials, attributes: attrs)
  let textSize = str.size()
  let textOrigin = NSPoint(
    x: (size - textSize.width) / 2,
    y: (size - textSize.height) / 2
  )
  str.draw(at: textOrigin)

  image.unlockFocus()

  guard let tiffData = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiffData),
        let pngData = bitmap.representation(using: .png, properties: [:])
  else { return nil }
  return pngData
}

let store = CNContactStore()
let keysToFetch: [CNKeyDescriptor] = [
  CNContactIdentifierKey as CNKeyDescriptor,
  CNContactGivenNameKey as CNKeyDescriptor,
  CNContactFamilyNameKey as CNKeyDescriptor,
  CNContactOrganizationNameKey as CNKeyDescriptor,
  CNContactPhoneNumbersKey as CNKeyDescriptor,
  CNContactEmailAddressesKey as CNKeyDescriptor,
  CNContactImageDataAvailableKey as CNKeyDescriptor,
  CNContactThumbnailImageDataKey as CNKeyDescriptor,
]

let request = CNContactFetchRequest(keysToFetch: keysToFetch)
request.sortOrder = .givenName
var contacts: [[String: Any]] = []

do {
  try store.enumerateContacts(with: request) { contact, _ in
    guard !contact.phoneNumbers.isEmpty || !contact.emailAddresses.isEmpty else { return }

    let firstName = contact.givenName
    let lastName = contact.familyName
    let org = contact.organizationName
    var name = "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    if name.isEmpty { name = org }
    if name.isEmpty { return }

    let phones = contact.phoneNumbers.map { labeled -> [String: String] in
      let label = labeled.label.flatMap { CNLabeledValue<NSString>.localizedString(forLabel: $0) } ?? "Phone"
      return ["label": label, "value": labeled.value.stringValue]
    }

    let emails = contact.emailAddresses.map { labeled -> [String: String] in
      let label = labeled.label.flatMap { CNLabeledValue<NSString>.localizedString(forLabel: $0) } ?? "Email"
      return ["label": label, "value": labeled.value as String]
    }

    var entry: [String: Any] = ["id": contact.identifier, "name": name, "phones": phones, "emails": emails]

    let safeId = contact.identifier
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: ":", with: "_")
    let imageURL = imageDirURL.appendingPathComponent("\(safeId).png")

    if !FileManager.default.fileExists(atPath: imageURL.path) {
      if contact.imageDataAvailable, let imageData = contact.thumbnailImageData {
        // Save circular cropped PNG for contacts with photos
        if let nsImage = NSImage(data: imageData) {
          let size = min(nsImage.size.width, nsImage.size.height)
          let cropSize = NSSize(width: size, height: size)
          let circularImage = NSImage(size: cropSize)
          circularImage.lockFocus()
          let rect = NSRect(origin: .zero, size: cropSize)
          NSBezierPath(ovalIn: rect).addClip()
          nsImage.draw(in: rect, from: NSRect(origin: .zero, size: nsImage.size), operation: .sourceOver, fraction: 1.0)
          circularImage.unlockFocus()
          if let tiffData = circularImage.tiffRepresentation,
             let bitmap = NSBitmapImageRep(data: tiffData),
             let pngData = bitmap.representation(using: .png, properties: [:]) {
            try? pngData.write(to: imageURL)
          }
        }
      } else {
        // Generate initials avatar for contacts without photos
        if let pngData = generateInitialsAvatar(name: name) {
          try? pngData.write(to: imageURL)
        }
      }
    }

    entry["imagePath"] = imageURL.path
    contacts.append(entry)
  }
} catch {
  fputs("error: \(error.localizedDescription)\n", stderr)
  exit(1)
}

if let data = try? JSONSerialization.data(withJSONObject: contacts),
  let json = String(data: data, encoding: .utf8)
{
  print(json)
}
