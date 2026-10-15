/** DLT variable marker, exactly as a template is registered on the TRAI DLT portal; values are typed when sending. */
export const DLT_VAR = '{#var#}'

/** TRAI rule: one variable value is at most 30 characters. */
export const DLT_VAR_MAX = 30

/** How many values the sender has to type for this SMS template. */
export function dltVariableCount(body: string): number {
  return body.split(DLT_VAR).length - 1
}

/**
 * Fills the {#var#} markers in order with the typed values. A blank value leaves its marker in
 * place, so the live preview shows what is still missing; the server applies the same rule.
 */
export function fillDltVariables(body: string, values: string[]): string {
  const parts = body.split(DLT_VAR)
  let out = parts[0]
  for (let i = 1; i < parts.length; i++) {
    const value = (values[i - 1] ?? '').trim()
    out += (value || DLT_VAR) + parts[i]
  }
  return out
}
