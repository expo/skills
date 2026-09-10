import SwiftUI

@main
struct HostApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

  var body: some Scene {
    WindowGroup {
      NavigationView {
        VStack(spacing: 24) {
          Text("Native SwiftUI host")
          NavigationLink("Open native details") { Text("Original native screen works") }
          FeatureLauncher()
        }
        .navigationTitle("Brownfield Validation")
      }
    }
  }
}
