# Push Notifications Setup for Tauri Mobile

## Overview

This setup enables native push notifications for the Iris client on iOS (APNs) and Android (FCM).

## Architecture

```
Mobile App → Gets Device Token → Sends to Notification Server
                                           ↓
                                   Stores token with subscription
                                           ↓
When Event Matches Filter → Server sends via FCM/APNs → Device receives notification
```

## What's Been Added

### 1. Backend (nostr-notification-server)

- ✅ FCM support for Android push notifications
- ✅ APNs support for iOS push notifications
- ✅ Token management and automatic cleanup
- ✅ Configurable endpoints for testing
- ✅ Tests for push notification services

### 2. Tauri App

- ✅ Notification plugin added to Cargo.toml
- ✅ Push token registration command in lib.rs
- ✅ Push notification service (utils/pushNotifications.ts)
- ✅ Integration with IrisAPI for token registration
- ✅ Initialization in main.tsx

### 3. Platform Configurations

- 📱 iOS setup guide (ios-push-setup.md)
- 🤖 Android setup guide (android-fcm-setup.md)

## Quick Start

### 1. Configure the Notification Server

Add to your server's config:

```toml
# For iOS
apns_key_id = "YOUR_KEY_ID"
apns_team_id = "YOUR_TEAM_ID"
apns_auth_key = "-----BEGIN PRIVATE KEY-----..."
apns_topic = "com.yourcompany.iris"
apns_environment = "production"

# For Android
fcm_service_account_key = '''
{
  "type": "service_account",
  "project_id": "your-project",
  ...
}
'''
```

### 2. Build for Mobile

```bash
# iOS
npm run tauri ios build

# Android
npm run tauri android build
```

### 3. Platform-Specific Setup

#### iOS

1. Open Xcode project in `src-tauri/gen/apple/`
2. Add Push Notifications capability
3. Follow instructions in `ios-push-setup.md`

#### Android

1. Add Firebase to your project
2. Place `google-services.json` in `src-tauri/gen/android/app/`
3. Follow instructions in `android-fcm-setup.md`

## How It Works

1. **Token Registration**: When the app starts, it requests push permission and gets a device token
2. **Server Registration**: The token is sent to your notification server along with the user's subscription filter
3. **Event Matching**: When a Nostr event matches the filter, the server sends a push notification
4. **Delivery**: The notification is delivered via FCM (Android) or APNs (iOS)
5. **User Interaction**: Tapping the notification opens the app to the relevant content

## Testing

### Send Test Notification

```bash
# Test FCM (Android)
curl -X POST https://your-server.com/api/test-notification \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"token": "FCM_DEVICE_TOKEN", "type": "fcm"}'

# Test APNs (iOS)
curl -X POST https://your-server.com/api/test-notification \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"token": "APNS_DEVICE_TOKEN", "type": "apns"}'
```

### Debug Tips

1. **Check token registration**: Look for "Received push token" in console logs
2. **Verify server connection**: Check network tab for subscription API calls
3. **Test with Firebase Console**: For Android, use Firebase Console to send test notifications
4. **Check certificates**: For iOS, ensure APNs certificates are valid

## Security Notes

- Device tokens are unique per app installation
- Tokens can change - the app handles re-registration
- Invalid tokens are automatically removed from subscriptions
- All push payloads should be encrypted if containing sensitive data

## Troubleshooting

### iOS Issues

- **No token received**: Check Push Notifications capability is enabled
- **Not receiving notifications**: Verify APNs certificates and environment (sandbox vs production)
- **Token invalid**: Ensure using correct bundle ID and certificates

### Android Issues

- **No FCM token**: Check google-services.json is in correct location
- **Notifications not showing**: Verify notification channel is created
- **Token registration fails**: Check Firebase project configuration

## Next Steps

1. Implement notification encryption for sensitive content
2. Add notification categories and actions
3. Implement silent notifications for background updates
4. Add notification grouping and management
5. Implement notification statistics and delivery tracking
