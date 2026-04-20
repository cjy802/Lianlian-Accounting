/**
 * 小程序配置文件
 */

const host = '14592619.qcloud.la'

const config = {
  // 测试的请求地址，用于测试会话
  requestUrl: 'https://mp.weixin.qq.com',
  host,

  // 云开发环境 ID
  // 请改成你当前小程序绑定的云开发环境 ID。
  // 留空时会使用开发者工具里当前小程序可用的默认云环境。
  envId: '',

  // 云开发-存储 示例文件的文件 ID
  // 如果你要体验示例里的云存储图片/视频页面，再填入你自己环境里的 fileID。
  demoImageFileId: '',
  demoVideoFileId: '',
}

module.exports = config
