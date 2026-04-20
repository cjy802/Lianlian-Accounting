# 廉廉记账 —— 个人账单智能管理微信小程序

> 廉廉记账是一款面向个人用户的账单数字化管理工具，帮助用户快速上传账单、自动识别内容、智能审查异常，并提供消费分类统计与可视化分析。

## 功能特性

- **多格式账单上传** — 支持拍照、相册图片、电子发票、订单截图、PDF 等多种账单形态
- **OCR + AI 智能识别** — 自动提取金额、时间、商家、消费明细、支付方式等结构化信息
- **AI 智能审查** — 金额一致性校验、重复账单检测、图像质量检测、异常消费预警
- **分类统计与图表** — 月度消费趋势、分类占比、商家排行、异常账单分析
- **历史账单管理** — 按时间/金额/分类/状态筛选，支持修正与逻辑删除
- **角色权限控制** — 普通用户与管理员双端，基于 RBAC 的三层权限控制
- **管理后台** — 用户管理、全局账单监管、AI 审查规则配置、操作日志查询

## 技术栈

- **前端**：微信小程序原生框架
- **后端**：微信云开发（云函数 + 云数据库 + 云存储）
- **AI 能力**：OCR 文字识别 + LLM 结构化抽取 + 规则引擎审查

## 项目结构

```
├── cloudfunctions/          # 云函数
│   └── wxContext/           # 获取微信上下文
├── miniprogram/             # 小程序前端代码
│   ├── packageCloud/        # 云开发相关页面（登录、上传等）
│   ├── packageExtend/       # 扩展功能页面（搜索、表单等）
│   ├── page/                # 基础页面与组件
│   ├── util/                # 工具模块
│   │   ├── auth-service.js      # 登录认证服务
│   │   ├── bill-service.js      # 账单业务服务
│   │   ├── ai-bill-review.js    # AI 账单审查
│   │   ├── ai-stream.js         # AI 流式调用
│   │   ├── ai-config.js         # AI 配置
│   │   ├── ai-consult-page.js   # AI 咨询页面逻辑
│   │   ├── ai-error.js          # AI 错误处理
│   │   ├── mock-database.js     # 模拟数据库
│   │   ├── mock-db.js           # 模拟数据
│   │   ├── permission.js        # 权限控制
│   │   └── format.js            # 格式化工具
│   ├── app.js               # 应用入口
│   ├── app.json              # 应用配置
│   ├── app.wxss              # 全局样式
│   └── config.js             # 环境配置
├── lianlian-miniapp-design.md   # 系统设计方案文档
├── project.config.json          # 微信开发者工具配置
└── package.json
```

## 快速开始

### 环境要求
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（最新稳定版）
- 微信客户端 6.7.2 及以上版本

### 安装与运行

1. 克隆项目
```bash
git clone <仓库地址>
cd wexin
```

2. 安装依赖
```bash
npm install
cd miniprogram
npm install
```

3. 使用微信开发者工具打开项目根目录

4. 在开发者工具中点击 **工具 → 构建 npm**

5. 如需使用云开发功能，请在 `miniprogram/config.js` 中配置你的云开发环境 ID

### 代码规范

```bash
npm run lint
```

## 设计文档

详细的系统设计方案请参阅 [lianlian-miniapp-design.md](./lianlian-miniapp-design.md)，涵盖：
- 角色与权限设计
- 功能模块设计（10 大模块）
- AI 审查逻辑设计
- 页面结构设计（15 个页面）
- JSON 数据库设计（9 张表）
- 技术架构建议

## 许可证

[MIT](./LICENSE)