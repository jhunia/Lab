// The one-time "How LabDex works" walkthrough opens by itself on first launch; this remembers it was seen.
import AsyncStorage from '@react-native-async-storage/async-storage'

export const WELCOME_KEY = 'labdex.welcomed.v1'

export const hasSeenWelcome = () => AsyncStorage.getItem(WELCOME_KEY).then((v) => v === '1').catch(() => true)

export const markWelcomed = () => AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {})
