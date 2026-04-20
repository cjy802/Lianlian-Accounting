const { ensureSession } = require('../../../../util/permission')
const billService = require('../../../../util/bill-service')

Page({
  data: {
    session: null,
    keyword: '',
    filter: 'all',
    bills: [],
    displayBills: [],
  },

  onShow() {
    const session = ensureSession('USER')
    if (!session) return

    const bills = billService.listUserBills(session.user._id)
    this.setData({ session, bills })
    this.applyFilters('', 'all', bills)
  },

  handleSearch(event) {
    const keyword = event.detail.value
    this.setData({ keyword })
    this.applyFilters(keyword, this.data.filter, this.data.bills)
  },

  changeFilter(event) {
    const filter = event.currentTarget.dataset.filter
    this.setData({ filter })
    this.applyFilters(this.data.keyword, filter, this.data.bills)
  },

  applyFilters(keyword, filter, sourceBills) {
    const normalized = (keyword || '').trim().toLowerCase()
    let displayBills = sourceBills

    if (filter === 'high') {
      displayBills = displayBills.filter((item) => item.risk_level === 'HIGH')
    } else if (filter === 'pending') {
      displayBills = displayBills.filter((item) => item.review_status !== 'PASS')
    }

    if (normalized) {
      displayBills = displayBills.filter((item) => {
        return (
          item.merchant_name.toLowerCase().includes(normalized) ||
          item.categoryText.toLowerCase().includes(normalized) ||
          item.reviewText.toLowerCase().includes(normalized)
        )
      })
    }

    this.setData({ displayBills })
  },

  openBill(event) {
    wx.navigateTo({
      url: `/packageExtend/pages/form/form/form?billId=${event.currentTarget.dataset.id}`,
    })
  },

  deleteBill(event) {
    const { id, merchant } = event.currentTarget.dataset
    const { session } = this.data
    if (!session || !id) return

    wx.showModal({
      title: '删除账单',
      content: `确认删除“${merchant || '这笔账单'}”吗？删除后不可恢复。`,
      confirmColor: '#d93025',
      success: ({ confirm }) => {
        if (!confirm) return

        const removed = billService.deleteBill(session.user._id, id)
        if (!removed) {
          wx.showToast({
            title: '删除失败',
            icon: 'none',
          })
          return
        }

        const bills = billService.listUserBills(session.user._id)
        this.setData({ bills })
        this.applyFilters(this.data.keyword, this.data.filter, bills)
        wx.showToast({
          title: '已删除',
          icon: 'success',
        })
      },
    })
  },
})
