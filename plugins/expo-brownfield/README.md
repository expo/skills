# Expo Brownfield Plugin

Integrate Expo and React Native into existing native Android and iOS applications using Expo's isolated or integrated approach.

## Skills Included

- **brownfield-isolated**: Add React Native to an existing native app by packaging it as a standalone native library (AAR for Android, XCFramework for iOS). Native developers consume it like any other dependency — no Node.js or React Native tooling required.

- **brownfield-integrated**: Add React Native to an existing native app by integrating it directly into the native build system (Gradle for Android, CocoaPods for iOS), similar to any other third-party library.

## When to Use Each Approach

|                                   | Isolated | Integrated |
| --------------------------------- | -------- | ---------- |
| Native developers need RN tooling | No       | Yes        |
| Build process impact              | Minimal  | Moderate   |
| Separate RN team                  | Ideal    | Works      |
| Single shared native project      | No       | Yes        |
| Pre-built artifact distribution   | Yes      | No         |

## License

MIT
