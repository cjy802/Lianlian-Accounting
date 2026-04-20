const { ensureSession } = require('../../../../util/permission')
const billService = require('../../../../util/bill-service')
const { normalizeAiRequestError } = require('../../../../util/ai-error')
const { isAbortError } = require('../../../../util/ai-stream')
const { createAiBillReviewRequest } = require('../../../../util/ai-bill-review')

function formatDateTime(timestamp) {
  if (!timestamp) return '--'

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '--'

  const pad = (value) => `${value}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function buildMetaView(meta, reviewError) {
  const current = meta || {}

  return {
    requestUrl: current.requestUrl || '',
    requestModel: current.requestModel || '',
    timeoutText: current.timeout ? `${current.timeout}ms` : '--',
    startedAtText: formatDateTime(current.startedAt),
    finishedAtText: formatDateTime(current.finishedAt),
    httpStatusText: current.httpStatus ? `${current.httpStatus}` : '--',
    errorText: reviewError || current.errorText || '',
  }
}

Page({
  data: {
    session: null,
    detail: null,
    reviewing: false,
    reviewError: '',
    reviewLoadingText: '已向大模型发送当前账单，正在等待真实返回结果。',
    aiRequestState: 'idle',
    aiRequestMeta: buildMetaView(),
  },

  onLoad(query) {
    this.billId = query.billId
    this.shouldForceAiReview = query.aiReview === '1'
  },

  onShow() {
    this._pageLeaving = false
    const session = ensureSession('USER')
    if (!session) return

    const detail = this.refreshDetail()
    this.setData({ session })
    this.syncAiRequestState(detail)

    if (this.shouldAutoReview(detail)) {
      this.startAiReview()
    }
  },

  onHide() {
    this.leaveCurrentPage()
  },

  onUnload() {
    this.leaveCurrentPage()
  },

  refreshDetail() {
    const detail = billService.getBillDetail(this.billId)
    this.setData({ detail })
    return detail
  },

  syncAiRequestState(detail) {
    const review = detail && detail.review
    const requestMeta = review && review.request_meta

    if (review && review.review_source === 'AI') {
      this.setData({
        aiRequestState: 'success',
        aiRequestMeta: buildMetaView(requestMeta, ''),
        reviewError: '',
      })
      return
    }

    this.setData({
      aiRequestState: 'idle',
      aiRequestMeta: buildMetaView(requestMeta, this.data.reviewError),
    })
  },

  shouldAutoReview(detail) {
    if (!detail || !detail.bill || !detail.review) return false
    if (this.data.reviewing) return false

    const review = detail.review
    if (this.shouldForceAiReview) return true
    return review.review_source !== 'AI'
  },

  abortAiReview() {
    if (!this._activeAiReviewRequest) return

    const request = this._activeAiReviewRequest
    this._activeAiReviewRequest = null

    if (typeof request.abort === 'function') {
      request.abort()
    }
  },

  leaveCurrentPage() {
    if (this._pageLeaving) return
    this._pageLeaving = true
    this.abortAiReview()
  },

  async startAiReview() {
    const { session, reviewing } = this.data
    if (!session || reviewing) return

    const detail = this.data.detail || this.refreshDetail()
    if (!this.shouldAutoReview(detail)) return

    const monthlyMap = billService.getUserMonthlyBillJson(session.user._id) || {}
    let request = null

    this.setData({
      reviewing: true,
      reviewError: '',
      aiRequestState: 'loading',
      aiRequestMeta: buildMetaView({
        startedAt: Date.now(),
      }),
    })

    try {
      request = createAiBillReviewRequest({
        detail,
        monthlyMap,
      })
      this._activeAiReviewRequest = request

      this.setData({
        aiRequestMeta: buildMetaView({
          ...request.requestMeta,
          startedAt: request.requestMeta && request.requestMeta.startedAt,
        }),
      })

      const review = await request.promise
      if (this._pageLeaving) return

      const nextDetail = billService.updateBillReview(this.billId, review)
      this.shouldForceAiReview = false
      this.setData({
        detail: nextDetail,
        reviewing: false,
        reviewError: '',
        aiRequestState: 'success',
        aiRequestMeta: buildMetaView(review.request_meta, ''),
      })
    } catch (error) {
      if ((this._pageLeaving && isAbortError(error)) || isAbortError(error)) return

      const reviewError = normalizeAiRequestError(error, request && request.timeout)
      const failedMeta = {
        ...(request && request.requestMeta),
        finishedAt: Date.now(),
        errorText: reviewError,
      }

      this.setData({
        reviewing: false,
        reviewError,
        aiRequestState: 'error',
        aiRequestMeta: buildMetaView(failedMeta, reviewError),
      })
    } finally {
      if (this._activeAiReviewRequest === request) {
        this._activeAiReviewRequest = null
      }
    }
  },

  retryAiReview() {
    this.shouldForceAiReview = true
    this.startAiReview()
  },

  goDetail() {
    wx.navigateTo({
      url: `/packageExtend/pages/form/form/form?billId=${this.billId}`,
    })
  },

  backHome() {
    wx.reLaunch({
      url: '/page/component/index',
    })
  },
})
