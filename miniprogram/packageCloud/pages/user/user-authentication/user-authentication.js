const authService = require('../../../../util/auth-service')

Page({
  data: {
    mode: 'login',
    account: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    loading: false,
    wechatLoading: false,
    redirecting: false,
    authTips: [
      '首次使用时，推荐直接点击微信登录完成授权。',
      '微信登录成功后，将优先使用当前微信昵称作为系统显示名称。',
      '如果你已经注册过账号，也可以继续使用账号密码登录。',
    ],
  },

  onShow() {
    if (this.data.redirecting) return

    const session = authService.getSession()
    if (session) {
      this.finishAuth(session).catch((error) => {
        this.setData({ redirecting: false })
        wx.showToast({
          title: (error && error.message) || '页面跳转失败',
          icon: 'none',
        })
      })
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [field]: event.detail.value,
    })
  },

  switchMode(event) {
    const mode = event.currentTarget.dataset.mode
    if (!mode || mode === this.data.mode) return

    this.setData({
      mode,
      password: mode === 'login' ? this.data.password : '',
      confirmPassword: '',
      nickname: '',
      loading: false,
      wechatLoading: false,
    })
  },

  async finishAuth(session) {
    const app = getApp()
    const targetUrl = session && session.landingPage ? session.landingPage : '/page/component/index'

    this.setData({
      redirecting: true,
      loading: false,
      wechatLoading: false,
    })

    app.applySession(session)
    await new Promise((resolve, reject) => {
      wx.reLaunch({
        url: targetUrl,
        success: resolve,
        fail: reject,
      })
    })
  },

  async handleAccountSubmit() {
    const { loading, mode, account, password, confirmPassword, nickname } = this.data
    if (loading) return

    const trimmedAccount = `${account || ''}`.trim()
    if (!trimmedAccount) {
      wx.showToast({
        title: mode === 'login' ? '请输入账号' : '请输入注册账号',
        icon: 'none',
      })
      return
    }

    if (!password) {
      wx.showToast({
        title: mode === 'login' ? '请输入密码' : '请输入注册密码',
        icon: 'none',
      })
      return
    }

    if (mode === 'register' && password.length < 6) {
      wx.showToast({
        title: '密码至少 6 位',
        icon: 'none',
      })
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none',
      })
      return
    }

    this.setData({ loading: true })

    try {
      const session = mode === 'login'
        ? await authService.login(trimmedAccount, password)
        : await authService.register({
          account: trimmedAccount,
          password,
          nickname: `${nickname || ''}`.trim(),
        })

      await this.finishAuth(session)
    } catch (error) {
      this.setData({ redirecting: false })
      wx.showToast({
        title: error.message || (mode === 'login' ? '登录失败' : '注册失败'),
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  async handleWechatSubmit() {
    const { mode, wechatLoading } = this.data
    if (wechatLoading) return

    this.setData({ wechatLoading: true })

    try {
      const session = mode === 'login'
        ? await authService.loginWithWechat()
        : await authService.registerWithWechat()

      await this.finishAuth(session)
    } catch (error) {
      this.setData({ redirecting: false })
      wx.showToast({
        title: error.message || (mode === 'login' ? '微信登录失败' : '微信注册失败'),
        icon: 'none',
      })
    } finally {
      this.setData({ wechatLoading: false })
    }
  },

  handleForgotPassword() {
    wx.navigateTo({
      url: '/packageCloud/pages/user/forgot-password/forgot-password',
    })
  },
})
