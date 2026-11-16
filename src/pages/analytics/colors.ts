/**
 * Analytics chart colours, taken from the CRM theme tokens in src/index.css (brand purple + gold, the theme's own
 * emerald / red / slate). Stage classes and follow-up / call parts share one meaning across every chart.
 */
export const COLORS = {
  brand: '#5f3d9e', // brand-500
  brandSoft: '#8c6cc3', // brand-400
  gold: '#fbb03b', // gold-400
  open: '#5f3d9e', // actionable = brand
  lost: '#9892a9', // slate-400
  converted: '#198754', // emerald-600
  onTime: '#198754',
  missed: '#dc3545', // red-500
  upcoming: '#fbb03b',
  contacted: '#8c6cc3',
  notConnected: '#f59511', // gold-500
  notCalled: '#dc3545',
  enrolled: '#198754',
  waiting: '#ea868f', // red-300: "still waiting" next to green
  ink: '#1a1526', // slate-900
  grid: '#f4f2f8', // slate-100
} as const

/** the Dashboard funnel's band fills: light lavender at the top to the deepest brand purple */
export const FUNNEL_FILLS = ['#ab95dd', '#9a80d0', '#8466be', '#6f4fae', '#5d3fa1', '#4b2d87', '#3a2075']
