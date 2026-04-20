const { ensureSession } = require('./permission')
const billService = require('./bill-service')
const { readAiConfig, validateAiConfig, buildAiRequestUrl } = require('./ai-config')
const { normalizeAiRequestError } = require('./ai-error')
const { createAiStreamRequest, extractAiReply, isAbortError } = require('./ai-stream')

const AI_CHAT_KEY_PREFIX = 'lianlian_ai_consult_chat_v2'
const MAX_CHAT_MESSAGES = 40
const STREAM_MIN_TIMEOUT = 120000
const EMPTY_STREAM_PLACEHOLDER = '正在连接 AI...'
const DEFAULT_WELCOME_MESSAGE = '你好，我是账单 AI 助手。你可以直接问我某个月花了多少钱、哪类支出最多，或者让我按分类帮你整理账单。'
const SYSTEM_PROMPT = [
  '你是一个面向普通用户的账单分析助手。',
  '回答必须简洁、自然、结构清晰。',
  '不要输出 JSON、字段名、英文代码、对象结构、原始编号、图片编号或内部分析过程。',
  '只输出最终给用户看的回答，不要输出思考过程、推理内容、检查步骤、自我提示或中间草稿。',
  '如果涉及多笔消费，优先按分类分组展示。',
].join('\n')

const AI_CATEGORY_LABELS = {
  food: '餐饮',
  transport: '出行',
  groceries: '商超',
  daily: '日用',
  uncategorized: '其他',
}

function createMessageId(suffix) {
  const seed = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
  return suffix ? `m_${seed}_${suffix}` : `m_${seed}`
}

function createWelcomeMessage(content) {
  return {
    id: createMessageId('welcome'),
    role: 'assistant',
    content: content || DEFAULT_WELCOME_MESSAGE,
    createdAt: Date.now(),
  }
}

function isGreetingQuestion(question) {
  const text = `${question || ''}`.trim().toLowerCase()
  if (!text) return false

  return [
    '你好',
    '您好',
    '嗨',
    'hi',
    'hello',
    'hello!',
    'hi!',
    '在吗',
    '在么',
    '哈喽',
  ].includes(text)
}

function buildGreetingReply() {
  return '你好呀，我在。你可以直接问我某个月花销、哪类支出最多，或者让我按分类整理账单。'
}

function pad2(num) {
  return `${num}`.padStart(2, '0')
}

function normalizeMonthKey(year, month) {
  const monthNum = Number(month)
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return ''
  return `${year}-${pad2(monthNum)}`
}

function chineseMonthToNumber(text) {
  const map = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }

  if (!text) return 0
  if (text === '十') return 10
  if (text === '十一') return 11
  if (text === '十二') return 12
  if (text.startsWith('十')) return 10 + (map[text[1]] || 0)
  if (text.endsWith('十')) return (map[text[0]] || 0) * 10
  if (text.includes('十')) {
    const [left, right] = text.split('十')
    return (map[left] || 0) * 10 + (map[right] || 0)
  }

  return map[text] || 0
}

function parseMonthMentions(question) {
  const result = []
  const text = question || ''

  const numericRegex = /(?:(\d{4})\s*年)?\s*(1[0-2]|0?[1-9])\s*月/g
  let match = numericRegex.exec(text)
  while (match) {
    result.push({
      year: match[1] ? Number(match[1]) : 0,
      month: Number(match[2]),
    })
    match = numericRegex.exec(text)
  }

  const chineseRegex = /(?:(\d{4})\s*年)?\s*([一二三四五六七八九十]{1,3})\s*月/g
  match = chineseRegex.exec(text)
  while (match) {
    const monthNum = chineseMonthToNumber(match[2])
    if (monthNum >= 1 && monthNum <= 12) {
      result.push({
        year: match[1] ? Number(match[1]) : 0,
        month: monthNum,
      })
    }
    match = chineseRegex.exec(text)
  }

  return result
}

function parseRelativeMonth(question, availableMonthKeys) {
  const text = question || ''
  if (!availableMonthKeys.length) return []

  const now = new Date()
  const thisMonth = normalizeMonthKey(now.getFullYear(), now.getMonth() + 1)
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonth = normalizeMonthKey(previousDate.getFullYear(), previousDate.getMonth() + 1)
  const result = []

  if (text.includes('本月') && availableMonthKeys.includes(thisMonth)) {
    result.push(thisMonth)
  }

  if (text.includes('上月') && availableMonthKeys.includes(previousMonth)) {
    result.push(previousMonth)
  }

  return result
}

