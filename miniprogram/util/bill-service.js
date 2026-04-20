const { getDb, updateDb, appendOperationLog, formatNow } = require('./mock-db')
const { formatAmount, categoryLabel, riskLabel, riskTagLabel, reviewLabel, percent } = require('./format')

function normalizeReviewStatus(review) {
  if (!review) return 'PROCESSING'
  if (isRejectedReview(review)) return 'REJECTED'
  if (review.review_conclusion === 'PASS') return 'PASS'
  if (review.requires_manual_check) return 'MANUAL_REVIEW'
  if (review.review_conclusion === 'NEEDS_CONFIRM') return 'NEEDS_CONFIRM'
  if (review.review_conclusion === 'PROCESSING') return 'PROCESSING'
  return 'NEEDS_REVIEW'
}

function safeTrim(value) {
  return `${value || ''}`.trim()
}

function isPlaceholderText(value) {
  const text = safeTrim(value)
  if (!text) return false

  const normalized = text
    .toLowerCase()
    .replace(/[^a-z]/g, '')

  if (!normalized) return false

  return [
    'length',
    'string',
    'number',
    'boolean',
    'object',
    'array',
    'null',
    'undefined',
    'text',
    'content',
    'value',
    'result',
    'data',
    'message',
  ].includes(normalized)
}

function looksLikeRawJsonBlock(value) {
  const text = safeTrim(value)
  if (!text) return false

  if (/^```json/i.test(text) || /^```/i.test(text)) return true

  return (
    /"risk_level"\s*:/.test(text) ||
    /"review_conclusion"\s*:/.test(text) ||
    /"review_summary"\s*:/.test(text) ||
    /"comparison_text"\s*:/.test(text) ||
    /"analysis_text"\s*:/.test(text)
  )
}

function pickMeaningfulText(value, fallback) {
  const text = safeTrim(value)
  if (!text || isPlaceholderText(text) || looksLikeRawJsonBlock(text)) return safeTrim(fallback)
  return text
}

function sanitizeReviewSuggestions(suggestions) {
  if (!Array.isArray(suggestions)) return []
  return suggestions.map((item) => safeTrim(item)).filter((item) => item && !isPlaceholderText(item)).slice(0, 1)
}

function isGenericReviewSummary(value) {
  const text = safeTrim(value).replace(/[。！!？?\s]/g, '')
  if (!text) return true

  return [
    '有异常',
    '无异常',
    '异常',
    '正常',
    '需确认',
    '建议确认',
    '建议复核',
    '需要复核',
  ].includes(text)
}

function buildReviewHeadline(reviewSummary, comparisonText, analysisText) {
  if (!isGenericReviewSummary(reviewSummary)) return reviewSummary

  const fallback = [
    safeTrim(comparisonText),
    safeTrim(analysisText),
  ].find((item) => item && !looksLikeRawJsonBlock(item) && !isPlaceholderText(item))

  return fallback || reviewSummary
}

function isRejectedReview(review) {
  if (!review || review.review_source !== 'AI') return false

  const summaryText = [
    safeTrim(review.review_summary),
    safeTrim(review.comparison_text),
    safeTrim(review.analysis_text),
  ].join(' ')

  const normalized = summaryText.replace(/\s+/g, '')
  const hasAbnormalHint =
    normalized.includes('有异常') ||
    normalized.includes('明显异常') ||
    normalized.includes('金额异常') ||
    normalized.includes('异常支出') ||
    normalized.includes('超出合理范围') ||
    normalized.includes('超出提醒金额') ||
    normalized.includes('不合理') ||
    normalized === '异常'

  return (
    review.review_conclusion === 'NEEDS_REVIEW' ||
    review.requires_manual_check === true ||
    review.risk_level === 'HIGH' ||
    hasAbnormalHint
  )
}

