import { Toaster, toast, useSonner } from 'sonner'
import { X } from 'lucide-react'

/** How long any pop-up stays, in ms: every toast, push notifications included, goes after this. */
export const TOAST_DURATION = 3000

/** The toaster's distance from the viewport edges, so the Clear All button can sit beside the stack. */
const EDGE = 24
const MOBILE_EDGE = 16
/** sonner's toast width (its TOAST_WIDTH), used to place the button just left of the stack. */
const TOAST_WIDTH = 356

/**
 * The app's pop-ups: sonner's toaster at the top right, each toast gone after
 * TOAST_DURATION, plus a "Clear All" button whenever two or more are showing.
 * The button sits level with the first toast, just left of the stack, so it never
 * covers one. Phones show toasts full-width, so there it is left out and each
 * toast's own close button serves.
 */
export function Toasts() {
  const { toasts } = useSonner()
  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={TOAST_DURATION}
        offset={{ top: EDGE, right: EDGE, bottom: EDGE, left: EDGE }}
        mobileOffset={{ top: MOBILE_EDGE, right: MOBILE_EDGE, bottom: MOBILE_EDGE, left: MOBILE_EDGE }}
      />
      {toasts.length > 1 && (
        <button
          type="button"
          onClick={() => toast.dismiss()}
          className="fixed z-[100] hidden h-8 items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-3 text-xs font-medium text-slate-600 shadow-md backdrop-blur transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
          style={{ top: EDGE, right: EDGE + TOAST_WIDTH + 12 }}
        >
          <X className="h-3.5 w-3.5" /> Clear All
        </button>
      )}
    </>
  )
}
