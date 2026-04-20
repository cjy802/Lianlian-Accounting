function extractServerErrorText(data) {
  if (typeof data === 'string') return data.slice(0, 120).trim()
  if (!data || typeof data !== 'object') return ''

  const candidates = [
    data.error && data.error.message,
    data.message,
    data.msg,
    data.detail,
  ]

  const matched = candidates.find((item) => typeof item === 'string' && item.trim())
  return matched ? matched.trim().slice(0, 120) : ''
}

function withDetail(baseMessage, detail) {
  if (!detail || detail === baseMessage) return baseMessage
  return `${baseMessage}：${detail}`
}

function buildAiHttpErrorMessage(statusCode, data) {
  const detail = extractServerErrorText(data)

  if (statusCode === 400) return withDetail('AI API 请求参数不正确，请检查模型、消息格式或接口参数', detail)
  if (statusCode === 401) return withDetail('AI API 鉴权失败，请检查 API Token 是否正确', detail)
  if (statusCode === 403) return withDetail('AI API 已拒绝访问，请检查账户权限、模型权限或接口白名单', detail)
  if (statusCode === 404) return withDetail('AI 接口地址不存在，请检查 API 地址和接口路径是否正确', detail)
  if (statusCode === 408) return withDetail('AI 接口响应超时，服务端长时间没有返回结果', detail)
  if (statusCode === 429) return withDetail('AI API 调用过于频繁，或当前账号额度/并发已受限，请稍后再试', detail)
  if (statusCode >= 500 && statusCode < 600) return withDetail('AI 服务端异常，请稍后重试', detail)

  return withDetail(`AI API 调用失败，HTTP ${statusCode}`, detail)
}

function normalizeAiRequestError(error, timeout) {
  const rawMessage = `${(error && (error.errMsg || error.message)) || ''}`.trim()
  const message = rawMessage.toLowerCase()
  const timeoutText = Number.isFinite(timeout) && timeout > 0 ? `${timeout}ms` : '当前超时设置'

  if (message.includes('timeout')) {
    return `AI 请求超时，${timeoutText} 内没有完成响应。请优先检查接口限流、模型是否可用，或把超时调大后重试`
  }

  if (message.includes('url not in domain list')) {
    return '请求域名不在小程序合法域名列表中，请把 AI 接口域名加入 request 合法域名'
  }

  if (message.includes('ssl') || message.includes('certificate')) {
    return 'HTTPS 证书校验失败，请检查接口证书是否完整且受小程序环境信任'
  }

  if (message.includes('abort')) {
    return '请求已取消'
  }

  if (
    message.includes('request:fail') ||
    message.includes('fail ') ||
    message.includes('unable to resolve host') ||
    message.includes('name not resolved') ||
    message.includes('connection') ||
    message.includes('network')
  ) {
    return '网络连接失败，请检查设备网络、接口域名是否可访问，以及小程序 request 域名配置'
  }

  if (rawMessage) {
    return `AI API 调用失败：${rawMessage}`
  }

  return 'AI API 调用失败，请稍后重试'
}

module.exports = {
  buildAiHttpErrorMessage,
  normalizeAiRequestError,
}
