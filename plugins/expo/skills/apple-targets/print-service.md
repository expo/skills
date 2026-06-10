---
title: Print Service Discovery Extension
description: Discovers and configures custom printers that are not supported by AirPrint or standard IPP discovery, primarily used by printer manufacturers.
version: iOS 14.0+
---

# Print Service Discovery Extension (`print-service`)

A Print Service extension locates and sets up printers that cannot be discovered through standard AirPrint or Bonjour/DNS-SD mechanisms. When the user opens the system print dialog, iOS loads installed Print Service extensions to find additional printers beyond those visible via AirPrint. This is an extremely niche extension type used almost exclusively by printer manufacturers who need to support proprietary discovery protocols (e.g., vendor-specific Wi-Fi Direct, Bluetooth, or USB handshakes). Public documentation from Apple is minimal.

## Apple Documentation

- [UIPrintServiceExtension](https://developer.apple.com/documentation/uikit/uiprintserviceextension) -- The principal class your extension subclasses. Apple's documentation is a single page with no discussion or sample code.
- [UIPrinter](https://developer.apple.com/documentation/uikit/uiprinter) -- Represents a printer discovered by your extension.
- [UIPrintInteractionController](https://developer.apple.com/documentation/uikit/uiprintinteractioncontroller) -- The system print UI that triggers printer discovery.
- [Printing (UIKit)](https://developer.apple.com/documentation/uikit/printing) -- Overview of the iOS printing architecture.
- [AirPrint Overview](https://developer.apple.com/airprint/) -- AirPrint is the standard path; this extension exists for printers that cannot use it.
- [Bonjour Printing Specification](https://developer.apple.com/bonjour/printing-specification/) -- The standard discovery protocol that this extension type bypasses.

## WWDC History

There are no dedicated WWDC sessions covering the Print Service extension type. It was introduced quietly alongside other app extension points and has received no public stage time.

- **[WWDC 2016, Session 725 -- Deploying AirPrint in Enterprise](https://developer.apple.com/videos/play/wwdc2016/725/)** -- Covered AirPrint deployment and Bonjour-based discovery in enterprise networks. Did not mention `UIPrintServiceExtension` but provides essential context for understanding the printer discovery landscape.

## What It Does

1. **User taps Print.** An app presents `UIPrintInteractionController`, which triggers the system print UI.
2. **System discovers printers.** iOS runs AirPrint/Bonjour discovery by default. Simultaneously, it loads any installed Print Service extensions.
3. **Extension discovers custom printers.** Your `UIPrintServiceExtension` subclass runs its proprietary discovery logic (e.g., scanning for Bluetooth devices, querying a vendor-specific network protocol, or connecting via USB accessory).
4. **Printers appear in the picker.** Printers found by your extension appear alongside AirPrint printers in the system printer list.
5. **User selects your printer.** The system routes the print job through your extension, which handles communication with the physical printer.

**Note:** The internal mechanics of how print data flows through the extension are not publicly documented. The `UIPrintServiceExtension` class itself exposes no override points in the public headers -- it inherits from `NSObject` and acts as a container for your discovery and communication logic.

## Use Cases

### Printer Manufacturer Apps
HP, Canon, Epson, Brother, and other printer manufacturers build Print Service extensions into their companion iOS apps. When a user installs "HP Smart" or "Canon PRINT," the extension enables the system print dialog to find printers that use vendor-specific protocols beyond standard AirPrint.

### Legacy Enterprise Printers
Organizations with older network printers that do not support AirPrint or IPP Everywhere can build a custom Print Service extension that discovers these printers via their proprietary protocol (e.g., legacy LPR, vendor APIs, or SNMP-based discovery).

### Specialty / Industrial Printers
Label printers (Zebra, DYMO), receipt printers (Star Micronics), and other specialty hardware often use Bluetooth or vendor USB protocols. A Print Service extension can make them appear in the standard iOS print dialog rather than requiring a dedicated printing app.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `UIPrintServiceExtension` | Subclass this as your extension's principal class. The base class provides the extension lifecycle. Discovery and printer setup logic is your responsibility. |
| `UIPrinter` | Represents a discovered printer. Create instances with a `URL` and `displayName`. |
| `UIPrintInteractionController` | System print UI that triggers extension loading. Not used inside the extension itself. |
| `UIPrintInfo` | Describes the print job settings (output type, orientation, duplex). |

## Implementation

**Important:** Apple provides almost no public documentation on the internal API of `UIPrintServiceExtension`. The class has no documented override points beyond the standard `NSObject` lifecycle. The implementation below reflects the minimal template pattern, annotated with what is known.

```swift
import UIKit

// 1. Subclass UIPrintServiceExtension.
//    This is the extension's principal class, declared in Info.plist.
class PrintServiceExtension: UIPrintServiceExtension {

    // 2. There are no documented override points on UIPrintServiceExtension.
    //    The extension lifecycle and printer discovery protocol are not
    //    publicly documented by Apple.
    //
    //    Printer manufacturers receive documentation under NDA through
    //    the MFi (Made for iPhone) program or direct partnership with
    //    Apple's AirPrint team (airprint@apple.com).
    //
    // 3. In practice, manufacturer implementations use private or
    //    semi-private APIs provided through partnership agreements.
    //    The discovery logic typically involves:
    //    - Scanning for Bluetooth LE peripherals (CoreBluetooth)
    //    - Querying vendor-specific mDNS service types
    //    - Communicating over vendor USB accessory protocols
    //
    // 4. If you are a printer manufacturer, contact airprint@apple.com
    //    to license AirPrint technology and receive the implementation
    //    documentation for UIPrintServiceExtension.
}
```

### What a Real Implementation Might Look Like (Conceptual)

While the actual API is under NDA, the general pattern used by printer manufacturer extensions involves:

```swift
import UIKit
import CoreBluetooth

// Conceptual only -- actual API details require Apple partnership.
class PrintServiceExtension: UIPrintServiceExtension {

    // 1. The system triggers printer discovery when the print dialog opens.
    //    Your extension scans for printers using your vendor's protocol.
    func discoverPrinters() {
        // 2. Scan for Bluetooth LE peripherals matching your printer's
        //    service UUID, or probe a proprietary network protocol.

        // 3. For each discovered printer, create a UIPrinter and report
        //    it to the system so it appears in the printer picker.
    }

    // 4. When the user selects your printer, the system asks your extension
    //    to handle the print job data and send it to the hardware.
    func handlePrintJob(data: Data, printer: UIPrinter) {
        // 5. Convert the print data to your printer's native format
        //    and transmit it over Bluetooth, USB, or network.
    }
}
```

## Usage

- Create: `bun create target print-service`
- Edit: `targets/print-service/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 14.0+ | Primary platform. Extensions appear in the system print dialog. |
| iPadOS | 14.0+ | Same as iOS. |
| macOS | -- | macOS uses CUPS drivers and Print Dialog Extensions (PDEs) instead, not `UIPrintServiceExtension`. |
| watchOS | -- | Not supported. No printing on watchOS. |
| tvOS | -- | Not supported. No printing on tvOS. |
| visionOS | -- | Not confirmed. Printing support on visionOS is limited. |

## Gotchas

- **Documentation is essentially nonexistent.** Apple's public documentation for `UIPrintServiceExtension` consists of a single page with a one-sentence description and no sample code. The full implementation details are available only to printer manufacturers under NDA or MFi partnership. If you are not a printer hardware vendor, this extension type is likely not what you need.
- **Contact Apple directly for implementation guidance.** Apple directs printer manufacturers to email `airprint@apple.com` to license AirPrint technology and receive the private API documentation needed to build a functional Print Service extension.
- **AirPrint is the preferred path.** Apple strongly encourages all printers to support AirPrint (IPP + Bonjour). The Print Service extension exists as a fallback for hardware that cannot implement the standard protocol. If your printer can speak IPP, use AirPrint instead.
- **No Simulator support.** Print Service extensions require real hardware (both the iOS device and the printer) for testing. The iOS Simulator does not load print service extensions.
- **The extension runs in a sandboxed process.** Like all app extensions, it has limited memory and no access to the main app's data unless you use App Groups.
- **Bluetooth requires background modes and permissions.** If your discovery logic uses CoreBluetooth, you need the `bluetooth-central` background mode and `NSBluetoothAlwaysUsageDescription` in your extension's Info.plist.
- **MFi program may be required.** If your printer uses a Lightning or USB accessory protocol, you likely need MFi certification, which involves a separate Apple partnership process.
