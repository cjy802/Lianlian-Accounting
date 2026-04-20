const authService = require('../../../../util/auth-service')

Page({
  data: {
    account: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [field]: event.detail.value,
    })
  },

  async handleSubmit() {
    const { account, newPassword, confirmPassword, loading } = this.data
    if (loading) return

    const trimmedAccount = `${account || ''}`.trim()
    if (!trimmedAccount) {
      wx.showToast({
        title: '请输入账号',
        icon: 'none',
      })
      return
    }

    if (!newPassword || !confirmPassword) {
      wx.showToast({
        title: '请输入完整的新密码',
        icon: 'none',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none',
      })
      return
    }

    this.setData({ loading: true })

    try {
      const session = await authService.resetPasswordByAccount({
        account: trimmedAccount,
        newPassword,
        confirmPassword,
      })

      getApp().applySession(session)
      wx.showToast({
        title: '密码重置成功',
        icon: 'success',
      })

      setTimeout(() => {
        wx.reLaunch({
          url: session.landingPage,
        })
      }, 350)
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({
        title: error.message || '密码重置失败',
        icon: 'none',
      })
    }
  },
})
