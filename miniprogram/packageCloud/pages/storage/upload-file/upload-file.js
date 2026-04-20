const { ensureSession } = require('../../../../util/permission')
const billService = require('../../../../util/bill-service')

Page({
  data: {
    session: null,
    showCategoryManager: false,
    selectedCategoryCode: '',
    categoryEditorName: '',
    categoryOptions: [
      { code: 'food', label: '餐饮' },
      { code: 'transport', label: '出行' },
      { code: 'groceries', label: '商超' },
      { code: 'daily', label: '日用' },
    ],
    form: {
      merchantName: '',
      amount: '',
      billDate: '',
      categoryCode: 'food',
    },
  },

  onShow() {
    const session = ensureSession('USER')
    if (!session) return

    const today = new Date()
    const billDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`

    this.setData({
      session,
      'form.billDate': this.data.form.billDate || billDate,
    })
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset
    if (!field) return

    this.setData({
      [`form.${field}`]: event.detail.value,
    })
  },

  handleCategoryChange(event) {
    this.setData({
      'form.categoryCode': event.currentTarget.dataset.code,
    })
  },

  openCategoryManager() {
    const currentCode = this.data.form.categoryCode
    const currentItem = (this.data.categoryOptions || []).find((item) => item.code === currentCode) || this.data.categoryOptions[0]

    this.setData({
      showCategoryManager: true,
      selectedCategoryCode: currentItem ? currentItem.code : '',
      categoryEditorName: currentItem ? currentItem.label : '',
    })
  },

  closeCategoryManager() {
    this.setData({
      showCategoryManager: false,
      selectedCategoryCode: '',
      categoryEditorName: '',
    })
  },

  selectManagedCategory(event) {
    const selectedCategoryCode = event.currentTarget.dataset.code
    const selectedItem = (this.data.categoryOptions || []).find((item) => item.code === selectedCategoryCode)

    this.setData({
      selectedCategoryCode,
      categoryEditorName: selectedItem ? selectedItem.label : '',
    })
  },

  handleCategoryEditorInput(event) {
    this.setData({
      categoryEditorName: event.detail.value,
    })
  },

  confirmUpdateCategory() {
    const { selectedCategoryCode, categoryEditorName, categoryOptions, form } = this.data
    const name = `${categoryEditorName || ''}`.trim()

    if (!selectedCategoryCode) {
      wx.showToast({
        title: '请选择要修改的分类',
        icon: 'none',
      })
      return
    }

    if (!name) {
      wx.showToast({
        title: '请输入类别名称',
        icon: 'none',
      })
      return
    }

    const duplicateItem = (categoryOptions || []).find((item) => (item.code === name || item.label === name) && item.code !== selectedCategoryCode)
    if (duplicateItem) {
      this.setData({
        selectedCategoryCode: duplicateItem.code,
        categoryEditorName: duplicateItem.label,
      })
      wx.showToast({
        title: '分类已存在',
        icon: 'none',
      })
      return
    }

    const nextCategoryOptions = (categoryOptions || []).map((item) => {
      if (item.code !== selectedCategoryCode) return item
      return {
        code: name,
        label: name,
      }
    })

    this.setData({
      categoryOptions: nextCategoryOptions,
      selectedCategoryCode: name,
      categoryEditorName: name,
      'form.categoryCode': form.categoryCode === selectedCategoryCode ? name : form.categoryCode,
    })

    wx.showToast({
      title: '分类已更新',
      icon: 'success',
    })
  },

  deleteManagedCategory() {
    const { selectedCategoryCode, categoryOptions, form } = this.data
    if (!selectedCategoryCode) {
      wx.showToast({
        title: '请选择要删除的分类',
        icon: 'none',
      })
      return
    }

    if ((categoryOptions || []).length <= 1) {
      wx.showToast({
        title: '至少保留一个分类',
        icon: 'none',
      })
      return
    }

    const nextCategoryOptions = (categoryOptions || []).filter((item) => item.code !== selectedCategoryCode)
    const nextSelectedItem = nextCategoryOptions[0] || null

    this.setData({
      categoryOptions: nextCategoryOptions,
      selectedCategoryCode: nextSelectedItem ? nextSelectedItem.code : '',
      categoryEditorName: nextSelectedItem ? nextSelectedItem.label : '',
      'form.categoryCode': form.categoryCode === selectedCategoryCode && nextSelectedItem ? nextSelectedItem.code : form.categoryCode,
    })

    wx.showToast({
      title: '分类已删除',
      icon: 'success',
    })
  },

  noop() {},

  handleDateChange(event) {
    this.setData({
      'form.billDate': event.detail.value,
    })
  },

  validateForm(form) {
    if (!form.merchantName.trim()) return '请输入商户名称'
    if (!form.amount || Number(form.amount) <= 0) return '请输入正确的金额'
    if (!form.billDate) return '请选择账单日期'
    if (!form.categoryCode) return '请选择账单分类'
    return ''
  },

  submitUpload() {
    const { session, form } = this.data
    if (!session) return

    const validationError = this.validateForm(form)
    if (validationError) {
      wx.showToast({
        title: validationError,
        icon: 'none',
      })
      return
    }

    const billId = billService.createManualBill(session.user._id, {
      merchantName: form.merchantName,
      amount: form.amount,
      billDate: form.billDate,
      categoryCode: form.categoryCode,
    })

    wx.showToast({
      title: '账单已创建',
      icon: 'success',
    })

    wx.navigateTo({
      url: `/packageExtend/pages/operate/msg/msg?billId=${billId}&aiReview=1`,
    })
  },
})