function resolveTargetMonths(question, availableMonthKeys) {
  const keys = [...availableMonthKeys].sort()
  const matched = []

  parseMonthMentions(question).forEach((item) => {
    if (item.year) {
      const fullKey = normalizeMonthKey(item.year, item.month)
      if (fullKey && keys.includes(fullKey)) matched.push(fullKey)
      return
    }

    const monthSuffix = `-${pad2(item.month)}`
    const latestMatched = [...keys].reverse().find((key) => key.endsWith(monthSuffix))
    if (latestMatched) matched.push(latestMatched)
  })

  parseRelativeMonth(question, keys).forEach((key) => matched.push(key))

  const unique = Array.from(new Set(matched))
  return unique.length ? unique : keys
}

function buildChatStorageKey(userId) {
  return `${AI_CHAT_KEY_PREFIX}_${userId}`
}

function clearChatStorage(userId) {
  if (!userId) return
  wx.removeStorageSync(buildChatStorageKey(userId))
}

function getAiLabel(map, value) {
  return map[value] || value || ''
}

function formatAiAmount(amount) {
  const value = Number(amount || 0)
  if (!Number.isFinite(value)) return '0元'
  return `${Number(value.toFixed(2))}元`
}

function buildAiCategorySummary(bills) {
  const summaryMap = {}

  ;(bills || []).forEach((bill) => {
    const label = getAiLabel(AI_CATEGORY_LABELS, bill.category_code) || '其他'
    const amount = Number(bill.actual_amount || bill.total_amount || 0)
    if (!summaryMap[label]) {
      summaryMap[label] = {
        label,
        count: 0,
        amount: 0,
      }
    }

    summaryMap[label].count += 1
    summaryMap[label].amount += amount
  })

  return Object.keys(summaryMap)
    .map((key) => ({
      label: summaryMap[key].label,
      count: summaryMap[key].count,
      amount: Number(summaryMap[key].amount.toFixed(2)),
    }))
    .sort((a, b) => b.amount - a.amount)
}

function normalizeMonthlyJsonListForAi(monthlyJsonList) {
  return (monthlyJsonList || []).map((monthItem) => ({
    month: monthItem.month || '',
    billCount: Number(monthItem.bill_count || 0),
    totalAmount: Number(monthItem.total_amount || 0),
    categorySummary: buildAiCategorySummary(monthItem.bills || []),
    bills: (monthItem.bills || []).map((bill) => ({
      date: bill.bill_date || '',
      merchant: bill.merchant_name || '',
      category: getAiLabel(AI_CATEGORY_LABELS, bill.category_code) || '其他',
      amount: Number(bill.actual_amount || bill.total_amount || 0),
    })),
  }))
}

function buildPromptDataText(monthlyJsonList) {
  return (monthlyJsonList || []).map((monthItem) => {
    const summaryLines = (monthItem.categorySummary || []).map((item) => (
      `- ${item.label}：${item.count}笔，${formatAiAmount(item.amount)}`
    ))

    const groupedBills = {}
    ;(monthItem.bills || []).forEach((bill) => {
      const label = bill.category || '其他'
      if (!groupedBills[label]) groupedBills[label] = []
      groupedBills[label].push(bill)
    })

    const detailLines = Object.keys(groupedBills).map((label) => {
      const entries = groupedBills[label]
        .slice()
        .sort((a, b) => {
          if (`${a.date}` !== `${b.date}`) return `${a.date}`.localeCompare(`${b.date}`)
          return b.amount - a.amount
        })
        .map((bill) => `- ${bill.date || '未识别日期'}，${bill.merchant || '未识别商户'}，${formatAiAmount(bill.amount)}`)

      return `${label}类：\n${entries.join('\n')}`
    })

    return [
      `月份：${monthItem.month}`,
      `总览：共${monthItem.billCount}笔，总金额${formatAiAmount(monthItem.totalAmount)}`,
      '分类汇总：',
      summaryLines.length ? summaryLines.join('\n') : '- 暂无分类数据',
      '分类明细：',
      detailLines.length ? detailLines.join('\n\n') : '- 暂无明细',
    ].join('\n')
  }).join('\n\n')
}

