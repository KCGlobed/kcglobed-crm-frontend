// Mirrors CrmBackend/src/constants/profile.ts — keep the two in sync.
export const GENDERS = ['Male', 'Female', 'Other'] as const

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
] as const

export const RELATIONSHIPS = ['Father', 'Mother', 'Guardian', 'Other'] as const
export const GRADE_TYPES = ['Percentage', 'CGPA'] as const
export const MEDIUMS = ['English', 'Other'] as const
export const UG_QUALIFICATIONS = ['B.Com', 'BBA', 'BMS'] as const
export const QUALIFICATION_STATUSES = ['Completed', 'Pursuing'] as const
export const EMPLOYMENT_STATUSES = ['Fresher', 'Experienced'] as const

/** Deep Dive §4.2 #16: years start at 1990. */
export const MIN_PASSING_YEAR = 1990
/** #26: a future UG year only while Pursuing — capped 5 years ahead. */
export const maxPursuingYear = () => new Date().getFullYear() + 5

/** #5: age between 17 and 40. */
export const MIN_AGE = 17
export const MAX_AGE = 40

/** Newest first, for the year dropdowns. */
export const yearsBetween = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => to - i)
