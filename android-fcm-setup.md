# Android FCM Setup

## 1. Add Firebase to Android Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or use existing
3. Add Android app with package name from `src-tauri/gen/android/app/build.gradle.kts`
4. Download `google-services.json`
5. Place it in `src-tauri/gen/android/app/`

## 2. Update Gradle Files

### Project-level build.gradle

In `src-tauri/gen/android/build.gradle.kts`, add:

```kotlin
buildscript {
    dependencies {
        classpath("com.google.gms:google-services:4.4.0")
    }
}
```

### App-level build.gradle

In `src-tauri/gen/android/app/build.gradle.kts`, add:

```kotlin
plugins {
    id("com.google.gms.google-services")
}

dependencies {
    implementation("com.google.firebase:firebase-messaging:23.4.0")
}
```

## 3. Create FCM Service

Create `src-tauri/gen/android/app/src/main/java/com/yourcompany/iris/FCMService.kt`:

```kotlin
package com.yourcompany.iris

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import android.webkit.WebView

class FCMService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM", "New token: $token")

        // Send token to WebView
        MainActivity.instance?.runOnUiThread {
            MainActivity.webView?.evaluateJavascript(
                "window.androidRegisterPushToken('$token')",
                null
            )
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d("FCM", "Message received: ${message.data}")

        // Handle the notification
        val title = message.notification?.title ?: message.data["title"] ?: "New Notification"
        val body = message.notification?.body ?: message.data["body"] ?: ""

        // Create and show notification
        showNotification(title, body, message.data)
    }

    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        // Implementation for showing notification
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object {
        private const val CHANNEL_ID = "iris_notifications"
    }
}
```

## 4. Update MainActivity

In `src-tauri/gen/android/app/src/main/java/com/yourcompany/iris/MainActivity.kt`:

```kotlin
class MainActivity : TauriActivity() {
    companion object {
        var instance: MainActivity? = null
        var webView: WebView? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this

        // Setup WebView JavaScript interface
        webView = findViewById<WebView>(R.id.tauri_webview)
        webView?.addJavascriptInterface(JSInterface(), "Android")

        // Request FCM token
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                Log.d("FCM", "Token: $token")
                webView?.evaluateJavascript(
                    "window.androidRegisterPushToken('$token')",
                    null
                )
            }
        }

        // Create notification channel
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "iris_notifications",
                "Iris Notifications",
                NotificationManager.IMPORTANCE_HIGH
            )
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    inner class JSInterface {
        @JavascriptInterface
        fun registerForPushNotifications() {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    webView?.evaluateJavascript(
                        "window.androidRegisterPushToken('$token')",
                        null
                    )
                }
            }
        }
    }
}
```

## 5. Update AndroidManifest.xml

In `src-tauri/gen/android/app/src/main/AndroidManifest.xml`, add:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<application>
    <!-- ... existing content ... -->

    <service
        android:name=".FCMService"
        android:exported="false">
        <intent-filter>
            <action android:name="com.google.firebase.MESSAGING_EVENT"/>
        </intent-filter>
    </service>

    <meta-data
        android:name="com.google.firebase.messaging.default_notification_icon"
        android:resource="@drawable/ic_notification" />
</application>
```

## 6. Configure FCM on Server

Add to your notification server's config:

```toml
fcm_service_account_key = '''
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk@your-project.iam.gserviceaccount.com",
  ...
}
'''
```

Get the service account key from:

1. Firebase Console → Project Settings
2. Service Accounts tab
3. Generate new private key

## Testing

1. Build the app: `npm run tauri android build`
2. Install on device
3. Check logcat for FCM token
4. Send test notification from Firebase Console or your server
