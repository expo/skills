import SwiftUI
import MyBrownfield

private struct FeatureRequest: Identifiable {
  let id = UUID().uuidString
  let userId: String
}

struct FeatureLauncher: View {
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
      ReactNativeView(
        moduleName: "main",
        initialProps: ["requestId": request.id, "userId": request.userId, "greeting": "Hello"]
      )
    }
  }

  private func openFeature(userId: String) {
    guard request == nil else { return }
    stopListening()
    let next = FeatureRequest(userId: userId)
    listenerId = BrownfieldMessaging.addListener { message in
      // Messaging callbacks are not a promise of execution on the UI thread.
      DispatchQueue.main.async {
        guard request?.id == next.id,
              message["requestId"] as? String == next.id,
              let type = message["type"] as? String else { return }
        switch type {
        case "feature.request-context":
          BrownfieldMessaging.sendMessage([
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
      BrownfieldMessaging.removeListener(id: listenerId)
      self.listenerId = nil
    }
  }
}
