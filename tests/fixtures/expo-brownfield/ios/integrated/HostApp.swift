import UIKit
internal import Expo
import React
import ReactAppDependencyProvider
import SwiftUI
internal import ExpoBrownfield
@MainActor
final class ReactNativeRuntime {
  private let delegate: ReactNativeDelegate
  let factory: ExpoReactNativeFactory
  let launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  init(launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) {
    self.launchOptions = launchOptions
    let delegate = ReactNativeDelegate()
    delegate.dependencyProvider = RCTAppDependencyProvider()
    self.delegate = delegate
    self.factory = ExpoReactNativeFactory(delegate: delegate)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}


final class ReactNativeScreenViewController: UIViewController {
  private let runtime: ReactNativeRuntime
  private let initialProps: [AnyHashable: Any]?

  init(runtime: ReactNativeRuntime, initialProps: [AnyHashable: Any]? = nil) {
    self.runtime = runtime
    self.initialProps = initialProps
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("Use init(runtime:initialProps:)")
  }

  override func loadView() {
    view = runtime.factory.rootViewFactory.view(
      withModuleName: "main",
      initialProperties: initialProps,
      launchOptions: runtime.launchOptions
    )
  }
}


private struct FeatureRequest: Identifiable {
  let id = UUID().uuidString
  let userId: String
}

struct FeatureLauncher: View {
  let runtime: ReactNativeRuntime
  @State private var request: FeatureRequest?
  @State private var listenerId: String?
  @State private var selectedId: String?
  @State private var completions = 0
  @State private var presentations = 0

  var body: some View {
    VStack {
      Text(selectedId ?? "No selection")
      Text("Completed: \(completions)")
      Text("Presented: \(presentations)")
      Button("Open feature") { openFeature(userId: presentations == 0 ? "123" : "456") }
    }
    .sheet(item: $request, onDismiss: stopListening) { request in
      IntegratedReactView(
        runtime: runtime,
        initialProps: ["requestId": request.id, "userId": request.userId, "greeting": "Hello"]
      )
    }
  }

  private func openFeature(userId: String) {
    guard request == nil else { return }
    stopListening()
    let next = FeatureRequest(userId: userId)
    listenerId = BrownfieldMessagingInternal.shared.addListener { message in
      // Messaging callbacks are not a promise of execution on the UI thread.
      DispatchQueue.main.async {
        guard request?.id == next.id,
              message["requestId"] as? String == next.id,
              let type = message["type"] as? String else { return }
        switch type {
        case "feature.request-context":
          BrownfieldMessagingInternal.shared.sendMessage([
            "type": "feature.context", "requestId": next.id, "greeting": "Updated hello"
          ])
        case "feature.completed":
          guard let value = message["selectedId"] as? String else { return }
          selectedId = value
          completions += 1
          closeFeature()
        case "feature.cancelled":
          closeFeature()
        default:
          break
        }
      }
    }
    presentations += 1
    request = next
  }

  private func closeFeature() {
    stopListening()
    request = nil
  }

  private func stopListening() {
    if let listenerId {
      BrownfieldMessagingInternal.shared.removeListener(id: listenerId)
      self.listenerId = nil
    }
  }
}


struct IntegratedReactView: UIViewControllerRepresentable {
  let runtime: ReactNativeRuntime
  let initialProps: [AnyHashable: Any]
  func makeUIViewController(context: Context) -> ReactNativeScreenViewController {
    ReactNativeScreenViewController(runtime: runtime, initialProps: initialProps)
  }
  func updateUIViewController(_ controller: ReactNativeScreenViewController, context: Context) {}
}


@main
struct HostApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

  var body: some Scene {
    WindowGroup {
      NavigationView {
        VStack(spacing: 24) {
          Text("Native SwiftUI host")
          NavigationLink("Open native details") { Text("Original native screen works") }
          FeatureLauncher(runtime: appDelegate.runtime)
        }
        .navigationTitle("Brownfield Validation")
      }
    }
  }
}


class AppDelegate: ExpoAppDelegate {
  let runtime = ReactNativeRuntime()
  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
#if DEBUG
    let port = Bundle.main.object(forInfoDictionaryKey: "BrownfieldMetroPort") as? String ?? "8097"
    RCTBundleURLProvider.sharedSettings().jsLocation = "localhost:\(port)"
#endif
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
