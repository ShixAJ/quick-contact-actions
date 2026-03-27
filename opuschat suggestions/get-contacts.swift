import Foundation
import Contacts

let imageDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : NSTemporaryDirectory()
let imageDirURL = URL(fileURLWithPath: imageDir, isDirectory: true)
try? FileManager.default.createDirectory(at: imageDirURL, withIntermediateDirectories: true)

let store = CNContactStore()

// Fetch WITHOUT thumbnail first — images are expensive for large contact lists.
// We fetch them in a second pass only for contacts that have image data available.
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

    var entry: [String: Any] = [
      "id": contact.identifier,
      "name": name,
      "phones": phones,
      "emails": emails,
    ]

    // Only write image if the contact actually has one
    if contact.imageDataAvailable, let imageData = contact.thumbnailImageData {
      let safeId = contact.identifier
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: ":", with: "_")
      let imageURL = imageDirURL.appendingPathComponent("\(safeId).jpg")
      if !FileManager.default.fileExists(atPath: imageURL.path) {
        try? imageData.write(to: imageURL)
      }
      entry["imagePath"] = imageURL.path
    }

    contacts.append(entry)
  }
} catch {
  fputs("error: \(error.localizedDescription)\n", stderr)
  exit(1)
}

if let data = try? JSONSerialization.data(withJSONObject: contacts),
   let json = String(data: data, encoding: .utf8) {
  print(json)
}