function getEffectiveBillState(bill, review) {
  const currentBill = bill || {}
  const currentReview = review || {}
  const rejectedByAi = isRejectedReview(currentReview)
  const reviewStatus = rejectedByAi
    ? 'REJECTED'
    : (currentReview.review_source ? normalizeReviewStatus(currentReview) : currentBill.review_status || 'PROCESSING')
  const riskLevel = currentReview.risk_level || currentBill.risk_level || 'PENDING'
  const excludedFromStats = Boolean(currentBill.excluded_from_stats || reviewStatus === 'REJECTED' || rejectedByAi)

  return {
    review_status: reviewStatus,
    risk_level: riskLevel,
    excluded_from_stats: excludedFromStats,
    rejected_by_ai: Boolean(currentBill.rejected_by_ai || rejectedByAi),
  }
}

function isCountableBill(bill, review) {
  if (!bill) return false
  const state = getEffectiveBillState(bill, review)
  return !state.excluded_from_stats && state.review_status !== 'REJECTED'
}

function sanitizeReviewData(review) {
  const current = review || {}
  const reviewSummary = pickMeaningfulText(
    current.review_summary,
    current.review_source === 'AI'
      ? '本次支出暂无明显异常，可结合日常消费情况继续关注。'
      : ''
  )

  return {
    ...current,
    review_summary: reviewSummary,
    hero_summary: buildReviewHeadline(reviewSummary, current.comparison_text, current.analysis_text),
    comparison_text: pickMeaningfulText(
      current.comparison_text,
      reviewSummary || '该笔支出已完成基础对比，建议结合近期同类消费水平综合判断。'
    ),
    analysis_text: pickMeaningfulText(current.analysis_text, reviewSummary),
    review_suggestions: sanitizeReviewSuggestions(current.review_suggestions),
  }
}

function enrichReview(review) {
  const current = sanitizeReviewData(review)
  const riskTags = Array.isArray(current.risk_tags) ? current.risk_tags : []
  const suggestions = Array.isArray(current.review_suggestions) ? current.review_suggestions : []
  const ruleHits = Array.isArray(current.rule_hits) ? current.rule_hits : []

  return {
    ...current,
    riskText: riskLabel(current.risk_level),
    riskTagTexts: riskTags.map((item) => riskTagLabel(item)),
    reviewConclusionText: reviewLabel(current.review_conclusion),
    review_suggestions: suggestions,
    rule_hits: ruleHits,
    comparison_text: current.comparison_text || '',
    analysis_text: current.analysis_text || '',
  }
}

function createInitialConfirmedReview() {
  return {
    review_conclusion: 'PROCESSING',
    risk_level: 'PENDING',
    risk_tags: [],
    review_summary: '',
    review_suggestions: [],
    requires_manual_check: false,
    rule_hits: [],
    review_source: 'INITIAL',
    comparison_text: '',
    analysis_text: '',
    request_meta: null,
  }
}

function saveReviewToDb(db, billId, review) {
  const rejectedByAi = isRejectedReview(review)
  const nextReview = {
    ...review,
    bill_id: billId,
    rejected_by_ai: rejectedByAi,
  }

  const reviewIndex = db.reviewResults.findIndex((item) => item.bill_id === billId)
  if (reviewIndex >= 0) {
    db.reviewResults[reviewIndex] = {
      ...db.reviewResults[reviewIndex],
      ...nextReview,
    }
  } else {
    db.reviewResults.push({
      _id: `review_${Date.now()}`,
      ...nextReview,
    })
  }

  const billIndex = db.bills.findIndex((item) => item._id === billId)
  if (billIndex >= 0) {
    db.bills[billIndex] = {
      ...db.bills[billIndex],
      review_status: rejectedByAi ? 'REJECTED' : normalizeReviewStatus(review),
      risk_level: review.risk_level || 'PENDING',
      excluded_from_stats: rejectedByAi,
      rejected_by_ai: rejectedByAi,
    }
  }
}

function withBillMeta(bill, db) {
  if (!bill) return null
  const review = sanitizeReviewData(db.reviewResults.find((item) => item.bill_id === bill._id) || {})
  const effectiveState = getEffectiveBillState(bill, review)
  const items = db.billItems.filter((item) => item.bill_id === bill._id)
  const reviewSummary = review.review_source === 'AI' ? review.review_summary : ''
  return {
    ...bill,
    ...effectiveState,
    amountText: formatAmount(bill.actual_amount || bill.total_amount),
    categoryText: categoryLabel(bill.category_code),
    riskText: riskLabel(effectiveState.risk_level),
    reviewText: reviewLabel(effectiveState.review_status),
    reviewSummary: reviewSummary || '未生成 AI 评审',
    itemCount: items.length,
  }
}

