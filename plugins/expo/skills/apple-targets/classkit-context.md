---
title: ClassKit Context Provider Extension
description: Provides your educational app's activity hierarchy to Apple's Schoolwork app so teachers can assign activities and track student progress.
version: iOS 12.2+
---

# ClassKit Context Provider Extension (`classkit-context`)

A ClassKit Context Provider extension tells the Schoolwork app about the educational activities inside your app without requiring your app to be launched. Teachers browse your activity tree in Schoolwork, assign specific activities to students, and then students open your app to complete them. Progress (time spent, scores, completion) is automatically reported back through ClassKit's `CLSDataStore`. This extension is used exclusively in Apple's K-12 education ecosystem.

## Apple Documentation

- [ClassKit Framework Overview](https://developer.apple.com/documentation/classkit)
- [CLSContextProvider Protocol](https://developer.apple.com/documentation/classkit/clscontextprovider)
- [CLSContext](https://developer.apple.com/documentation/classkit/clscontext)
- [CLSDataStore](https://developer.apple.com/documentation/classkit/clsdatastore)
- [ClassKit Environment Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.classkit-environment)
- [About ClassKit and User Roles](https://developer.apple.com/documentation/classkit/enabling_classkit_in_your_app/about_classkit_and_user_roles)

## WWDC History

- **[WWDC 2018, Session 215 -- Introducing ClassKit](https://developer.apple.com/videos/play/wwdc2018/215/)** -- ClassKit framework introduced with iOS 11.4. Covered `CLSContext` trees, `CLSActivity`, and `CLSDataStore` for reporting student progress. The Context Provider extension did not exist yet -- apps had to be launched to declare their context trees.
- **[WWDC 2019, Session 247 -- What's New in ClassKit](https://developer.apple.com/videos/play/wwdc2019/247/)** -- Introduced the **ClassKit Context Provider extension** (iOS 12.2). This session walked through creating the extension target in Xcode, implementing `updateDescendants(of:completion:)`, and marking activities as complete.
- **[WWDC 2020, Session 10672 -- What's New in ClassKit](https://developer.apple.com/videos/play/wwdc2020/10672/)** -- Added `identifierPath` read-only property, new context types (`course`, `custom`), and the ability to mark contexts as non-assignable.
- **[WWDC 2021, Session 10257 -- Meet ClassKit for File-Based Apps](https://developer.apple.com/videos/play/wwdc2021/10257/)** -- Extended ClassKit to document-based apps (Pages, Keynote, etc.) with file-based progress reporting. Also covered testing in developer mode.

## What It Does

1. **Teacher opens Schoolwork.** Schoolwork queries installed educational apps for their activity hierarchy.
2. **System loads your extension.** The system calls `updateDescendants(of:completion:)` on your `CLSContextProvider` subclass, passing in a `CLSContext`. The first call passes the root (main app) context, which has no parent.
3. **Extension populates children.** Your extension creates or updates `CLSContext` objects representing content tiers (courses, chapters, quizzes, etc.) and adds them as descendants of the passed-in context.
4. **Teacher assigns an activity.** In Schoolwork, the teacher selects one of your contexts and assigns it to students as a "handout."
5. **Student launches your app.** When the student taps the assignment, your app opens via a deep link. Your app navigates to the matching `CLSContext` using its identifier path.
6. **App reports progress.** As the student works, your app creates a `CLSActivity`, starts it, adds `CLSProgressReportItem` or `CLSScoreItem` objects, stops the activity, and saves via `CLSDataStore.shared.save()`.
7. **Teacher sees results.** Schoolwork aggregates progress data across students and displays completion status, time spent, and scores.

## Use Cases

### K-12 Math and Reading Apps
A math practice app exposes a hierarchy like "Grade 5 > Fractions > Adding Fractions > Quiz 1". Teachers assign specific quizzes, and Schoolwork shows each student's score and time spent.

### Language Learning Apps
A language app publishes lessons organized by level and topic ("Spanish > Beginner > Greetings > Lesson 3"). Teachers can assign specific lessons to different groups of students and track who has completed them.

### Science and STEM Interactive Labs
A virtual lab app exposes experiments as assignable contexts. Students complete the lab, and the app reports results (pass/fail, completion percentage) back to Schoolwork.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `CLSContextProvider` | Conform to this protocol (via `NSObject` subclass) in your extension. Override `updateDescendants(of:completion:)` to populate the context tree. |
| `CLSContext` | Represents a single node in your content hierarchy (a course, chapter, quiz, etc.). Has a `title`, `type`, `identifier`, and optional `topic`. |
| `CLSDataStore` | Singleton that manages saving and fetching contexts and activities. Use `CLSDataStore.shared` in both your app and extension. |
| `CLSActivity` | Represents a student's engagement with a context. Start/stop it to track duration. Attach progress or score items. |
| `CLSProgressReportItem` | Reports a 0.0-1.0 progress value for a context. |
| `CLSScoreItem` | Reports a numeric score (e.g., 8 out of 10) for a context. |
| `CLSBinaryItem` | Reports a true/false outcome (e.g., pass/fail). |

## Implementation

```swift
import ClassKit

// 1. Conform to CLSContextProvider. This is the only class in the extension.
class ContextProvider: NSObject, CLSContextProvider {

    // 2. Called by the system when Schoolwork needs your content tree.
    //    `context` is the parent whose children you should populate.
    func updateDescendants(
        of context: CLSContext,
        completion: @escaping (Error?) -> Void
    ) {
        // 3. Check if this is the root (main app) context.
        //    The root context has no parent.
        if context.parent == nil {
            populateTopLevel(context: context, completion: completion)
        } else {
            populateChildren(of: context, completion: completion)
        }
    }

    private func populateTopLevel(
        context: CLSContext,
        completion: @escaping (Error?) -> Void
    ) {
        let dataStore = CLSDataStore.shared

        // 4. Create top-level course contexts.
        let courses = [
            ("algebra", "Algebra", CLSContextTopic.math),
            ("geometry", "Geometry", CLSContextTopic.math),
            ("reading", "Reading Comprehension", CLSContextTopic.literacyAndWriting),
        ]

        for (id, title, topic) in courses {
            // 5. Check if the context already exists to avoid duplicates.
            dataStore.mainAppContext.descendant(
                matchingIdentifierPath: [id]
            ) { existingContext in
                if let existing = existingContext {
                    existing.title = title
                    existing.topic = topic
                } else {
                    // 6. Create a new child context.
                    let child = CLSContext(
                        type: .course,
                        identifier: id,
                        title: title
                    )
                    child.topic = topic
                    context.addChildContext(child)
                }
            }
        }

        // 7. Save and signal completion.
        dataStore.save { error in
            completion(error)
        }
    }

    private func populateChildren(
        of context: CLSContext,
        completion: @escaping (Error?) -> Void
    ) {
        let dataStore = CLSDataStore.shared

        // 8. Build children based on parent identifier.
        //    In a real app, fetch this structure from your content database.
        let lessons: [(String, String)] = {
            switch context.identifier {
            case "algebra":
                return [
                    ("linear-equations", "Linear Equations"),
                    ("quadratics", "Quadratic Equations"),
                ]
            case "geometry":
                return [
                    ("triangles", "Triangles"),
                    ("circles", "Circles"),
                ]
            default:
                return []
            }
        }()

        for (id, title) in lessons {
            // 9. Create assignable activity contexts.
            let child = CLSContext(
                type: .exercise,
                identifier: id,
                title: title
            )
            // 10. Mark as assignable so teachers can hand it out.
            child.isAssignable = true
            context.addChildContext(child)
        }

        dataStore.save { error in
            completion(error)
        }
    }
}
```

## Usage

- Create: `bun create target classkit-context`
- Edit: `targets/classkit-context/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 12.2+ | Context Provider extension introduced in 12.2. ClassKit framework available since 11.4. |
| iPadOS | 12.2+ | Primary platform for Schoolwork. iPad is the dominant device in K-12 Apple deployments. |
| macOS | 11.0+ | ClassKit available via Catalyst. Schoolwork for Mac introduced with macOS 11. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |
| visionOS | -- | Not supported. |

## Gotchas

- **ClassKit entitlement is required.** You must enable the ClassKit capability in Xcode, which adds the `com.apple.developer.ClassKit-environment` entitlement. Set it to `development` for testing and `production` for App Store builds. Without this entitlement, the extension will not load.
- **Testing requires Schoolwork in developer mode.** You need a managed Apple ID (Apple School Manager) and the Schoolwork app to test the full flow. For local development, set the entitlement value to `development` and use `CLSDataStore.shared.completeAllAssignedActivities(matching:)` to simulate completion.
- **The extension only provides the tree structure, not progress.** The context provider extension populates the hierarchy of assignable content. Actual progress reporting (`CLSActivity`, `CLSScoreItem`, etc.) must happen from your main app when the student interacts with the content.
- **`updateDescendants` may be called multiple times.** The system calls your extension whenever Schoolwork needs fresh data. Do not assume it is called only once. Guard against creating duplicate contexts by checking for existing descendants before adding new ones.
- **Context identifiers must be stable.** The `identifier` you give each `CLSContext` is used to match assignments to content. If you change identifiers between app updates, existing assignments will break and teachers will see errors in Schoolwork.
- **Schoolwork adoption is limited to managed education environments.** ClassKit only works with Apple School Manager-managed devices. Consumer users will never see your ClassKit integration. This limits the audience to institutional K-12 deployments.
- **The root context is created automatically.** You do not create the main app context yourself. It is provided by the system as the parentless `CLSContext` passed to `updateDescendants`. Attempting to create a root context manually will cause errors.
- **Context types affect Schoolwork UI.** Use appropriate `CLSContextType` values (`.course`, `.chapter`, `.exercise`, `.quiz`, etc.) because Schoolwork uses these to display different icons and group activities logically for teachers.
