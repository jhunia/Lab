// React Native Web's Alert.alert ignores buttons, so confirmations ("Delete?", "Open Staff") do nothing in a
// browser. On web, route them through the browser's own alert/confirm dialogs instead.
import { Alert, Platform, type AlertButton } from 'react-native'

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n')
    const cancel = buttons?.find((b) => b.style === 'cancel')
    const actions = (buttons ?? []).filter((b) => b !== cancel)
    if (actions.length === 0 || (actions.length === 1 && !cancel)) {
      window.alert(text)
      ;(actions[0] ?? cancel)?.onPress?.()
      return
    }
    // The last action is the main one in every LabDex dialog ("Delete", "Open Staff", "Publish").
    const main = actions[actions.length - 1]
    if (window.confirm(`${text}\n\nOK = ${main.text ?? 'Continue'}`)) main.onPress?.()
    else cancel?.onPress?.()
  }
}
