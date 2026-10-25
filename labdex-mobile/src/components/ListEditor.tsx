import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Plus, X } from 'lucide-react-native'
import { font, useTheme } from '@/lib/theme'
import { Input, tap } from './ui'

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
  /** Chips render inline (synonyms); rows render as a numbered list (suggestions). */
  variant?: 'chips' | 'rows'
  quickAdd?: string[]
}

export function ListEditor({ value, onChange, placeholder, variant = 'rows', quickAdd }: Props) {
  const { c } = useTheme()
  const [draft, setDraft] = useState('')

  const add = (v: string) => {
    const t = v.trim().replace(/,$/, '')
    if (!t || value.some((x) => x.toLowerCase() === t.toLowerCase())) return setDraft('')
    tap()
    onChange([...value, t])
    setDraft('')
  }
  const remove = (i: number) => {
    tap()
    onChange(value.filter((_, j) => j !== i))
  }

  const suggestions = quickAdd?.filter((q) => !value.includes(q))

  return (
    <View style={{ gap: 8 }}>
      {variant === 'chips' ? (
        value.length > 0 && (
          <View style={styles.chips}>
            {value.map((v, i) => (
              <Pressable key={v} onPress={() => remove(i)} style={[styles.chip, { backgroundColor: c.surface3, borderColor: c.line }]} accessibilityLabel={`Remove ${v}`}>
                <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.ink }}>{v}</Text>
                <X size={12} color={c.muted} />
              </Pressable>
            ))}
          </View>
        )
      ) : (
        value.length > 0 && (
          <View style={[styles.rows, { backgroundColor: c.surface, borderColor: c.line }]}>
            {value.map((v, i) => (
              <View key={i} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted, width: 22 }}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={{ flex: 1, fontFamily: font.body, fontSize: 14.5, color: c.ink }}>{v}</Text>
                <Pressable onPress={() => remove(i)} hitSlop={10} accessibilityLabel="Remove">
                  <X size={16} color={c.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        )
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input
          style={{ flex: 1 }}
          value={draft}
          placeholder={placeholder}
          onChangeText={(t) => (variant === 'chips' && t.endsWith(',') ? add(t) : setDraft(t))}
          onSubmitEditing={() => add(draft)}
          submitBehavior="submit"
          returnKeyType="done"
        />
        <Pressable onPress={() => add(draft)} disabled={!draft.trim()} style={[styles.addBtn, { borderColor: c.lineStrong, backgroundColor: c.surface, opacity: draft.trim() ? 1 : 0.4 }]} accessibilityLabel="Add">
          <Plus size={18} color={c.ink} />
        </Pressable>
      </View>
      {suggestions && suggestions.length > 0 && (
        <View style={styles.chips}>
          {suggestions.map((q) => (
            <Pressable key={q} onPress={() => add(q)} style={[styles.chip, { borderColor: c.lineStrong, borderStyle: 'dashed' }]}>
              <Plus size={11} color={c.muted} />
              <Text style={{ fontFamily: font.bodyMedium, fontSize: 12.5, color: c.muted }}>{q}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1 },
  rows: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
  addBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }
})
