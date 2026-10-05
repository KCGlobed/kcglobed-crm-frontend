/**
 * Option lists and limits for the student profile form
 * (Deep Dive: Lead Management Module §4.2).
 */
export const GENDERS = ['Male', 'Female', 'Other'] as const;

/** #8: Indian states + UTs master. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
] as const;

/** #13 */
export const RELATIONSHIPS = ['Father', 'Mother', 'Guardian', 'Other'] as const;

export const GRADE_TYPES = ['Percentage', 'CGPA'] as const;
export const MEDIUMS = ['English', 'Other'] as const;
export const UG_QUALIFICATIONS = ['B.Com', 'BBA', 'BMS'] as const;
export const QUALIFICATION_STATUSES = ['Completed', 'Pursuing'] as const;
export const EMPLOYMENT_STATUSES = ['Fresher', 'Experienced'] as const;

/** #16: years start at 1990. */
export const MIN_PASSING_YEAR = 1990;
/** #26: a future UG year is allowed only while Pursuing — capped at 5 years ahead (not in the doc). */
export const maxPursuingYear = () => new Date().getFullYear() + 5;

/** #5: age between 17 and 40 ("configurable"). */
export const MIN_AGE = 17;
export const MAX_AGE = 40;

/** #42: the declaration stores its text version with the timestamp. */
export const DECLARATION_VERSION = 'v1';
export const DECLARATION_TEXT =
  'I declare that the information provided in this form is true and correct to the best of my knowledge.';
