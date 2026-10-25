// Lab techs see only what they use at the bench. A Senior's tools (editing tests, staff, publishing,
// import/export, cloud settings) appear while a Senior is confirmed on the phone, and stay out of the
// way the rest of the time. The cloud still checks the Senior's PIN for every change.
import { useCallback } from 'react'
import { useData } from './data'
import { useRequireStaff } from './identity'

export function useSeniorMode() {
  const { session, staff } = useData()
  const requireStaff = useRequireStaff()
  // Before anyone is on the staff list, whoever sets the phone up needs the tools.
  const on = staff.length === 0 || session?.role === 'SENIOR'
  const unlock = useCallback(() => requireStaff('SENIOR', 'open Senior tools'), [requireStaff])
  return { on, unlock }
}
