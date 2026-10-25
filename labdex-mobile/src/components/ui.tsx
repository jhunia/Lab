import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { LucideIcon } from 'lucide-react-native'
import { font, useTheme } from '@/lib/theme'

export const tap = () => Haptics.selectionAsync().catch(() => {})

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme()
  return <Text style={[{ fontFamily: font.displaySemi, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: c.muted }, style]}>{children}</Text>
}

/** Mono section heading with a hairline rule, as on the desktop detail pane. */
export function SectionTitle({ children, danger }: { children: ReactNode; danger?: boolean }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Eyebrow style={danger ? { color: c.danger } : undefined}>{children}</Eyebrow>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.lineStrong }} />
    </View>
  )
}

type Variant = 'primary' | 'default' | 'ghost' | 'danger' | 'dangerGhost'

export function Button({
  label,
  icon: Icon,
  onPress,
  variant = 'default',
  disabled,
  style,
  small
}: {
  label?: string
  icon?: LucideIcon
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  small?: boolean
}) {
  const { c } = useTheme()
  const v = {
    primary: { bg: c.accent, fg: c.accentInk, border: c.accent },
    default: { bg: c.surface, fg: c.ink, border: c.lineStrong },
    ghost: { bg: 'transparent', fg: c.ink2, border: 'transparent' },
    danger: { bg: c.danger, fg: '#fff', border: c.danger },
    dangerGhost: { bg: 'transparent', fg: c.danger, border: c.danger }
  }[variant]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap()
        onPress()
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border, height: small ? 34 : 44, paddingHorizontal: label ? (small ? 12 : 16) : 0, width: label ? undefined : small ? 34 : 44 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.4 },
        style
      ]}
    >
      {Icon && <Icon size={small ? 15 : 17} color={v.fg} strokeWidth={2.1} />}
      {label && <Text style={{ fontFamily: font.bodySemi, fontSize: small ? 13.5 : 15, color: v.fg }}>{label}</Text>}
    </Pressable>
  )
}

export function Chip({ label, active, onPress, color, icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; icon?: ReactNode }) {
  const { c } = useTheme()
  const accent = color ?? c.accent
  return (
    <Pressable
      onPress={() => {
        tap()
        onPress?.()
      }}
      style={[
        styles.chip,
        { borderColor: active ? accent : c.lineStrong, backgroundColor: active ? `${accent}1F` : c.surface }
      ]}
    >
      {color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      {icon}
      <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: active ? c.ink : c.ink2 }}>{label}</Text>
    </Pressable>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; icon?: LucideIcon }[]; onChange: (v: T) => void }) {
  const { c } = useTheme()
  return (
    <View style={[styles.seg, { backgroundColor: c.surface3, borderColor: c.line }]}>
      {options.map((o) => {
        const on = o.v === value
        return (
          <Pressable
            key={o.v}
            onPress={() => {
              tap()
              onChange(o.v)
            }}
            style={[styles.segBtn, on && { backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}
          >
            {o.icon && <o.icon size={15} color={on ? c.ink : c.muted} />}
            <Text style={{ fontFamily: font.bodySemi, fontSize: 13.5, color: on ? c.ink : c.muted }}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function Field({ label, error, hint, right, children }: { label: string; error?: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={{ gap: 6, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.ink2 }}>{label}</Text>
        {right}
      </View>
      {children}
      {error ? (
        <Text style={{ fontFamily: font.bodyMedium, fontSize: 12.5, color: c.danger }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.muted }}>{hint}</Text>
      ) : null}
    </View>
  )
}

export function Input({ invalid, mono, large, style, ...props }: TextInputProps & { invalid?: boolean; mono?: boolean; large?: boolean }) {
  const { c } = useTheme()
  return (
    <TextInput
      placeholderTextColor={c.muted}
      selectionColor={c.accent}
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: c.surface,
          borderColor: invalid ? c.danger : c.lineStrong,
          color: c.ink,
          fontFamily: mono ? font.mono : large ? font.display : font.body,
          fontSize: large ? 19 : 15,
          minHeight: large ? 50 : 44
        },
        props.multiline && { paddingTop: 11, paddingBottom: 11, textAlignVertical: 'top' },
        style
      ]}
    />
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  return <View style={[{ backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, borderColor: c.lineStrong }, style]}>{children}</View>
}

export function StatusPill({ status }: { status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }) {
  const { c } = useTheme()
  const col = status === 'DRAFT' ? c.amber : status === 'PUBLISHED' ? c.accent : c.muted
  return (
    <View style={{ borderWidth: 1, borderColor: col, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
      <Text style={{ fontFamily: font.monoMedium, fontSize: 9.5, letterSpacing: 0.8, color: col, textTransform: 'uppercase' }}>{status.toLowerCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 5, borderWidth: 1.5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 3, borderWidth: 1 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 5, borderWidth: 1, gap: 2 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 34, borderRadius: 3 },
  input: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 12 }
})
