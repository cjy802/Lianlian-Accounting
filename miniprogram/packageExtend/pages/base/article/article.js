const { createAiConsultPage } = require('../../../../util/ai-consult-page')

Page(createAiConsultPage({
  welcomeMessage: '你好，我是账单 AI 助手。你可以直接问我“五月份花费最多的是哪一笔”这类问题，我会结合账单数据给你分析。',
}))
