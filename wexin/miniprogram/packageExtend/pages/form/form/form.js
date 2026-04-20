const { ensureSession } = require('../../../../util/permission')
const billService = require('../../../../util/bill-service')

Page({
  data: {
    session: null,
    detail: null,
  },

  onLoad(query) {
    this.billId = query.billId
  },

  onShow() {
    const session = ensureSession('USER')
    if (!session) return

    this.setData({
      session,
      detail: billService.getBillDetail(this.billId),
    })
  },

  openReview() {
    wx.navigateTo({
      url: `/packageExtend/pages/operate/msg/msg?billId=${this.billId}`,
    })
  },
})
