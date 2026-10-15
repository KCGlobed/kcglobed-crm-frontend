import { useMessagingOptionsQuery } from '../../services/messagingApi'
import { FormField, Input, Select } from '../../components/ui/fields'
import { DLT_VAR_MAX, LEAD_FIELD_LABELS, leadFieldOf, leadFieldToken } from '../../lib/smsTemplate'

/**
 * One row per {#var#} marker of an SMS template. A dropdown picks what fills it: text typed here, or a
 * lead field (name, lead ID, counsellor …) looked up on the lead — per recipient in a bulk send. The value
 * kept for a variable is the text itself or the field token "{first_name}", which the server resolves.
 */
export function DltVariableFields({
  variables,
  errors,
  onChange,
  perRecipient,
}: {
  variables: string[]
  errors: Record<string, string>
  onChange: (i: number, value: string) => void
  /** bulk send: lead fields are filled for each recipient */
  perRecipient?: boolean
}) {
  const { data: options } = useMessagingOptionsQuery()
  const fields = options?.data.leadFields ?? Object.entries(LEAD_FIELD_LABELS).map(([value, label]) => ({ value, label }))
  if (!variables.length) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {variables.map((value, i) => {
        const named = leadFieldOf(value)
        const field = named && fields.some((f) => f.value === named) ? named : null
        return (
          <FormField
            key={i}
            label={`Variable ${i + 1}`}
            required
            error={errors[`variables.${i}`]}
            hint={
              i === 0
                ? `Fills the {#var#} markers in order${perRecipient ? ', for every recipient' : ''} · typed text max ${DLT_VAR_MAX} characters`
                : undefined
            }
          >
            <div className="space-y-1.5">
              <Select
                value={field ?? ''}
                aria-label={`Variable ${i + 1} source`}
                onChange={(e) => onChange(i, e.target.value ? leadFieldToken(e.target.value) : '')}
              >
                <option value="">Custom text (type below)</option>
                {fields.map((f) => (
                  <option key={f.value} value={f.value}>
                    Lead · {f.label}
                  </option>
                ))}
              </Select>
              {field === null && (
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
