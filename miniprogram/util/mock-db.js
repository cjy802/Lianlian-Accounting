const createInitialDb = require('./mock-database')

const DB_KEY = 'lianlian_mock_db_v3'

function clone(data) {
  return JSON.parse(JSON.stringify(data))
}

function formatNow() {
  const date = new Date()
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function getMonthKeyByDate(dateText) {
  if (!dateText || typeof dateText !== 'string' || dateText.length < 7) return ''
  return dateText.slice(0, 7)
}

function safeTrim(value) {
  return `${value || ''}`.trim()
}

function isRejectedAiReview(review) {
  if (!review || review.review_source !== 'AI') return false

  const combinedText = [
    safeTrim(review.review_summary),
    safeTrim(review.comparison_text),
    safeTrim(review.analysis_text),
  ].join(' ').replace(/\s+/g, '')

  return (
    review.review_conclusion === 'NEEDS_REVIEW' ||
    review.requires_manual_check === true ||
    review.risk_level === 'HIGH' ||
    combinedText.includes('有异常') ||
    combinedText.includes('明显异常') ||
    combinedText.includes('金额异常') ||
    combinedText.includes('超出合理范围') ||
    combinedText.includes('不合理')
  )
}

function buildMonthlyBillJson(db) {
  const result = {}
  const bills = Array.isArray(db.bills) ? db.bills : []
  const reviewMap = Array.isArray(db.reviewResults)
    ? db.reviewResults.reduce((acc, item) => {
      acc[item.bill_id] = item
      return acc
    }, {})
    : {}

  bills.forEach((bill) => {
    const userId = bill.user_id
    const month = getMonthKeyByDate(bill.bill_date)
    if (!userId || !month) return
    const review = reviewMap[bill._id] || null
    if (bill.excluded_from_stats || bill.review_status === 'REJECTED' || isRejectedAiReview(review)) return

    if (!result[userId]) result[userId] = {}
    if (!result[userId][month]) {
      result[userId][month] = {
        user_id: userId,
        month,
        bill_count: 0,
        total_amount: 0,
        bills: [],
      }
    }

    const amount = Number(bill.actual_amount || bill.total_amount || 0)
    const bucket = result[userId][month]
    bucket.bill_count += 1
    bucket.total_amount += amount
    bucket.bills.push({
      bill_id: bill._id,
      bill_date: bill.bill_date,
      merchant_name: bill.merchant_name,
      category_code: bill.category_code,
      review_status: bill.review_status,
      risk_level: bill.risk_level,
      total_amount: Number(bill.total_amount || 0),
      actual_amount: Number(bill.actual_amount || 0),
      remark: bill.remark || '',
      created_at: bill.created_at || '',
    })
  })

  Object.keys(result).forEach((userId) => {
    Object.keys(result[userId]).forEach((month) => {
      const bucket = result[userId][month]
      bucket.total_amount = Number(bucket.total_amount.toFixed(2))
      bucket.bills.sort((a, b) => `${b.bill_date}${b.created_at}`.localeCompare(`${a.bill_date}${a.created_at}`))
    })
  })

  return result
}

function getDb() {
  let db = wx.getStorageSync(DB_KEY)
  if (!db || !db.users) {
    db = createInitialDb()
    db.monthlyBillJson = buildMonthlyBillJson(db)
    saveDb(db)
  } else {
    db.monthlyBillJson = buildMonthlyBillJson(db)
    saveDb(db)
  }
  return clone(db)
}

function saveDb(db) {
  wx.setStorageSync(DB_KEY, clone(db))
}

function updateDb(mutator) {
  const db = getDb()
  mutator(db)
  db.monthlyBillJson = buildMonthlyBillJson(db)
  saveDb(db)
  return db
}

function appendOperationLog(log) {
  return updateDb((db) => {
    db.operationLogs.unshift({
      _id: `log_${Date.now()}`,
      created_at: formatNow(),
      result: 'SUCCESS',
      ...log,
    })
  })
}

module.exports = {
  getDb,
  saveDb,
  updateDb,
  appendOperationLog,
  formatNow,
}
