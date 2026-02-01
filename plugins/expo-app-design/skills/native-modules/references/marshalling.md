# Marshalling Complex Types in Expo Modules

Using `@retroactive Convertible` and `AnyArgument` to convert between Swift types and dictionaries enables passing complex data structures across the JS-native boundary without writing custom serialization code for each type.

Reference implementation: https://github.com/EvanBacon/expo-shared-objects-haptics-example/blob/be90e92f8dba9b0807009502ab25c423c57e640d/modules/my-module/ios/MyModule.swift#L1C1-L178C2

## Pattern

Extend native types with `@retroactive Convertible, AnyArgument` and implement `convert(from:appContext:)`:

```swift
extension CHHapticEventParameter: @retroactive Convertible, AnyArgument {
    public static func convert(from value: Any?, appContext: AppContext) throws -> Self {
        guard let dict = value as? [String: Any],
              let parameterIDRaw = dict["parameterID"] as? String,
              let value = dict["value"] as? Double else {
            throw NotADictionaryException()
        }
        return Self(parameterID: CHHapticEvent.ParameterID(rawValue: parameterIDRaw), value: Float(value))
    }
}

extension CHHapticEvent: @retroactive Convertible, AnyArgument {
    public static func convert(from value: Any?, appContext: AppContext) throws -> Self {
        guard let dict = value as? [String: Any],
              let eventTypeRaw = dict["eventType"] as? String,
              let relativeTime = dict["relativeTime"] as? Double else {
            throw NotADictionaryException()
        }
        let eventType = CHHapticEvent.EventType(rawValue: eventTypeRaw)
        let parameters = (dict["parameters"] as? [[String: Any]])?.compactMap { paramDict -> CHHapticEventParameter? in
            try? CHHapticEventParameter.convert(from: paramDict, appContext: appContext)
        } ?? []
        return Self(eventType: eventType, parameters: parameters, relativeTime: relativeTime)
    }
}

extension CHHapticDynamicParameter: @retroactive Convertible, AnyArgument {
    public static func convert(from value: Any?, appContext: AppContext) throws -> Self {
        guard let dict = value as? [String: Any],
              let parameterIDRaw = dict["parameterID"] as? String,
              let value = dict["value"] as? Double,
              let relativeTime = dict["relativeTime"] as? Double else {
            throw NotADictionaryException()
        }

        return Self(parameterID: CHHapticDynamicParameter.ID(rawValue: parameterIDRaw), value: Float(value), relativeTime: relativeTime)
    }
}

extension CHHapticPattern: @retroactive Convertible, AnyArgument {
    public static func convert(from value: Any?, appContext: AppContext) throws -> Self {
        guard let dict = value as? [String: Any],
              let eventsArray = dict["events"] as? [[String: Any]] else {
            throw NotADictionaryException()
        }
        let events = try eventsArray.map { eventDict -> CHHapticEvent in
            try CHHapticEvent.convert(from: eventDict, appContext: appContext)
        }
        let parameters = (dict["parameters"] as? [[String: Any]])?.compactMap { paramDict -> CHHapticDynamicParameter? in
            return try? CHHapticDynamicParameter.convert(from: paramDict, appContext: appContext)
        } ?? []
        return try Self(events: events, parameters: parameters)
    }
}
```

## Exception Types

```swift
internal final class NotAnArrayException: Exception {
    override var reason: String {
        "Given value is not an array"
    }
}

internal final class IncorrectArraySizeException: GenericException<(expected: Int, actual: Int)> {
    override var reason: String {
        "Given array has unexpected number of elements: \(param.actual), expected: \(param.expected)"
    }
}

internal final class NotADictionaryException: Exception {
    override var reason: String {
        "Given value is not a dictionary"
    }
}
```

## Usage

Once types conform to `Convertible`, they can be used directly as function parameters:

```swift
Function("playPattern") { (pattern: CHHapticPattern) in
    let player = try hapticEngine.makePlayer(with: pattern)
    try player.start(atTime: 0)
}
```

## Shorthand Tips

Use shorthand where possible, especially when the JS value matches the Swift value:

```swift
Property("__typename") { $0.__typename }
```
