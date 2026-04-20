const { getDb, updateDb, appendOperationLog, formatNow } = require('./mock-db')

const SESSION_KEY = 'lianlian_session_v2'
const DEFAULT_ROLE_CODE = 'USER'

function sanitizeUser(user) {
  const next = { ...user }
  delete next.password
  return next
}

function normalizeText(value) {
  return `${value || ''}`.trim()
}

function getRole(roleId, db) {
  return db.roles.find((item) => item._id === roleId)
}

function getDefaultRole(db) {
  return db.roles.find((item) => item.role_code === DEFAULT_ROLE_CODE) || db.roles[0]
}

function buildSession(user, role) {
  if (!role) {
    throw new Error('未找到可用的用户角色')
  }

  return {
    token: `mock-token-${user._id}-${Date.now()}`,
    user: sanitizeUser(user),
    role,
    permissions: role.permissions || [],
    landingPage: role.landing_page,
  }
}

function saveSession(session) {
  wx.setStorageSync(SESSION_KEY, session)
  return session
}

function ensureActiveUser(user) {
  if (!user) {
    throw new Error('用户不存在')
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('当前账号已被禁用或锁定')
  }
}

function createUserId() {
  return `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function buildGeneratedWechatAccount(openid, db) {
  const suffix = `${openid || ''}`.slice(-8) || `${Date.now()}`.slice(-8)
  let account = `wx_${suffix}`
  let index = 1

  while (db.users.some((item) => item.account === account)) {
    account = `wx_${suffix}_${index}`
    index += 1
  }

  return account
}

function withAuthMethod(user, method) {
  const authMethods = Array.isArray(user.auth_methods) ? user.auth_methods.slice() : []
  if (!authMethods.includes(method)) {
    authMethods.push(method)
  }
  return authMethods
}

function buildWechatUser(identity, profile, db) {
  const role = getDefaultRole(db)
  const now = formatNow()

  return {
    user: {
      _id: createUserId(),
      account: buildGeneratedWechatAccount(identity.openid, db),
      password: '',
      role_id: role._id,
      nickname: normalizeText(profile.nickName) || `微信用户${identity.openid.slice(-4)}`,
      phone: '',
      status: 'ACTIVE',
      last_login_at: now,
      updated_at: now,
      auth_methods: ['WECHAT'],
      wechat_openid: identity.openid,
      wechat_unionid: identity.unionid,
      wechat_nickname: normalizeText(profile.nickName),
      wechat_avatar: normalizeText(profile.avatarUrl),
    },
    role,
  }
}

function buildWechatProfileUpdate(identity, profile, existingUser, loginAt) {
  const wechatNickname = normalizeText(profile.nickName)
  const wechatAvatar = normalizeText(profile.avatarUrl)

  return {
    last_login_at: loginAt,
    updated_at: loginAt,
    auth_methods: withAuthMethod(existingUser, 'WECHAT'),
    wechat_unionid: identity.unionid || existingUser.wechat_unionid || '',
    wechat_nickname: wechatNickname || existingUser.wechat_nickname || '',
    wechat_avatar: wechatAvatar || existingUser.wechat_avatar || '',
    nickname: wechatNickname || existingUser.nickname,
  }
}

function runWxLogin() {
  return new Promise((resolve, reject) => {
    if (!wx.login) {
      reject(new Error('当前基础库不支持 wx.login'))
      return
    }

    wx.login({
      success: (res) => {
        if (!res.code) {
          reject(new Error('微信登录成功，但没有拿到 code'))
          return
        }
        resolve(res.code)
      },
      fail: (err) => {
        const detail = err && err.errMsg ? `：${err.errMsg}` : ''
        reject(new Error(`调用 wx.login 失败${detail}`))
      },
    })
  })
}

function callWxContext() {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.callFunction) {
      reject(new Error('当前未初始化云开发，请先确认 wx.cloud.init 已执行，并且当前云环境可用'))
      return
    }

    wx.cloud.callFunction({
      name: 'wxContext',
      data: {},
      success: (res) => resolve(res.result || {}),
      fail: (err) => {
        const detail = err && err.errMsg ? `：${err.errMsg}` : ''
        reject(new Error(`获取微信身份失败，云函数 wxContext 调用失败${detail}`))
      },
    })
  })
}

async function getWechatIdentity() {
  await runWxLogin()
  const context = await callWxContext()

  if (!context.openid) {
    throw new Error('微信身份获取失败，云函数已返回结果，但没有拿到 openid')
  }

  return {
    openid: context.openid,
    unionid: context.unionid || '',
  }
}

async function tryGetWechatIdentity() {
  try {
    return await getWechatIdentity()
  } catch (error) {
    return null
  }
}

function getWechatProfile() {
  return new Promise((resolve) => {
    if (!wx.getUserProfile) {
      resolve({})
      return
    }

    wx.getUserProfile({
      desc: '用于完善微信注册用户信息',
      success: (res) => resolve(res.userInfo || {}),
      fail: () => resolve({}),
    })
  })
}

function login(account, password) {
  const db = getDb()
  const normalizedAccount = normalizeText(account)
  const user = db.users.find((item) => item.account === normalizedAccount)

  if (!normalizedAccount) {
    return Promise.reject(new Error('请输入账号'))
  }

  if (!password) {
    return Promise.reject(new Error('请输入密码'))
  }

  if (!user) {
    return Promise.reject(new Error('账号不存在'))
  }

  try {
    ensureActiveUser(user)
  } catch (error) {
    return Promise.reject(error)
  }

  if (!user.password || user.password !== password) {
    appendOperationLog({
      operator_user_id: user._id,
      operator_role_code: 'UNKNOWN',
      module: 'AUTH',
      action: 'LOGIN_FAILED',
      result: 'FAILED',
      details: { message: '账号或密码错误' },
    })
    return Promise.reject(new Error('账号或密码错误'))
  }

  const role = getRole(user.role_id, db)
  const loginAt = formatNow()

  updateDb((draft) => {
    const target = draft.users.find((item) => item._id === user._id)
    if (target) {
      target.last_login_at = loginAt
    }
  })

  appendOperationLog({
    operator_user_id: user._id,
    operator_role_code: role ? role.role_code : DEFAULT_ROLE_CODE,
    module: 'AUTH',
    action: 'LOGIN',
    details: { message: '账号密码登录成功' },
  })

  return Promise.resolve(saveSession(buildSession({ ...user, last_login_at: loginAt }, role)))
}

async function register(payload) {
  const db = getDb()
  const role = getDefaultRole(db)
  const account = normalizeText(payload.account)
  const password = `${payload.password || ''}`
  const nickname = normalizeText(payload.nickname) || account

  if (!account) {
    throw new Error('请输入注册账号')
  }

  if (!password) {
    throw new Error('请输入注册密码')
  }

  if (password.length < 6) {
    throw new Error('密码至少 6 位')
  }

  if (db.users.some((item) => item.account === account)) {
    throw new Error('该账号已存在')
  }

  const identity = await tryGetWechatIdentity()
  if (identity && db.users.some((item) => item.wechat_openid === identity.openid)) {
    throw new Error('当前微信已绑定其他账号，请直接使用微信登录')
  }

  const now = formatNow()
  const newUser = {
    _id: createUserId(),
    account,
    password,
    role_id: role._id,
    nickname,
    phone: '',
    status: 'ACTIVE',
    last_login_at: now,
    updated_at: now,
    auth_methods: identity ? ['ACCOUNT', 'WECHAT'] : ['ACCOUNT'],
    wechat_openid: identity ? identity.openid : '',
    wechat_unionid: identity ? identity.unionid : '',
  }

  updateDb((draft) => {
    draft.users.unshift(newUser)
  })

  appendOperationLog({
    operator_user_id: newUser._id,
    operator_role_code: role.role_code,
    module: 'AUTH',
    action: 'REGISTER',
    details: { message: '账号注册成功' },
  })

  return saveSession(buildSession(newUser, role))
}

async function loginWithWechat() {
  const [identity, profile] = await Promise.all([getWechatIdentity(), getWechatProfile()])
  const db = getDb()
  const existingUser = db.users.find((item) => item.wechat_openid === identity.openid)

  if (!existingUser) {
    const { user: newUser, role } = buildWechatUser(identity, profile, db)

    updateDb((draft) => {
      draft.users.unshift(newUser)
    })

    appendOperationLog({
      operator_user_id: newUser._id,
      operator_role_code: role.role_code,
      module: 'AUTH',
      action: 'WECHAT_AUTO_REGISTER',
      details: { message: '首次微信登录，已自动创建账号并登录' },
    })

    return saveSession(buildSession(newUser, role))
  }

  ensureActiveUser(existingUser)

  const role = getRole(existingUser.role_id, db)
  const loginAt = formatNow()
  const userPatch = buildWechatProfileUpdate(identity, profile, existingUser, loginAt)

  updateDb((draft) => {
    const target = draft.users.find((item) => item._id === existingUser._id)
    if (target) {
      Object.assign(target, userPatch)
    }
  })

  appendOperationLog({
    operator_user_id: existingUser._id,
    operator_role_code: role ? role.role_code : DEFAULT_ROLE_CODE,
    module: 'AUTH',
    action: 'WECHAT_LOGIN',
    details: { message: '微信登录成功' },
  })

  return saveSession(buildSession({ ...existingUser, ...userPatch }, role))
}

async function registerWithWechat() {
  const [identity, profile] = await Promise.all([getWechatIdentity(), getWechatProfile()])
  const db = getDb()
  const existingUser = db.users.find((item) => item.wechat_openid === identity.openid)

  if (existingUser) {
    throw new Error('当前微信已注册，请直接使用微信登录')
  }

  const { user: newUser, role } = buildWechatUser(identity, profile, db)

  updateDb((draft) => {
    draft.users.unshift(newUser)
  })

  appendOperationLog({
    operator_user_id: newUser._id,
    operator_role_code: role.role_code,
    module: 'AUTH',
    action: 'WECHAT_REGISTER',
    details: { message: '微信注册成功' },
  })

  return saveSession(buildSession(newUser, role))
}

function updateCredentials(userId, payload) {
  const { account, currentPassword, newPassword } = payload
  const db = getDb()
  const user = db.users.find((item) => item._id === userId)

  if (!user) {
    return Promise.reject(new Error('用户不存在'))
  }

  if (!currentPassword || user.password !== currentPassword) {
    return Promise.reject(new Error('当前密码不正确'))
  }

  const trimmedAccount = normalizeText(account)
  if (!trimmedAccount) {
    return Promise.reject(new Error('请输入账号'))
  }

  const duplicateUser = db.users.find((item) => item.account === trimmedAccount && item._id !== userId)
  if (duplicateUser) {
    return Promise.reject(new Error('该账号已被其他用户使用'))
  }

  if (newPassword && newPassword.length < 6) {
    return Promise.reject(new Error('密码至少 6 位'))
  }

  const nextPassword = newPassword || user.password
  const updatedDb = updateDb((draft) => {
    const target = draft.users.find((item) => item._id === userId)
    if (target) {
      target.account = trimmedAccount
      target.password = nextPassword
      target.updated_at = formatNow()
      target.auth_methods = withAuthMethod(target, 'ACCOUNT')
    }
  })

  const updatedUser = updatedDb.users.find((item) => item._id === userId)
  const role = getRole(updatedUser.role_id, updatedDb)
  const session = buildSession(updatedUser, role)

  appendOperationLog({
    operator_user_id: userId,
    operator_role_code: role.role_code,
    module: 'AUTH',
    action: 'UPDATE_CREDENTIALS',
    details: {
      message: newPassword ? '账号密码已更新' : '账号信息已更新',
    },
  })

  return Promise.resolve(saveSession(session))
}

function updateProfile(userId, payload = {}) {
  const nickname = normalizeText(payload.nickname)
  const db = getDb()
  const user = db.users.find((item) => item._id === userId)

  if (!user) {
    return Promise.reject(new Error('当前用户不存在'))
  }

  if (!nickname) {
    return Promise.reject(new Error('请输入名称'))
  }

  const updatedDb = updateDb((draft) => {
    const target = draft.users.find((item) => item._id === userId)
    if (target) {
      target.nickname = nickname
      target.updated_at = formatNow()
    }
  })

  const updatedUser = updatedDb.users.find((item) => item._id === userId)
  const role = getRole(updatedUser.role_id, updatedDb)
  const session = buildSession(updatedUser, role)

  appendOperationLog({
    operator_user_id: userId,
    operator_role_code: role.role_code,
    module: 'AUTH',
    action: 'UPDATE_PROFILE',
    details: {
      message: '用户更新了显示名称',
      nickname,
    },
  })

  return Promise.resolve(saveSession(session))
}

async function resetPasswordByAccount(payload) {
  const account = normalizeText(payload && payload.account)
  const newPassword = `${payload && payload.newPassword ? payload.newPassword : ''}`
  const confirmPassword = `${payload && payload.confirmPassword ? payload.confirmPassword : ''}`
  const db = getDb()
  const user = db.users.find((item) => item.account === account)

  if (!account) {
    throw new Error('请输入账号')
  }

  if (!newPassword || !confirmPassword) {
    throw new Error('请输入完整的新密码')
  }

  if (newPassword.length < 6) {
    throw new Error('密码至少 6 位')
  }

  if (newPassword !== confirmPassword) {
    throw new Error('两次输入的密码不一致')
  }

  if (!user) {
    throw new Error('账号不存在')
  }

  ensureActiveUser(user)

  const now = formatNow()
  const updatedDb = updateDb((draft) => {
    const target = draft.users.find((item) => item._id === user._id)
    if (target) {
      target.password = newPassword
      target.updated_at = now
      target.last_login_at = now
      target.auth_methods = withAuthMethod(target, 'ACCOUNT')
    }
  })

  const updatedUser = updatedDb.users.find((item) => item._id === user._id)
  const role = getRole(updatedUser.role_id, updatedDb)

  appendOperationLog({
    operator_user_id: updatedUser._id,
    operator_role_code: role ? role.role_code : DEFAULT_ROLE_CODE,
    module: 'AUTH',
    action: 'RESET_PASSWORD',
    details: { message: '密码重置成功' },
  })

  return saveSession(buildSession(updatedUser, role))
}

function restoreSession() {
  return wx.getStorageSync(SESSION_KEY) || null
}

function getSession() {
  return wx.getStorageSync(SESSION_KEY) || null
}

function logout() {
  wx.removeStorageSync(SESSION_KEY)
}

module.exports = {
  login,
  register,
  loginWithWechat,
  registerWithWechat,
  resetPasswordByAccount,
  logout,
  getSession,
  restoreSession,
  updateCredentials,
  updateProfile,
}
