const { buildAiHttpErrorMessage } = require('./ai-error')

function isReasoningKey(key) {
  return /reasoning|analysis/i.test(`${key || ''}`)
}

function extractTextFromContent(content, depth = 0) {
  if (!content || depth > 6) return ''
  if (typeof content === 'string') return content.trim()

  if (Array.isArray(content)) {
    return content
      .filter((item) => !(item && typeof item === 'object' && /reasoning/i.test(`${item.type || ''}`)))
      .map((item) => extractTextFromContent(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (typeof content !== 'object') return ''

  if (/reasoning/i.test(`${content.type || ''}`)) return ''
  if (typeof content.text === 'string') return content.text.trim()
  if (typeof content.output_text === 'string') return content.output_text.trim()
  if (typeof content.answer === 'string') return content.answer.trim()
  if (typeof content.content === 'string') return content.content.trim()

  const preferredValues = [
    content.content,
    content.message,
    content.delta,
    content.response,
    content.result,
    content.data,
    content.output,
  ]

  for (let index = 0; index < preferredValues.length; index += 1) {
    const nextText = extractTextFromContent(preferredValues[index], depth + 1)
    if (nextText) return nextText
  }

  if (Array.isArray(content.choices)) {
    const choiceText = content.choices
      .map((item) => extractTextFromContent(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim()
    if (choiceText) return choiceText
  }

  const keyedText = Object.keys(content)
    .filter((key) => !isReasoningKey(key))
    .filter((key) => /text|content|answer|message|delta|output|result|response/i.test(key))
    .map((key) => extractTextFromContent(content[key], depth + 1))
    .find(Boolean)
  if (keyedText) return keyedText

  return Object.keys(content)
    .filter((key) => !isReasoningKey(key))
    .map((key) => extractTextFromContent(content[key], depth + 1))
    .find(Boolean) || ''
}

function extractAiReply(payload) {
  if (!payload) return ''
  if (typeof payload === 'string') return payload.trim()

  if (payload.choices && payload.choices[0]) {
    const choice = payload.choices[0]
    const messageText = extractTextFromContent(choice.message && (
      choice.message.content ||
      choice.message.output_text ||
      choice.message.text ||
      choice.message.answer
    ))
    if (messageText) return messageText

    const deltaText = extractTextFromContent(choice.delta && (
      choice.delta.content ||
      choice.delta.output_text ||
      choice.delta.text ||
      choice.delta.answer
    ))
    if (deltaText) return deltaText

    const choiceText = extractTextFromContent(choice.content)
    if (choiceText) return choiceText
  }

  return extractTextFromContent(payload)
}

function extractDeltaText(payload) {
  if (!payload || !payload.choices || !payload.choices[0]) return ''

  const delta = payload.choices[0].delta
  if (delta) {
    if (typeof delta.content === 'string') return delta.content
    if (Array.isArray(delta.content)) return extractTextFromContent(delta.content)
    if (typeof delta.output_text === 'string') return delta.output_text
    if (typeof delta.text === 'string') return delta.text
    if (typeof delta.answer === 'string') return delta.answer
  }

  return ''
}

function safeJsonParse(text) {
  if (typeof text !== 'string') return null

  try {
    return JSON.parse(text)
  } catch (error) {
    return null
  }
}

function isArrayBuffer(data) {
  return typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer
}

function toUint8Array(data) {
  if (isArrayBuffer(data)) return new Uint8Array(data)

  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }

  return null
}

function decodeUtf8Bytes(bytes) {
  if (typeof TextDecoder === 'function') {
    return new TextDecoder('utf-8').decode(bytes)
  }

  let encoded = ''
  for (let index = 0; index < bytes.length; index += 1) {
    encoded += `%${bytes[index].toString(16).padStart(2, '0')}`
  }

  try {
    return decodeURIComponent(encoded)
  } catch (error) {
    return Array.from(bytes)
      .map((item) => String.fromCharCode(item))
      .join('')
  }
}

function decodeRawText(data) {
  if (typeof data === 'string') return data

  const bytes = toUint8Array(data)
  if (bytes) return decodeUtf8Bytes(bytes)

  return ''
}

function concatUint8Arrays(chunks) {
  const totalLength = chunks.reduce((sum, item) => sum + item.byteLength, 0)
  const merged = new Uint8Array(totalLength)

  let offset = 0
  chunks.forEach((item) => {
    merged.set(item, offset)
    offset += item.byteLength
  })

  return merged
}

function takeNextSseBlock(state) {
  const plainBoundary = state.buffer.indexOf('\n\n')
  const crlfBoundary = state.buffer.indexOf('\r\n\r\n')

  let boundaryIndex = -1
  let boundaryLength = 0

  if (plainBoundary !== -1) {
    boundaryIndex = plainBoundary
    boundaryLength = 2
  }

  if (crlfBoundary !== -1 && (boundaryIndex === -1 || crlfBoundary < boundaryIndex)) {
    boundaryIndex = crlfBoundary
    boundaryLength = 4
  }

  if (boundaryIndex === -1) return ''

  const block = state.buffer.slice(0, boundaryIndex)
  state.buffer = state.buffer.slice(boundaryIndex + boundaryLength)
  return block
}

function extractSseData(block) {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^\s*/, ''))
    .join('\n')
    .trim()
}

function parseSseText(rawText) {
  const state = { buffer: rawText || '' }
  let text = ''
  let lastPayload = null

  let block = takeNextSseBlock(state)
  while (block) {
    const eventData = extractSseData(block)
    if (eventData && eventData !== '[DONE]') {
      const payload = safeJsonParse(eventData)
      if (payload) {
        lastPayload = payload
        text += extractDeltaText(payload)
      }
    }

    block = takeNextSseBlock(state)
  }

  return {
    text,
    lastPayload,
  }
}

function normalizeResponseBody(data) {
  const isTypedArray = typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(data)

  if (data && typeof data === 'object' && !isArrayBuffer(data) && !isTypedArray) {
    return {
      payload: data,
      text: extractAiReply(data),
      rawText: '',
    }
  }

  const rawText = decodeRawText(data)
  if (!rawText) {
    return {
      payload: data,
      text: '',
      rawText: '',
    }
  }

  if (rawText.includes('data:')) {
    const streamResult = parseSseText(rawText)
    return {
      payload: streamResult.lastPayload,
      text: streamResult.text,
      rawText,
    }
  }

  const payload = safeJsonParse(rawText)
  if (payload) {
    return {
      payload,
      text: extractAiReply(payload),
      rawText,
    }
  }

  return {
    payload: rawText,
    text: rawText.trim(),
    rawText,
  }
}

function isAbortError(error) {
  const message = `${(error && (error.errMsg || error.message)) || ''}`.toLowerCase()
  return message.includes('abort')
}

function createAiRequest(options) {
  const {
    url,
    timeout,
    header,
    data,
  } = options

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
      url,
      method: 'POST',
      timeout,
      header: {
        Accept: 'application/json',
        ...header,
      },
      data,
      success(response) {
        if (settled) return
        const normalized = normalizeResponseBody(response.data)
        const { statusCode } = response

        if (statusCode < 200 || statusCode >= 300) {
          safeReject(reject, new Error(buildAiHttpErrorMessage(statusCode, normalized.payload || normalized.rawText || response.data)))
          return
        }

        safeResolve(resolve, {
          statusCode,
          data: normalized.payload || response.data,
          text: normalized.text || extractAiReply(normalized.payload || response.data),
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

function createAiStreamRequest(options) {
  const {
    url,
    timeout,
    header,
    data,
    onText,
  } = options

  let requestTask = null
  let decodedLength = 0
  let streamedText = ''
  let lastPayload = null
  let settled = false
  const chunkBytes = []
  const sseState = { buffer: '' }

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
      url,
      method: 'POST',
      timeout,
      enableChunked: true,
      responseType: 'arraybuffer',
      header: {
        Accept: 'text/event-stream',
        ...header,
      },
      data: {
        ...data,
        stream: true,
      },
      success(response) {
        if (settled) return
        const normalized = normalizeResponseBody(response.data)
        const { statusCode } = response

        if (statusCode < 200 || statusCode >= 300) {
          safeReject(reject, new Error(buildAiHttpErrorMessage(statusCode, normalized.payload || normalized.rawText || response.data)))
          return
        }

        const finalPayload = lastPayload || normalized.payload
        const finalText = streamedText || normalized.text || extractAiReply(finalPayload)

        safeResolve(resolve, {
          statusCode,
          data: finalPayload || response.data,
          text: finalText,
          streamed: !!streamedText,
        })
      },
      fail(error) {
        safeReject(reject, error)
      },
    })

    if (!requestTask) return

    if (typeof requestTask.onHeadersReceived === 'function') {
      requestTask.onHeadersReceived((response) => {
        if (!response || settled) return

        const { statusCode } = response
        if (statusCode >= 200 && statusCode < 300) return

        safeReject(reject, new Error(buildAiHttpErrorMessage(statusCode)))

        if (typeof requestTask.abort === 'function') {
          requestTask.abort()
        }
      })
    }

    if (typeof requestTask.onChunkReceived !== 'function') return

    requestTask.onChunkReceived((event) => {
      if (settled) return
      const nextChunk = toUint8Array(event && event.data)
      if (!nextChunk || !nextChunk.byteLength) return

      chunkBytes.push(nextChunk)

      const decodedText = decodeUtf8Bytes(concatUint8Arrays(chunkBytes))
      const nextText = decodedText.slice(decodedLength)
      decodedLength = decodedText.length
      if (!nextText) return

      sseState.buffer += nextText

      let block = takeNextSseBlock(sseState)
      while (block) {
        const eventData = extractSseData(block)
        if (eventData && eventData !== '[DONE]') {
          const payload = safeJsonParse(eventData)
          if (payload) {
            lastPayload = payload
            const deltaText = extractDeltaText(payload)
            if (deltaText) {
              streamedText += deltaText
              if (typeof onText === 'function') {
                onText(streamedText, payload)
              }
            }
          }
        }

        block = takeNextSseBlock(sseState)
      }
    })
  })

  return {
    promise,
    getStreamedText() {
      return streamedText
    },
    abort() {
      if (requestTask && typeof requestTask.abort === 'function') {
        requestTask.abort()
      }
    },
  }
}

module.exports = {
  createAiRequest,
  createAiStreamRequest,
  extractAiReply,
  isAbortError,
  normalizeResponseBody,
}
