const AI_CONFIG_KEY = 'lianlian_ai_api_config_v1'
const LEGACY_CONFIG_KEY = 'lianlian_api_config_v1'
const DEFAULT_TIMEOUT = 60000
const MIN_TIMEOUT = 1000
const MAX_TIMEOUT = 120000
const FORCE_HARDCODED_CONFIG = true

function getDefaultAiConfig() {
  return {
    apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiPath: '/chat/completions',
    apiToken: '',
    apiModel: 'GLM-4.6V-FlashX',
    apiTimeout: `${DEFAULT_TIMEOUT}`,
  }
}

function normalizeBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '')
}

function normalizePath(path) {
  const next = (path || '').trim()
  if (!next) return '/chat/completions'
  if (/^https?:\/\//i.test(next)) return next
  return next.startsWith('/') ? next : `/${next}`
}

function normalizeTimeout(timeout) {
  const value = Number(timeout)
  if (!Number.isFinite(value)) return `${DEFAULT_TIMEOUT}`
  const clamped = Math.min(MAX_TIMEOUT, Math.max(MIN_TIMEOUT, Math.round(value)))
  return `${clamped}`
}

function readAiConfig() {
  const defaults = getDefaultAiConfig()
  if (FORCE_HARDCODED_CONFIG) {
    return defaults
  }

  const saved = wx.getStorageSync(AI_CONFIG_KEY) || {}
  const legacy = wx.getStorageSync(LEGACY_CONFIG_KEY) || {}

  return {
    apiBaseUrl: normalizeBaseUrl(saved.apiBaseUrl || saved.baseUrl || legacy.baseUrl || defaults.apiBaseUrl),
    apiPath: normalizePath(saved.apiPath || legacy.apiPath || defaults.apiPath),
    apiToken: (saved.apiToken || legacy.apiToken || defaults.apiToken || '').trim(),
    apiModel: (saved.apiModel || legacy.apiModel || defaults.apiModel || '').trim(),
    apiTimeout: normalizeTimeout(saved.apiTimeout || saved.timeout || legacy.timeout || defaults.apiTimeout),
  }
}

function validateAiConfig(config) {
  const apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl)
  const apiPath = normalizePath(config.apiPath)
  const apiModel = (config.apiModel || '').trim()
  const timeout = Number(config.apiTimeout)

  if (!apiBaseUrl && !/^https?:\/\//i.test(apiPath)) return '请先填写 API 地址'
  if (apiBaseUrl && !/^https?:\/\//i.test(apiBaseUrl)) return 'API 地址必须以 http:// 或 https:// 开头'
  if (!apiPath) return '请先填写接口路径'
  if (!apiModel) return '请先填写模型名称'
  if (!Number.isFinite(timeout) || timeout < MIN_TIMEOUT || timeout > MAX_TIMEOUT) {
    return `超时时间必须在 ${MIN_TIMEOUT}-${MAX_TIMEOUT}ms 之间`
  }

  return ''
}

function saveAiConfig(config) {
  const next = {
    apiBaseUrl: normalizeBaseUrl(config.apiBaseUrl),
    apiPath: normalizePath(config.apiPath),
    apiToken: (config.apiToken || '').trim(),
    apiModel: (config.apiModel || '').trim(),
    apiTimeout: normalizeTimeout(config.apiTimeout),
    updatedAt: Date.now(),
  }

  wx.setStorageSync(AI_CONFIG_KEY, next)
  return FORCE_HARDCODED_CONFIG ? getDefaultAiConfig() : next
}

function buildAiRequestUrl(config) {
  const path = normalizePath(config.apiPath)
  if (/^https?:\/\//i.test(path)) return path
  return `${normalizeBaseUrl(config.apiBaseUrl)}${path}`
}

module.exports = {
  AI_CONFIG_KEY,
  getDefaultAiConfig,
  readAiConfig,
  saveAiConfig,
  validateAiConfig,
  buildAiRequestUrl,
}
