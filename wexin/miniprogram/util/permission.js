const authService = require('./auth-service')

function ensureSession(roleCode) {
  const session = authService.getSession()
  if (!session) {
    wx.reLaunch({
      url: '/packageCloud/pages/user/user-authentication/user-authentication',
    })
    return null
  }

  if (roleCode && session.role.role_code !== roleCode) {
    wx.showToast({
      title: '当前账号无权访问',
      icon: 'none',
    })
    wx.reLaunch({
      url: session.landingPage,
    })
    return null
  }

  return session
}

module.exports = {
  ensureSession,
}
