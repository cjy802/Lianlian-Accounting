const { categoryLabel } = require('./format')
const { readAiConfig, validateAiConfig, buildAiRequestUrl } = require('./ai-config')
const { extractAiReply, normalizeResponseBody } = require('./ai-stream')
const { buildAiHttpErrorMessage } = require('./ai-error')

const BILL_REVIEW_TIMEOUT = 60000

function toAmount(value) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0
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

function decodeLooseText(value) {
  return safeTrim(value)
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
}

function extractLooseStringField(text, key) {
  const source = safeTrim(text)
  if (!source) return ''

  const fullMatch = source.match(new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"`, 'i'))
  if (fullMatch && fullMatch[1] !== undefined) return decodeLooseText(fullMatch[1])

  const partialMatch = source.match(new RegExp(`"${key}"\\s*:\\s*"([^\\n\\r]*)`, 'i'))
  if (partialMatch && partialMatch[1] !== undefined) return decodeLooseText(partialMatch[1])

  return ''
}

function extractLooseSuggestions(text) {
  const source = safeTrim(text)
  if (!source) return []

  const firstItemMatch = source.match(/"review_suggestions"\s*:\s*\[\s*"([\s\S]*?)"/i)
  if (firstItemMatch && firstItemMatch[1] !== undefined) {
    return [decodeLooseText(firstItemMatch[1])]
  }

  return []
}

function extractLooseReviewPayload(text) {
  const payload = {
    risk_level: extractLooseStringField(text, 'risk_level'),
    review_conclusion: extractLooseStringField(text, 'review_conclusion'),
    review_summary: extractLooseStringField(text, 'review_summary'),
    comparison_text: extractLooseStringField(text, 'comparison_text'),
    analysis_text: extractLooseStringField(text, 'analysis_text'),
    review_suggestions: extractLooseSuggestions(text),
  }

  return looksLikeReviewPayload(payload) ? payload : null
}

function buildCurrentBillSummary(detail) {
  const bill = (detail && detail.bill) || {}
  const items = Array.isArray(detail && detail.items) ? detail.items : []

  return {
    bill_id: bill._id || '',
    merchant_name: bill.merchant_name || '',
    amount: toAmount(bill.actual_amount || bill.total_amount),
    bill_date: bill.bill_date || '',
    category_code: bill.category_code || '',
    category_name: categoryLabel(bill.category_code),
    remark: bill.remark || '',
    items: items.map((item) => ({
      item_name: item.item_name || '',
      quantity: Number(item.quantity || 0),
      subtotal_amount: toAmount(item.subtotal_amount),
    })),
  }
}

function buildUserInputSummary(currentBill) {
  return [
    `商户名称：${currentBill.merchant_name || '未识别'}`,
    `账单金额：${currentBill.amount}`,
    `账单日期：${currentBill.bill_date || '未识别'}`,
    `账单分类：${currentBill.category_name || '未分类'}`,
    `备注说明：${currentBill.remark || '无'}`,
  ].join('\n')
}

function buildPrompt(detail) {
  const currentBill = buildCurrentBillSummary(detail)

  return [
    '你是一名专业的账单合理性评审助手。',
    '请只根据当前账单的商户名称、金额、日期、分类、备注和明细进行判断。',
    '不要复述输入，不要输出 Markdown，不要解释推理过程，不要输出 JSON 以外的内容。',
    '请重点判断：这笔支出是否异常、在同类日常消费中偏低/正常/偏高、是否属于必要支出、是否超过提醒金额。',
    '',
    '当前账单概览：',
    buildUserInputSummary(currentBill),
    '',
    '当前账单数据：',
    JSON.stringify(currentBill),
    '',
    '请严格返回 JSON：',
    JSON.stringify({
      risk_level: 'LOW|MEDIUM|HIGH',
      review_conclusion: 'PASS|NEEDS_CONFIRM|NEEDS_REVIEW',
      review_summary: '只写一两句，开头必须是“无异常”或“有异常”',
      comparison_text: '一句话说明该笔消费在该类花销中怎么样、是否必要、是否超过提醒金额',
      analysis_text: '一句简短补充，可与 comparison_text 接近',
      review_suggestions: ['一句简短中文建议'],
    }),
    '',
    '补充要求：',
    '1. review_summary 必须很短，只要一两句。',
    '2. 如果整体正常，review_summary 以“无异常”开头。',
    '3. 如果金额偏高、非必要或明显超出常见范围，review_summary 以“有异常”开头。',
    '4. comparison_text 必须同时包含：该类花销水平、是否必要、是否超过提醒金额。',
    '5. review_suggestions 只返回 1 条简短建议。',
    '6. 不要返回 null，不要输出 JSON 以外的内容。',
  ].join('\n')
}

function stripMarkdownFence(text) {
  return safeTrim(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
}

function extractJsonText(text) {
  const cleaned = stripMarkdownFence(text)
  if (!cleaned) return ''

  try {
    JSON.parse(cleaned)
    return cleaned
  } catch (error) {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return ''
    return cleaned.slice(start, end + 1)
  }
}

function safeJsonParse(text) {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch (error) {
    return null
  }
}

function safeJsonStringify(value) {
  if (typeof value === 'string') return value
  if (value === undefined) return ''

  try {
    return JSON.stringify(value)
  } catch (error) {
    return ''
  }
}

function looksLikeReviewPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return [
    'review_summary',
    'review_conclusion',
    'risk_level',
    'comparison_text',
    'analysis_text',
    'review_suggestions',
  ].some((key) => value[key] !== undefined && value[key] !== null)
}

function summarizeResponsePayload(payload) {
  if (!payload) return { type: typeof payload, empty: true }

  if (typeof payload === 'string') {
    return {
      type: 'string',
      preview: safeTrim(payload).slice(0, 200),
    }
  }

  if (Array.isArray(payload)) {
    return {
      type: 'array',
      length: payload.length,
      firstItemType: payload[0] ? typeof payload[0] : 'undefined',
    }
  }

  if (typeof payload !== 'object') {
    return {
      type: typeof payload,
      preview: `${payload}`,
    }
  }

  const summary = {
    type: 'object',
    keys: Object.keys(payload).slice(0, 12),
  }

  if (Array.isArray(payload.choices)) {
    summary.choicesLength = payload.choices.length
    summary.firstChoiceKeys = payload.choices[0] ? Object.keys(payload.choices[0]).slice(0, 12) : []
    if (payload.choices[0] && payload.choices[0].message && typeof payload.choices[0].message === 'object') {
      summary.firstMessageKeys = Object.keys(payload.choices[0].message).slice(0, 12)
    }
  }

  return summary
}

function inferRiskLevelFromText(text) {
  const value = safeTrim(text)

  if (/有异常|超出|超标|明显偏高|偏高|过高|不合理|可疑/.test(value)) return 'HIGH'
  if (/提醒|建议确认|核实|偏多|略高|非必要/.test(value)) return 'MEDIUM'
  return 'LOW'
}

function buildFallbackReviewResult(text, requestMeta) {
  const reviewText = safeTrim(text)
  const riskLevel = inferRiskLevelFromText(reviewText)
  const reviewConclusion = normalizeReviewConclusion('', riskLevel)
  const shortSummary = reviewText.split(/\n+/).map((item) => safeTrim(item)).find(Boolean) || '无异常。'

  return sanitizeReviewPayload(normalizeReviewResult({
    risk_level: riskLevel,
    review_conclusion: reviewConclusion,
    review_summary: shortSummary,
    comparison_text: reviewText,
    analysis_text: reviewText,
    review_suggestions: [],
  }, reviewText, requestMeta))
}

function createSafeFallbackReviewResult(text, requestMeta) {
  const reviewText = safeTrim(text)
  const riskLevel = inferRiskLevelFromText(reviewText)
  const reviewConclusion = normalizeReviewConclusion('', riskLevel)
  const summaryLine = reviewText
    .split(/\n+/)
    .map((item) => safeTrim(item))
    .find((item) => item && !looksLikeRawJsonBlock(item))
  const shortSummary = extractLooseStringField(reviewText, 'review_summary') || summaryLine || '无异常'
  const visibleText = looksLikeRawJsonBlock(reviewText) ? '' : reviewText

  return sanitizeReviewPayload(normalizeReviewResult({
    risk_level: riskLevel,
    review_conclusion: reviewConclusion,
    review_summary: shortSummary,
    comparison_text: visibleText,
    analysis_text: visibleText || shortSummary,
    review_suggestions: [],
  }, reviewText, requestMeta))
}

function normalizeRiskLevel(value) {
  const next = safeTrim(value).toUpperCase()
  if (next === 'LOW' || next === 'MEDIUM' || next === 'HIGH') return next
  return 'MEDIUM'
}

function normalizeReviewConclusion(value, riskLevel) {
  const next = safeTrim(value).toUpperCase()
  if (next === 'PASS' || next === 'NEEDS_CONFIRM' || next === 'NEEDS_REVIEW') return next
  if (riskLevel === 'HIGH') return 'NEEDS_REVIEW'
  if (riskLevel === 'MEDIUM') return 'NEEDS_CONFIRM'
  return 'PASS'
}

function normalizeSuggestions(suggestions, riskLevel) {
  const list = Array.isArray(suggestions)
    ? suggestions.map((item) => safeTrim(item)).filter(Boolean)
    : []

  if (list.length) return list.slice(0, 1)
  if (riskLevel === 'HIGH') return ['建议重点核对金额和消费必要性']
  if (riskLevel === 'MEDIUM') return ['建议再确认这笔支出是否超出预期']
  return ['本次支出暂无明显异常']
}

function normalizeReviewResult(result, rawText, requestMeta) {
  const reviewSummary = safeTrim(result && result.review_summary) || '无异常。整体处于常见消费范围内。'
  const comparisonText =
    safeTrim(result && result.comparison_text) || '该笔支出接近该类日常水平，必要性一般，未明显超过提醒金额。'
  const analysisText = safeTrim(result && result.analysis_text) || reviewSummary
  const riskLevel = normalizeRiskLevel(result && result.risk_level)
  const reviewConclusion = normalizeReviewConclusion(result && result.review_conclusion, riskLevel)

  return {
    review_conclusion: reviewConclusion,
    risk_level: riskLevel,
    risk_tags: [],
    review_summary: reviewSummary,
    review_suggestions: normalizeSuggestions(result && result.review_suggestions, riskLevel),
    requires_manual_check: reviewConclusion === 'NEEDS_REVIEW',
    rule_hits: [],
    review_source: 'AI',
    comparison_text: comparisonText,
    analysis_text: analysisText,
    raw_ai_text: safeTrim(safeJsonStringify(rawText)),
    request_meta: {
      ...(requestMeta || {}),
    },
  }
}

function sanitizeReviewSuggestions(suggestions, riskLevel) {
  const list = Array.isArray(suggestions)
    ? suggestions.map((item) => safeTrim(item)).filter((item) => item && !isPlaceholderText(item))
    : []

  if (list.length) return list.slice(0, 1)
  return normalizeSuggestions([], riskLevel)
}

function sanitizeReviewPayload(review) {
  const current = review || {}
  const riskLevel = normalizeRiskLevel(current.risk_level)
  const reviewConclusion = normalizeReviewConclusion(current.review_conclusion, riskLevel)
  const reviewSummary = pickMeaningfulText(
    current.review_summary,
    '本次支出暂无明显异常，可结合日常消费情况继续关注。'
  )
  const comparisonText = pickMeaningfulText(
    current.comparison_text,
    '该笔支出已完成基础对比，建议结合近期同类消费水平综合判断。'
  )
  const analysisText = pickMeaningfulText(current.analysis_text, reviewSummary)

  return {
    ...current,
    risk_level: riskLevel,
    review_conclusion: reviewConclusion,
    review_summary: reviewSummary,
    comparison_text: comparisonText,
    analysis_text: analysisText,
    review_suggestions: sanitizeReviewSuggestions(current.review_suggestions, riskLevel),
    raw_ai_text: safeTrim(current.raw_ai_text),
  }
}

function parseAiBillReview(payload, requestMeta) {
  if (looksLikeReviewPayload(payload)) {
    return sanitizeReviewPayload(normalizeReviewResult(payload, payload, requestMeta))
  }

  const text = safeTrim(typeof payload === 'string' ? payload : extractAiReply(payload))
  const jsonText = extractJsonText(text)
  const parsed = safeJsonParse(jsonText)

  if (looksLikeReviewPayload(parsed)) {
    return sanitizeReviewPayload(normalizeReviewResult(parsed, text, requestMeta))
  }

  const looseParsed = extractLooseReviewPayload(text)
  if (looksLikeReviewPayload(looseParsed)) {
    return sanitizeReviewPayload(normalizeReviewResult(looseParsed, text, requestMeta))
  }

  if (text) {
    return createSafeFallbackReviewResult(text, requestMeta)
  }

  throw new Error('AI 没有返回可解析的账单评审内容')
}

function createAiReviewHttpRequest(options) {
  const settings = options || {}
  let requestTask = null
  let settled = false

  function safeResolve(resolve, value) {
    if (settled) return
    settled = true
    resolve(value)
  }

  function safeReject(reject, error) {
    if (settled) return
    settled = true
    reject(error)
  }

  const promise = new Promise((resolve, reject) => {
    requestTask = wx.request({
      url: settings.url,
      method: 'POST',
      timeout: settings.timeout,
      header: {
        Accept: 'application/json',
        ...(settings.header || {}),
      },
      data: settings.data,
      success(response) {
        const normalized = normalizeResponseBody(response && response.data)
        const statusCode = Number(response && response.statusCode) || 0
        if (statusCode < 200 || statusCode >= 300) {
          safeReject(reject, new Error(buildAiHttpErrorMessage(statusCode, normalized.payload || normalized.rawText || (response && response.data))))
          return
        }

        safeResolve(resolve, {
          statusCode,
          data: normalized.payload || (response && response.data),
          text: normalized.text || extractAiReply(normalized.payload || (response && response.data)),
          rawText: normalized.rawText || '',
          streamed: false,
        })
      },
      fail(error) {
        safeReject(reject, error)
      },
    })
  })

  return {
    promise,
    abort() {
      if (requestTask && typeof requestTask.abort === 'function') {
        requestTask.abort()
      }
    },
  }
}

function createAiBillReviewRequest(options) {
  const settings = options || {}
  const config = readAiConfig()
  const validationError = validateAiConfig(config)

  if (validationError) {
    throw new Error(validationError)
  }

  const headers = {
    'Content-Type': 'application/json',
  }

  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`
  }

  const requestUrl = buildAiRequestUrl(config)
  const timeout = BILL_REVIEW_TIMEOUT
  const prompt = buildPrompt(settings.detail)
  const requestMeta = {
    requestUrl,
    requestModel: config.apiModel,
    timeout,
    startedAt: Date.now(),
  }

  console.info('[AI Bill Review] request start', {
    url: requestMeta.requestUrl,
    model: requestMeta.requestModel,
    timeout: requestMeta.timeout,
    billId: settings && settings.detail && settings.detail.bill && settings.detail.bill._id,
  })

  const baseRequest = createAiReviewHttpRequest({
    url: requestUrl,
    timeout,
    header: headers,
    data: {
      model: config.apiModel,
      messages: [
        {
          role: 'system',
          content: '你是一个只返回 JSON 的账单合理性评审助手。输出必须简短自然，适合直接展示给用户。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 400,
    },
  })

  return {
    ...baseRequest,
    timeout,
    requestMeta,
    promise: baseRequest.promise
      .then((response) => {
        const finishedMeta = {
          ...requestMeta,
          finishedAt: Date.now(),
          httpStatus: response && response.statusCode,
        }

        const responsePayload = response && response.data
        const finalText = safeTrim((response && response.text) || extractAiReply(responsePayload))

        if (!finalText && !looksLikeReviewPayload(responsePayload)) {
          console.warn('[AI Bill Review] empty ai text', {
            url: finishedMeta.requestUrl,
            model: finishedMeta.requestModel,
            statusCode: finishedMeta.httpStatus,
            responseSummary: summarizeResponsePayload(responsePayload),
          })
          throw new Error('AI 没有返回可用的账单评审内容')
        }

        console.info('[AI Bill Review] request success', {
          url: finishedMeta.requestUrl,
          model: finishedMeta.requestModel,
          statusCode: finishedMeta.httpStatus,
        })

        return parseAiBillReview(responsePayload || finalText, finishedMeta)
      })
      .catch((error) => {
        requestMeta.finishedAt = Date.now()
        console.error('[AI Bill Review] request failed', {
          url: requestMeta.requestUrl,
          model: requestMeta.requestModel,
          message: (error && (error.message || error.errMsg)) || '',
        })
        throw error
      }),
  }
}

module.exports = {
  createAiBillReviewRequest,
}
