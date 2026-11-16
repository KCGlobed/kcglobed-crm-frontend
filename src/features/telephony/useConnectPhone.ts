import { useLazyMySoftphoneQuery } from '../../services/telephonyApi'
import { parseApiError } from '../../lib/utils'
import { connectPhone, disconnectPhone } from './softphone'

/** Logs the counsellor's softphone in from the CRM (on the auto-dialer only) — used by the Dialer drawer too. */
export function useConnectPhone() {
  const [load, { isFetching }] = useLazyMySoftphoneQuery()
  const connect = async () => {
    try {
      const res = await load().unwrap()
      await connectPhone(res.data)
    } catch (err) {
      disconnectPhone()
      return parseApiError(err).message
    }
    return null
  }
  return { connect, loading: isFetching }
}
