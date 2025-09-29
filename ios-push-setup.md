# iOS Push Notification Setup

## 1. Enable Push Notifications Capability

In Xcode:
1. Open `src-tauri/gen/apple/iris.xcodeproj`
2. Select your app target
3. Go to "Signing & Capabilities"
4. Click "+ Capability"
5. Add "Push Notifications"

## 2. Add Native Swift Code

Create a new file `src-tauri/gen/apple/Sources/PushNotificationHandler.swift`:

```swift
import UIKit
import UserNotifications
import WebKit

class PushNotificationHandler: NSObject {
    static let shared = PushNotificationHandler()
    var webView: WKWebView?

    func registerForPushNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    func handleRegistration(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("Device Token: \(token)")

        // Send token to JavaScript
        if let webView = self.webView {
            let js = "window.iosRegisterPushToken('\(token)')"
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    func handleRegistrationError(_ error: Error) {
        print("Failed to register for push: \(error)")
    }
}
```

## 3. Update AppDelegate

In `src-tauri/gen/apple/Sources/AppDelegate.swift`, add:

```swift
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // ... existing code ...

    // Register for push notifications
    PushNotificationHandler.shared.registerForPushNotifications()

    return true
}

func application(_ application: UIApplication,
                didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    PushNotificationHandler.shared.handleRegistration(deviceToken: deviceToken)
}

func application(_ application: UIApplication,
                didFailToRegisterForRemoteNotificationsWithError error: Error) {
    PushNotificationHandler.shared.handleRegistrationError(error)
}

func application(_ application: UIApplication,
                didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // Handle push notification
    print("Received push notification: \(userInfo)")

    // Process the notification
    if let aps = userInfo["aps"] as? [String: Any] {
        // Handle the notification content
    }

    completionHandler(.newData)
}
```

## 4. Configure APNs

1. In Apple Developer Portal:
   - Create an APNs Auth Key (if not already done)
   - Download the .p8 file
   - Note the Key ID and Team ID

2. Add to your notification server's config:
```toml
apns_key_id = "YOUR_KEY_ID"
apns_team_id = "YOUR_TEAM_ID"
apns_auth_key = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
apns_topic = "com.yourcompany.iris" # Your bundle ID
apns_environment = "production" # or "sandbox" for development
```

## 5. Info.plist

Add to `src-tauri/gen/apple/iris_iOS/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

## Testing

1. Build the app for a physical device (push doesn't work on simulator)
2. Run the app and accept notification permissions
3. Check Xcode console for the device token
4. Send a test notification using your server