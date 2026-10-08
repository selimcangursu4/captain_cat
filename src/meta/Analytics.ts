export class Analytics {
  static logEvent(eventName: string, params?: Record<string, any>) {
    console.log(`[Analytics] Event: ${eventName}`, params);
    // TODO: Connect to Firebase Analytics / RevenueCat Analytics
  }
}
