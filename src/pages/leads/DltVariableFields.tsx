import { useState } from 'react'
import { useListSavedTextsQuery, useMessagingOptionsQuery } from '../../services/messagingApi'
import { FormField, Input, Select } from '../../components/ui/fields'
import { DLT_VAR_MAX, LEAD_FIELD_LABELS, leadFieldOf, leadFieldToken } from '../../lib/smsTemplate'

/** Source dropdown value for "a saved text" (never stored: the chosen entry's text is the variable's value). */
const TEXT_SOURCE = '__text__'

/**
 * One row per {#var#} marker of an SMS template. A dropdown picks what fills it: text typed here, a lead
 * field (name, lead ID, counsellor …) looked up on the lead — per recipient in a bulk send — or one of the
 * texts saved under Communication → Texts (a short link, an event date, a venue). The value kept for a
 * variable is the text itself or the field token "{first_name}", which the server resolves.
 */
export function DltVariableFields({
  variables,
  errors,
  onChange,
  perRecipient,
  customText = true,
}: {
  variables: string[]
  errors: Record<string, string>
  onChange: (i: number, value: string) => void
  /** bulk send: lead fields are filled for each recipient */
  perRecipient?: boolean
  /** false = every variable must be a lead field or a saved text (SMS single send): the typed-text option is hidden, not removed */
  customText?: boolean
}) {
  const { data: options } = useMessagingOptionsQuery()
  const { data: savedData } = useListSavedTextsQuery({ active: true })
  const fields = options?.data.leadFields ?? Object.entries(LEAD_FIELD_LABELS).map(([value, label]) => ({ value, label }))
  const saved = savedData?.data ?? []
  // "Saved text" picked but no entry chosen yet: the (blank) value cannot tell, so it is remembered per variable
  const [textMode, setTextMode] = useState<Record<number, boolean>>({})
  if (!variables.length) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {variables.map((value, i) => {
        const named = leadFieldOf(value)
        const field = named && fields.some((f) => f.value === named) ? named : null
        const entry = !field && value ? (saved.find((s) => s.text === value) ?? null) : null
        const source = field ?? (entry || textMode[i] ? TEXT_SOURCE : '')
        const pickSource = (next: string) => {
          setTextMode((m) => ({ ...m, [i]: next === TEXT_SOURCE }))
          onChange(i, next && next !== TEXT_SOURCE ? leadFieldToken(next) : '')
        }
        return (
          <FormField
            key={i}
            label={`Variable ${i + 1}`}
            required
            error={errors[`variables.${i}`]}
            hint={
              i === 0
                ? `Fills the template's variables in order${perRecipient ? ', for every recipient' : ''}${customText ? ` · typed text max ${DLT_VAR_MAX} characters` : ''}`
                : undefined
            }
          >
            <div className="space-y-1.5">
              <Select value={source} aria-label={`Variable ${i + 1} source`} onChange={(e) => pickSource(e.target.value)}>
                <option value="">{customText ? 'Custom text (type below)' : 'Choose…'}</option>
                <option value={TEXT_SOURCE}>Saved text</option>
                {fields.map((f) => (
                  <option key={f.value} value={f.value}>
                    Lead · {f.label}
                  </option>
                ))}
              </Select>
              {source === TEXT_SOURCE && (
                <Select
                  value={entry?._id ?? ''}
                  aria-label={`Variable ${i + 1} saved text`}
                  aria-invalid={!!errors[`variables.${i}`]}
                  onChange={(e) => onChange(i, saved.find((s) => s._id === e.target.value)?.text ?? '')}
                >
                  <option value="">{saved.length ? 'Choose a text…' : 'No saved texts yet — add them under Communication → Texts'}</option>
                  {saved.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} · {s.text}
                    </option>
                  ))}
                </Select>
              )}
              {customText && source === '' && (
                <Input
                  value={value}
                  maxLength={DLT_VAR_MAX}
                  placeholder="Text to send"
                  aria-label={`Variable ${i + 1} text`}
                  aria-invalid={!!errors[`variables.${i}`]}
                  onChange={(e) => onChange(i, e.target.value)}
                />
              )}
            </div>
          </FormField>
        )
      })}
    </div>
  )
}
