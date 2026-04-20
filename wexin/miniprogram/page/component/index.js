const { ensureSession } = require('../../util/permission')
const billService = require('../../util/bill-service')
const authService = require('../../util/auth-service')
const { readAiConfig, saveAiConfig, validateAiConfig } = require('../../util/ai-config')

function buildSettingsForm(user = {}) {
  const aiConfig = readAiConfig()
  return {
    displayName: user.nickname || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    apiBaseUrl: aiConfig.apiBaseUrl,
    apiPath: aiConfig.apiPath,
    apiToken: aiConfig.apiToken,
    apiModel: aiConfig.apiModel,
    apiTimeout: aiConfig.apiTimeout,
  }
}

Page({
  data: {
    session: null,
    overview: null,
    settingsVisible: false,
    settingsMode: 'profile',
    savingProfile: false,
    savingPassword: false,
    savingApiConfig: false,
    clearingRecords: false,
    settingsForm: buildSettingsForm(),
  },

  onShow() {
    this.refreshPage()
  },

  refreshPage() {
    const session = ensureSession('USER')
    if (!session) return

    const overview = billService.getUserDashboard(session.user._id)

    this.setData({
      session,
      overview,
      settingsForm: buildSettingsForm(session.user),
    })
  },

  goUpload() {
    wx.navigateTo({ url: '/packageCloud/pages/storage/upload-file/upload-file' })
  },

  goHistory() {
    wx.navigateTo({ url: '/packageExtend/pages/search/searchbar/searchbar' })
  },

  goAnalytics() {
    wx.navigateTo({ url: '/packageExtend/pages/extend/tabs/tabs' })
  },

  goAiConsult() {
    wx.navigateTo({ url: '/packageExtend/pages/base/article/article' })
  },

  openBill(event) {
    const billId = event.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageExtend/pages/form/form/form?billId=${billId}`,
    })
  },

  openSettings() {
    if (!this.data.session) return

    this.setData({
      settingsVisible: true,
      settingsMode: 'profile',
      settingsForm: buildSettingsForm(this.data.session.user),
    })
  },

  closeSettings() {
    this.setData({
      settingsVisible: false,
      savingProfile: false,
      savingPassword: false,
      savingApiConfig: false,
      clearingRecords: false,
    })
  },

  switchSettingsMode(event) {
    const mode = event.currentTarget.dataset.mode
    if (!mode || mode === this.data.settingsMode) return
    this.setData({ settingsMode: mode })
  },

  noop() {},

  handleSettingInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`settingsForm.${field}`]: event.detail.value,
    })
  },

  async saveProfileSettings() {
    const { session, settingsForm, savingProfile } = this.data
    if (!session || savingProfile) return

    const displayName = (settingsForm.displayName || '').trim()
    if (!displayName) {
      wx.showToast({
        title: '请输入名称',
        icon: 'none',
      })
      return
    }

    if (displayName.length > 20) {
      wx.showToast({
        title: '名称最多 20 个字',
        icon: 'none',
      })
      return
    }

    this.setData({ savingProfile: true })

    try {
      const nextSession = await authService.updateProfile(session.user._id, {
        nickname: displayName,
      })

      getApp().applySession(nextSession)
      wx.showToast({
        title: '名称已更新',
        icon: 'success',
      })

      this.setData({
        settingsVisible: false,
        savingProfile: false,
      })
      this.refreshPage()
    } catch (error) {
      this.setData({ savingProfile: false })
      wx.showToast({
        title: error.message || '更新失败',
        icon: 'none',
      })
    }
  },

  async savePasswordSettings() {
    const { session, settingsForm, savingPassword } = this.data
    if (savingPassword) return

    const currentPassword = settingsForm.currentPassword || ''
    const newPassword = settingsForm.newPassword || ''
    const confirmPassword = settingsForm.confirmPassword || ''

    if (!currentPassword || !newPassword || !confirmPassword) {
      wx.showToast({
        title: '请完整填写密码信息',
        icon: 'none',
      })
      return
    }

    if (newPassword.length < 6) {
      wx.showToast({
        title: '新密码至少 6 位',
        icon: 'none',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次输入的新密码不一致',
        icon: 'none',
      })
      return
    }

    this.setData({ savingPassword: true })

    try {
      const nextSession = await authService.updateCredentials(session.user._id, {
        account: session.user.account,
        currentPassword,
        newPassword,
      })

      getApp().applySession(nextSession)
      wx.showToast({
        title: '密码修改成功',
        icon: 'success',
      })

      this.setData({
        settingsVisible: false,
        savingPassword: false,
      })
      this.refreshPage()
    } catch (error) {
      this.setData({ savingPassword: false })
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      })
    }
  },

  saveApiConfig() {
    const { settingsForm, savingApiConfig } = this.data
    if (savingApiConfig) return

    const payload = {
      apiBaseUrl: (settingsForm.apiBaseUrl || '').trim(),
      apiPath: (settingsForm.apiPath || '').trim(),
      apiToken: (settingsForm.apiToken || '').trim(),
      apiModel: (settingsForm.apiModel || '').trim(),
      apiTimeout: `${Number(settingsForm.apiTimeout)}`,
    }

    const validationError = validateAiConfig(payload)
    if (validationError) {
      wx.showToast({
        title: validationError,
        icon: 'none',
      })
      return
    }

    this.setData({ savingApiConfig: true })
    const saved = saveAiConfig(payload)

    this.setData({
      savingApiConfig: false,
      settingsForm: {
        ...settingsForm,
        apiBaseUrl: saved.apiBaseUrl,
        apiPath: saved.apiPath,
        apiToken: saved.apiToken,
        apiModel: saved.apiModel,
        apiTimeout: saved.apiTimeout,
      },
    })

    wx.showToast({
      title: 'AI API 配置已保存',
      icon: 'success',
    })
  },

  confirmClearRecords() {
    const { clearingRecords } = this.data
    if (clearingRecords) return

    wx.showModal({
      title: '清除记录',
      content: '将删除当前账户的账单、识别结果和通知记录，且不可恢复。确认继续吗？',
      confirmColor: '#b42318',
      success: (res) => {
        if (!res.confirm) return
        this.clearRecords()
      },
    })
  },

  clearRecords() {
    const { session, clearingRecords } = this.data
    if (!session || clearingRecords) return

    this.setData({ clearingRecords: true })

    try {
      const removedCount = billService.clearUserRecords(session.user._id)
      this.setData({
        clearingRecords: false,
        settingsVisible: false,
      })
      this.refreshPage()
      wx.showToast({
        title: removedCount ? `已清除 ${removedCount} 条记录` : '暂无可清除记录',
        icon: 'none',
      })
    } catch (error) {
      this.setData({ clearingRecords: false })
      wx.showToast({
        title: error.message || '清除失败',
        icon: 'none',
      })
    }
  },

  handleLogout() {
    authService.logout()
    getApp().clearSession()
    wx.reLaunch({
      url: '/packageCloud/pages/user/user-authentication/user-authentication',
    })
  },
})
