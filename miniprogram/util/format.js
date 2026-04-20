const CATEGORY_LABELS = {
  food: '餐饮',
  transport: '出行',
  groceries: '采购',
  daily: '日用',
  uncategorized: '未分类',
}

const RISK_LABELS = {
  PENDING: '待评估',
  LOW: '低风险',
  MEDIUM: '中风险',
  HIGH: '高风险',
  CRITICAL: '严重风险',
}

const REVIEW_LABELS = {
  PROCESSING: '评估中',
  PASS: '无异常',
  NEEDS_REVIEW: '有异常',
  NEEDS_CONFIRM: '待确认',
  MANUAL_REVIEW: '人工复核',
  REJECTED: '已拒绝',
}

const RISK_TAG_LABELS = {
  HIGH_AMOUNT: '金额偏高',
  MANUAL_ENTRY: '手动录入',
  REMARK_MISSING: '缺少备注',
  CATEGORY_CONFIRM: '分类待确认',
  DETAIL_MISSING: '明细缺失',
  AMOUNT_VALID: '金额正常',
}

function formatAmount(value) {
  return `¥${Number(value || 0).toFixed(2)}`
}

function categoryLabel(code) {
  return CATEGORY_LABELS[code] || `${code || ''}`.trim() || '未分类'
}

function riskLabel(code) {
  return RISK_LABELS[code] || '待处理'
}

function reviewLabel(code) {
  return REVIEW_LABELS[code] || '评估中'
}

function riskTagLabel(code) {
  return RISK_TAG_LABELS[code] || `${code || ''}`.trim() || '待评估'
}

function percent(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

module.exports = {
  formatAmount,
  categoryLabel,
  riskLabel,
  riskTagLabel,
  reviewLabel,
  percent,
}