function buildPrompt(question, availableMonths, matchedMonths, monthlyJsonList) {
  return [
    '你是账单分析助手，请根据给定的账单数据直接回答用户问题。',
    `用户问题：${question}`,
    `可用月份：${availableMonths.join('、')}`,
    `本次使用月份：${matchedMonths.join('、')}`,
    '账单资料：',
    buildPromptDataText(monthlyJsonList),
    '回答要求：',
    '1. 只用自然中文，不要提 JSON、字段名、代码、数据结构、内部分析过程。',
    '2. 不要输出英文分类、英文状态、长串编号、图片编号、对象键名或原始数组内容。',
    '3. 只输出最终答案，不要输出思考过程、推理记录、自检文字、草稿内容，避免出现“首先”“然后”“我来分析”“现在开始整理”等中间过程话术。',
    '4. 如果问题涉及多笔账单或消费构成，优先按“分类明细”格式回答。',
    '5. 输出尽量简洁，先给一句总结，再按分类列出明细，不要写成长段分析。',
    '6. 每条明细必须只保留“日期，商户，金额”这三个信息。',
    '7. 分类标题格式固定为“餐饮类：”“商超类：”“出行类：”这种形式。',
    '8. 明细项目格式固定为“- 2026-04-05，海底捞，568元”这种形式。',
    '9. 没有数据的分类不要输出。',
    '10. 除非用户明确要求，不要输出风险判断、建议措施、下一步操作。',
    '11. 如果用户只是问某月花销情况，优先按下面样式回答：',
    '本月主要支出集中在餐饮和商超。',
    '分类明细：',
    '餐饮类：',
    '- 2026-04-05，海底捞，568元',
    '- 2026-04-13，Manner Coffee，38元',
    '',
    '商超类：',
    '- 2026-04-11，盒马鲜生，318.8元',
    '',
    '出行类：',
    '- 2026-04-12，滴滴出行，126.5元',
  ].join('\n\n')
}