function listUserBills(userId) {
  const db = getDb()
  return db.bills
    .filter((bill) => bill.user_id === userId)
    .filter((bill) => {
      const review = db.reviewResults.find((item) => item.bill_id === bill._id) || {}
      return isCountableBill(bill, review)
    })
    .sort((a, b) => `${b.bill_date}${b.created_at}`.localeCompare(`${a.bill_date}${a.created_at}`))
    .map((bill) => withBillMeta(bill, db))
}

function getBillDetail(billId) {
  const db = getDb()
  const bill = db.bills.find((item) => item._id === billId)
  if (!bill) return null

  const items = db.billItems.filter((item) => item.bill_id === billId)
  const attachments = db.billAttachments.filter((item) => item.bill_id === billId)
  const review = db.reviewResults.find((item) => item.bill_id === billId) || {}

  return {
    bill: withBillMeta(bill, db),
    items: items.map((item) => ({
      ...item,
      subtotalText: formatAmount(item.subtotal_amount),
    })),
    attachments,
    review: enrichReview(review),
  }
}

function getUserDashboard(userId) {
  const bills = listUserBills(userId)
  const totalAmount = bills.reduce((sum, item) => sum + Number(item.actual_amount || item.total_amount || 0), 0)
  const riskCount = bills.filter((item) => item.risk_level === 'HIGH' || item.risk_level === 'CRITICAL').length
  const pendingCount = bills.filter((item) => item.review_status !== 'PASS').length
  const monthGoal = 4000

  return {
    totalAmountText: formatAmount(totalAmount),
    billCount: bills.length,
    riskCount,
    pendingCount,
    recentBills: bills.slice(0, 3),
    progressPercent: Math.min(percent(totalAmount, monthGoal), 100),
    progressText: `${percent(totalAmount, monthGoal)}% 的本月预算可视额度已使用`,
  }
}

function getUserAnalytics(userId) {
  const bills = listUserBills(userId)
  const totalAmount = bills.reduce((sum, item) => sum + Number(item.actual_amount || item.total_amount || 0), 0)
  const categoryMap = {}
  const merchantMap = {}

  bills.forEach((bill) => {
    categoryMap[bill.category_code] = (categoryMap[bill.category_code] || 0) + Number(bill.actual_amount || 0)
    merchantMap[bill.merchant_name] = (merchantMap[bill.merchant_name] || 0) + Number(bill.actual_amount || 0)
  })

  const categoryBreakdown = Object.keys(categoryMap).map((key) => ({
    code: key,
    label: categoryLabel(key),
    amountText: formatAmount(categoryMap[key]),
    ratio: percent(categoryMap[key], totalAmount),
  })).sort((a, b) => b.ratio - a.ratio)

  const merchantRanking = Object.keys(merchantMap).map((key) => ({
    merchantName: key,
    amountText: formatAmount(merchantMap[key]),
    ratio: percent(merchantMap[key], totalAmount),
  })).sort((a, b) => b.ratio - a.ratio)

  const trend = bills.slice(0, 4).reverse().map((bill, index) => ({
    label: bill.bill_date.slice(5),
    amountText: formatAmount(bill.actual_amount),
    height: 50 + index * 28,
  }))

  const riskDistribution = [
    { label: '低风险', value: bills.filter((item) => item.risk_level === 'LOW').length },
    { label: '中风险', value: bills.filter((item) => item.risk_level === 'MEDIUM').length },
    { label: '高风险', value: bills.filter((item) => item.risk_level === 'HIGH').length },
  ]

  return {
    totalAmountText: formatAmount(totalAmount),
    categoryBreakdown,
    merchantRanking,
    trend,
    riskDistribution,
  }
}

