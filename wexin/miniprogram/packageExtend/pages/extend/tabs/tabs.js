const { ensureSession } = require('../../../../util/permission')
const billService = require('../../../../util/bill-service')

Page({
  data: {
    session: null,
    analytics: null,
  },

  onShow() {
    const session = ensureSession('USER')
    if (!session) return

    this.setData({
      session,
      analytics: billService.getUserAnalytics(session.user._id),
    })
  },
})
