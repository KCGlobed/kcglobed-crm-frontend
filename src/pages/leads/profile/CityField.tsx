import { useState } from 'react'
import { useProfileOptionsQuery } from '../../../services/leadsApi'
import { Input, Select } from '../../../components/ui/fields'

const OTHER = '__other__'

/** #9 Current City: a dropdown filtered by the chosen state; "Other" opens a text box. */
export function CityField({
  state,
  value,
  onChange,
  invalid,
  disabled,
}: {
  state?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  disabled?: boolean
}) {
  const { data } = useProfileOptionsQuery()
  const cities = state ? data?.data.citiesByState[state] ?? [] : []
  const [other, setOther] = useState(false)
  const typed = other || (!!value && !cities.includes(value))

  return (
    <div className="space-y-1">
      <Select
        aria-invalid={invalid}
        disabled={disabled || !state}
        value={typed ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setOther(true)
            onChange('')
          } else {
            setOther(false)
            onChange(e.target.value)
          }
        }}
      >
        <option value="">{state ? 'Select city…' : 'Choose a state first'}</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </Select>
      {typed && (
        <Input aria-invalid={invalid} disabled={disabled} placeholder="Type the city" value={value} maxLength={100} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