function getUserMonthlyBillJson(userId, monthKey) {
  const db = getDb()
  const userMonthly = (db.monthlyBillJson && db.monthlyBillJson[userId]) || {}

  if (monthKey) return userMonthly[monthKey] || null
  return userMonthly
}

function createManualBill(userId, payload) {
  const form = payload || {}
  const amount = Number(form.amount || 0)
  const billDate = form.billDate || formatNow().slice(0, 10)
  const merchantName = (form.merchantName || '手动录入账单').trim()
  const itemName = (form.itemName || merchantName).trim()
  const categoryCode = `${form.categoryCode || ''}`.trim() || 'uncategorized'
  const remark = (form.remark || '').trim()
  const review = createInitialConfirmedReview()
  const billId = `bill_${Date.now()}`

  updateDb((db) => {
    db.bills.unshift({
      _id: billId,
      user_id: userId,
      bill_type: 'MANUAL',
      source_type: 'MANUAL',
      tags: ['手动录入'],
      created_at: formatNow(),
      merchant_name: merchantName,
      bill_date: billDate,
      total_amount: amount,
      actual_amount: amount,
      category_code: categoryCode,
      review_status: normalizeReviewStatus(review),
      risk_level: review.risk_level,
      remark,
    })

    db.billItems.push({
      _id: `item_${Date.now()}_0`,
      bill_id: billId,
      item_name: itemName,
      quantity: 1,
      unit_price: amount,
      subtotal_amount: amount,
    })

    saveReviewToDb(db, billId, review)
  })

  appendOperationLog({
    operator_user_id: userId,
    operator_role_code: 'USER',
    module: 'BILL_UPLOAD',
    action: 'CREATE',
    details: { message: 'manual_bill_created', target_id: billId },
  })

  return billId
}

function updateBillReview(billId, review) {
  updateDb((db) => {
    saveReviewToDb(db, billId, review)
  })

  return getBillDetail(billId)
}

function deleteBill(userId, billId) {
  let removed = false

  updateDb((db) => {
    const targetBill = db.bills.find((item) => item._id === billId && item.user_id === userId)
    if (!targetBill) return

    removed = true
    db.bills = db.bills.filter((item) => item._id !== billId)
    db.billItems = db.billItems.filter((item) => item.bill_id !== billId)
    db.billAttachments = db.billAttachments.filter((item) => item.bill_id !== billId)
    db.reviewResults = db.reviewResults.filter((item) => item.bill_id !== billId)
  })

  if (removed) {
    appendOperationLog({
      operator_user_id: userId,
      operator_role_code: 'USER',
      module: 'BILL_MANAGEMENT',
      action: 'DELETE',
      details: {
        message: 'bill_deleted',
        target_id: billId,
      },
    })
  }

  return removed
}

