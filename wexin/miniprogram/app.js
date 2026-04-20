const authService = require('./util/auth-service')
const config = require('./config')

App({
  globalData: {
    theme: 'light',
    session: null,
    currentUser: null,
    currentRole: null,
    permissions: [],
  },

  onLaunch() {
    if (wx.cloud) {
      const cloudConfig = {
        traceUser: true,
      }

      if (config.envId) {
        cloudConfig.env = config.envId
      }

      wx.cloud.init(cloudConfig)
    }

    const session = authService.restoreSession()
    if (session) {
      this.applySession(session)
    }
  },

  applySession(session) {
    this.globalData.session = session
    this.globalData.currentUser = session.user
    this.globalData.currentRole = session.role
    this.globalData.permissions = session.permissions || []
  },

  clearSession() {
    this.globalData.session = null
    this.globalData.currentUser = null
    this.globalData.currentRole = null
    this.globalData.permissions = []
  },

  getSession() {
    return this.globalData.session
  },
})