function createAiConsultPage(options) {
  const settings = options || {}
  const welcomeText = settings.welcomeMessage || DEFAULT_WELCOME_MESSAGE

  return {
    data: {
      session: null,
      inputText: '',
      messages: [],
      loading: false,
      scrollToId: '',
      streamingMessageId: '',
    },

    onShow() {
      this._pageLeaving = false
      const session = ensureSession('USER')
      if (!session) return

      const storageKey = buildChatStorageKey(session.user._id)
      let messages = wx.getStorageSync(storageKey) || []
      if (!messages.length) messages = [createWelcomeMessage(welcomeText)]

      this.setData({
        session,
        messages,
        loading: false,
        streamingMessageId: '',
        scrollToId: messages[messages.length - 1].id,
      })
    },

    onHide() {
      this.leaveCurrentPage()
    },

    onUnload() {
      this.leaveCurrentPage()
    },

    handleInput(event) {
      this.setData({ inputText: event.detail.value })
    },

    goBackHome() {
      this.leaveCurrentPage()
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.reLaunch({ url: '/page/component/index' })
        },
      })
    },

    saveMessages(messages) {
      const { session } = this.data
      if (!session) return
      wx.setStorageSync(buildChatStorageKey(session.user._id), messages)
    },

    syncMessages(messages, options) {
      const nextOptions = options || {}
      const lastMessage = messages[messages.length - 1]

      this.setData({
        messages,
        scrollToId: lastMessage ? lastMessage.id : '',
      })

      if (nextOptions.persist !== false) {
        this.saveMessages(messages)
      }
    },

    appendMessage(message, options) {
      const messages = [...this.data.messages, message].slice(-MAX_CHAT_MESSAGES)
      this.syncMessages(messages, options)
    },

    updateMessageContent(messageId, content, options) {
      const messages = this.data.messages.map((item) => (
        item.id === messageId ? { ...item, content } : item
      ))
      this.syncMessages(messages, options)
    },

    clearCurrentChat() {
      const { session } = this.data
      if (!session) return

      clearChatStorage(session.user._id)
      const welcomeMessage = createWelcomeMessage(welcomeText)

      this.setData({
        inputText: '',
        messages: [welcomeMessage],
        loading: false,
        streamingMessageId: '',
        scrollToId: welcomeMessage.id,
      })
    },

    abortCurrentRequest() {
      if (!this._activeAiRequest) return
      const currentRequest = this._activeAiRequest
      this._activeAiRequest = null
      if (typeof currentRequest.abort === 'function') {
        currentRequest.abort()
      }
    },

    leaveCurrentPage() {
      if (this._pageLeaving) return
      this._pageLeaving = true
      this.abortCurrentRequest()
      this.clearCurrentChat()
    },

    async submitConsult() {
      const { session, inputText, loading } = this.data
      if (!session || loading) return

      const question = `${inputText || ''}`.trim()
      if (!question) {
        wx.showToast({
          title: '请输入咨询内容',
          icon: 'none',
        })
        return
      }

      if (isGreetingQuestion(question)) {
        const userMessage = {
          id: createMessageId('user'),
          role: 'user',
          content: question,
          createdAt: Date.now(),
        }
        const assistantMessage = {
          id: createMessageId('assistant'),
          role: 'assistant',
          content: buildGreetingReply(),
          createdAt: Date.now(),
        }

        this.appendMessage(userMessage)
        this.appendMessage(assistantMessage)
        this.setData({
          inputText: '',
          loading: false,
          streamingMessageId: '',
        })
        return
      }

      const config = readAiConfig()
      const validationError = validateAiConfig(config)
      if (validationError) {
        wx.showModal({
          title: 'AI 配置未完成',
          content: `${validationError}。请先在首页右上角设置里保存 AI API 配置。`,
          showCancel: false,
        })
        return
      }

      const monthlyMap = billService.getUserMonthlyBillJson(session.user._id)
      const availableMonths = Object.keys(monthlyMap).sort()
      if (!availableMonths.length) {
        wx.showToast({
          title: '当前暂无账单数据',
          icon: 'none',
        })
        return
      }

      const matchedMonths = resolveTargetMonths(question, availableMonths)
      const monthlyJsonList = matchedMonths
        .map((key) => monthlyMap[key])
        .filter(Boolean)

      const userMessage = {
        id: createMessageId('user'),
        role: 'user',
        content: question,
        createdAt: Date.now(),
      }
      const assistantMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        content: EMPTY_STREAM_PLACEHOLDER,
        createdAt: Date.now(),
      }

      this.appendMessage(userMessage)
      this.appendMessage(assistantMessage, { persist: false })
      this.setData({
        inputText: '',
        loading: true,
        streamingMessageId: assistantMessage.id,
      })

      const prompt = buildPrompt(
        question,
        availableMonths,
        matchedMonths,
        normalizeMonthlyJsonListForAi(monthlyJsonList)
      )
      const headers = {
        'Content-Type': 'application/json',
      }
      const requestTimeout = Math.max(Number(config.apiTimeout) || 0, STREAM_MIN_TIMEOUT)
      let latestStreamText = ''

      if (config.apiToken) {
        headers.Authorization = `Bearer ${config.apiToken}`
      }

      const request = createAiStreamRequest({
        url: buildAiRequestUrl(config),
        timeout: requestTimeout,
        header: headers,
        data: {
          model: config.apiModel,
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
        },
        onText: (streamedText) => {
          if (!streamedText) return
          latestStreamText = streamedText
          this.updateMessageContent(assistantMessage.id, streamedText, { persist: false })
        },
      })

      this._activeAiRequest = request

      try {
        const response = await request.promise
        if (this._pageLeaving) return

        const finalText = (response && response.text) || extractAiReply(response && response.data)
        if (!finalText) {
          throw new Error('AI 接口已返回响应，但结果内容为空，请检查返回格式是否兼容')
        }

        this.updateMessageContent(assistantMessage.id, finalText, { persist: true })
      } catch (error) {
        if (this._pageLeaving && isAbortError(error)) return
        if (isAbortError(error)) return

        const streamedText = latestStreamText || request.getStreamedText()
        const errorMessage = normalizeAiRequestError(error, requestTimeout)
        const nextContent = streamedText
          ? `${streamedText}\n\n[连接已中断：${errorMessage}]`
          : `请求失败：${errorMessage}`

        this.updateMessageContent(assistantMessage.id, nextContent, { persist: true })
      } finally {
        if (this._activeAiRequest === request) {
          this._activeAiRequest = null
        }

        if (!this._pageLeaving) {
          this.setData({
            loading: false,
            streamingMessageId: '',
          })
        }
      }
    },
  }
}

module.exports = {
  createAiConsultPage,
}