function createBillFromTemplate(userId, templateCode, files) {
  const templates = {
    quick_coffee: {
      merchant_name: 'Seesaw Coffee',
      bill_date: '2026-04-13',
      total_amount: 42,
      actual_amount: 42,
      category_code: 'food',
      review_status: 'PASS',
      risk_level: 'LOW',
      remark: '模板上传：咖啡小票',
      review: {
        review_conclusion: 'PASS',
        risk_level: 'LOW',
        risk_tags: ['AMOUNT_VALID'],
        review_summary: '识别成功，金额和明细一致。',
        review_suggestions: ['建议补充门店标签'],
        requires_manual_check: false,
        rule_hits: [],
      },
      items: [{ item_name: '冰美式', quantity: 1, unit_price: 42, subtotal_amount: 42 }],
    },
    travel_order: {
      merchant_name: '高铁管家',
      bill_date: '2026-04-13',
      total_amount: 256,
      actual_amount: 256,
      category_code: 'transport',
      review_status: 'NEEDS_REVIEW',
      risk_level: 'MEDIUM',
      remark: '模板上传：出行订单',
      review: {
        review_conclusion: 'NEEDS_CONFIRM',
        risk_level: 'MEDIUM',
        risk_tags: ['CATEGORY_CONFIRM'],
        review_summary: '识别可信，建议确认是否属于差旅或个人出行。',
        review_suggestions: ['补充出行目的', '确认分类'],
        requires_manual_check: false,
        rule_hits: [{ rule_code: 'R004', message: '分类待确认' }],
      },
      items: [{ item_name: '高铁票', quantity: 1, unit_price: 256, subtotal_amount: 256 }],
    },
    market_bill: {
      merchant_name: '山姆会员商店',
      bill_date: '2026-04-13',
      total_amount: 699,
      actual_amount: 699,
      category_code: 'groceries',
      review_status: 'MANUAL_REVIEW',
      risk_level: 'HIGH',
      remark: '模板上传：商超账单',
      review: {
        review_conclusion: 'NEEDS_REVIEW',
        risk_level: 'HIGH',
        risk_tags: ['HIGH_AMOUNT', 'DETAIL_MISSING'],
        review_summary: '金额较高且缺少完整明细，建议人工确认。',
        review_suggestions: ['补充原始清单', '确认是否为家庭集中采购'],
        requires_manual_check: true,
        rule_hits: [{ rule_code: 'R003', message: '高金额异常波动' }],
      },
      items: [{ item_name: '合计金额', quantity: 1, unit_price: 699, subtotal_amount: 699 }],
    },
  }

  const template = templates[templateCode] || templates.quick_coffee
  const billId = `bill_${Date.now()}`
  const review = createInitialConfirmedReview()

  updateDb((db) => {
    db.bills.unshift({
      _id: billId,
      user_id: userId,
      bill_type: files && files.length ? 'UPLOAD' : 'TEMPLATE',
      source_type: files && files.length ? 'FILE' : 'TEMPLATE',
      tags: ['新上传'],
      created_at: formatNow(),
      ...template,
      review_status: normalizeReviewStatus(review),
      risk_level: review.risk_level,
    })

    template.items.forEach((item, index) => {
      db.billItems.push({
        _id: `item_${Date.now()}_${index}`,
        bill_id: billId,
        ...item,
      })
    })

    db.reviewResults.push({
      _id: `review_${Date.now()}`,
      bill_id: billId,
      ...review,
    })

    db.billAttachments.push({
      _id: `att_${Date.now()}`,
      bill_id: billId,
      file_name: files && files.length ? files[0].name : `${templateCode}.mock`,
      file_type: files && files.length ? files[0].type || 'application/octet-stream' : 'mock/template',
    })
  })

  appendOperationLog({
    operator_user_id: userId,
    operator_role_code: 'USER',
    module: 'BILL_UPLOAD',
    action: 'CREATE',
    details: { message: '新账单已创建', target_id: billId },
  })

  return billId
}

function clearUserRecords(userId) {
  let removedBillCount = 0

  updateDb((db) => {
    const targetBillIds = db.bills.filter((item) => item.user_id === userId).map((item) => item._id)
    removedBillCount = targetBillIds.length

    if (!targetBillIds.length) {
      db.notifications = db.notifications.filter((item) => item.user_id !== userId)
      return
    }

    const billIdMap = targetBillIds.reduce((acc, id) => {
      acc[id] = true
      return acc
    }, {})

    db.bills = db.bills.filter((item) => item.user_id !== userId)
    db.billItems = db.billItems.filter((item) => !billIdMap[item.bill_id])
    db.billAttachments = db.billAttachments.filter((item) => !billIdMap[item.bill_id])
    db.reviewResults = db.reviewResults.filter((item) => !billIdMap[item.bill_id])
    db.notifications = db.notifications.filter((item) => item.user_id !== userId)
  })

  appendOperationLog({
    operator_user_id: userId,
    operator_role_code: 'USER',
    module: 'DATA_MANAGEMENT',
    action: 'CLEAR_RECORDS',
    details: {
      message: removedBillCount ? `cleared_${removedBillCount}_records` : 'no_records_to_clear',
    },
  })

  return removedBillCount
}

module.exports = {
  listUserBills,
  getBillDetail,
  getUserDashboard,
  getUserAnalytics,
  getUserMonthlyBillJson,
  createManualBill,
  updateBillReview,
  deleteBill,
  createBillFromTemplate,
  clearUserRecords,
}
