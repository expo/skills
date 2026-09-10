import UIKit
import MyBrownfield // The configured framework target, not the Swift Package name

// Merge into the existing delegate. Keep its existing @main only for a UIKit entry point.
class AppDelegate: ExpoBrownfieldAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
#if DEBUG
    let port = Bundle.main.object(forInfoDictionaryKey: "BrownfieldMetroPort") as? String ?? "8097"
    UserDefaults.standard.set("localhost:\(port)", forKey: "RCT_jsLocation")
#endif
    ReactNativeHostManager.shared.initialize()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
