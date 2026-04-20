# 廉廉记账微信小程序系统设计方案

## 1. 项目背景与需求分析

### 1.1 项目背景
“廉廉记账”原项目不再定位为学生报销审批系统，而是转型为面向个人用户的账单数字化管理工具。用户在日常消费中会产生大量分散的账单材料，例如纸质小票、电子发票、外卖订单截图、电商订单详情页、银行卡账单截图、PDF 电子账单等。这些账单往往格式不统一、信息分散、难以统计，传统手动记录方式效率低、容易遗漏，也很难做到长期留存与复核。

### 1.2 核心痛点
1. 账单来源分散，手动录入成本高。
2. 不同账单格式差异大，金额和明细不易统一提取。
3. 总金额、明细金额、时间、商家等关键信息容易识别错误或录入错误。
4. 账单缺少统一分类和统计，个人消费分析不直观。
5. 异常账单、重复账单、模糊账单很难及时发现。
6. 用户缺少针对账单质量和消费风险的智能审查能力。

### 1.3 建设目标
“廉廉记账”需要建设为一款微信小程序，围绕“上传账单、自动识别、自动统计、AI 审查、分类管理、可视化分析”形成完整闭环，帮助个人用户完成账单管理的数字化、透明化和智能化。

### 1.4 业务目标
1. 让用户能够快速上传多种类型账单材料。
2. 自动识别账单中的金额、时间、商家、消费明细、支付方式、发票信息等内容。
3. 自动完成账单分类、统计与趋势分析。
4. 使用 AI 进行质量审查、异常审查、逻辑审查与风险提示。
5. 为管理员提供用户、账单、规则、日志和异常账单的统一管理能力。

### 1.5 非功能需求
1. 支持图片和 PDF 文件上传。
2. 支持角色隔离和基础权限控制。
3. 支持高可扩展的数据结构，便于后续增加预算、标签、报表导出等功能。
4. 支持审查结果留痕、操作日志留痕、规则可配置。
5. 支持识别失败重试、人工纠错、审查复核。

## 2. 产品定位与核心价值

### 2.1 产品定位
- 项目名称：廉廉记账
- 产品形态：微信小程序
- 目标用户：个人用户
- 管理对象：图片账单、电子发票、小票、订单截图、PDF 账单文件
- 核心方向：账单识别 + 自动统计 + AI 审查 + 消费可视化

### 2.2 核心功能
1. 账单上传
2. OCR/AI 内容识别
3. 金额提取与自动统计
4. 消费明细提取
5. AI 智能审查
6. 异常账单提示
7. 历史账单管理
8. 分类统计与图表分析
9. 管理后台
10. 操作日志留痕

### 2.3 核心价值
1. 自动识别账单内容，减少手动录入。
2. 自动统计账单金额，提高数据整理效率。
3. 智能审查账单明细，发现异常、重复、识别错误或缺失问题。
4. 建立个人消费的统一台账，提升记录完整性。
5. 通过图表分析帮助用户理解消费结构、金额趋势和高风险消费。

### 2.4 产品原则
1. 以用户低门槛上传为中心，减少填写动作。
2. 以“可纠错、可复核、可追踪”为核心保障结果可信度。
3. 以 AI 为辅助判断，不直接替代用户最终确认。
4. 以模块化架构设计，方便未来扩展预算、报销、共享账本等业务。

## 3. 角色与权限设计

### 3.1 角色定义

#### 3.1.1 用户端
主要面向个人用户，负责账单上传、查看识别结果、确认统计结果、接收 AI 审查意见和管理个人账单数据。

#### 3.1.2 管理员端
主要面向平台维护人员，负责用户管理、账单监管、异常账单处理、AI 审查规则维护、日志查看和全局统计。

### 3.2 角色权限矩阵

| 功能项 | 用户 | 管理员 |
|---|---|---|
| 账号密码登录 | 是 | 是 |
| 查看个人首页 | 是 | 否 |
| 查看管理员首页 | 否 | 是 |
| 上传账单图片/截图/PDF | 是 | 可代运营查看 |
| 查看 OCR 识别结果 | 是 | 是 |
| 编辑修正识别字段 | 是 | 是 |
| 查看金额统计 | 是 | 是 |
| 查看 AI 审查意见 | 是 | 是 |
| 分类管理个人账单 | 是 | 是 |
| 查看个人历史账单 | 是 | 是 |
| 查看全局账单数据 | 否 | 是 |
| 用户管理 | 否 | 是 |
| 异常账单查看 | 否 | 是 |
| AI 审查规则配置 | 否 | 是 |
| 系统日志查看 | 否 | 是 |
| 全局数据统计 | 否 | 是 |
| 密码重置 | 是 | 是 |
| 账号状态变更 | 否 | 是 |

### 3.3 权限控制设计
1. 基于角色的访问控制 RBAC。
2. 用户只能访问自己的账单数据、识别结果、统计结果和通知。
3. 管理员可访问全局管理菜单，但不能绕过日志直接删除关键审查记录。
4. 关键操作采用“菜单权限 + 接口权限 + 数据权限”三层控制。
5. 敏感操作例如规则修改、账号冻结、异常账单处理需记录操作日志。

### 3.4 账号状态设计
- `ACTIVE`：正常可登录可使用。
- `INACTIVE`：未启用，不允许登录。
- `LOCKED`：多次输错密码或管理员冻结，不允许登录。
- `RESET_REQUIRED`：必须重置密码后方可继续登录。
- `DELETED`：逻辑删除，不允许登录。

## 4. 登录机制设计

### 4.1 登录方式
本项目采用“账号 + 密码”登录，不同账号对应不同角色，系统在登录成功后按角色自动跳转到对应端口页面。

### 4.2 登录流程
1. 用户输入账号和密码。
2. 前端调用登录接口。
3. 后端校验账号是否存在、账号状态是否正常、密码是否正确。
4. 登录成功后签发会话令牌 `token`。
5. 后端返回用户基础信息、角色编码、权限列表、首页路由。
6. 前端根据角色自动跳转：
   - 普通用户跳转到用户首页
   - 管理员跳转到管理员首页

### 4.3 登录安全设计
1. 密码使用不可逆加密存储，例如 `bcrypt` 或 `scrypt`。
2. 登录接口限制错误次数，例如连续 5 次失败自动锁定 30 分钟。
3. Token 采用短期访问令牌 + 刷新机制。
4. 重要接口校验登录状态、角色、权限和数据归属。
5. 登录行为写入登录日志，记录时间、IP、设备、结果和失败原因。

### 4.4 密码重置设计
1. 用户发起“忘记密码”。
2. 系统通过手机号验证码或管理员重置链接执行身份校验。
3. 密码重置后旧 Token 立即失效。
4. 首次登录或管理员初始化密码后，系统可要求用户强制改密。

### 4.5 基础权限控制
1. 前端按 `menus` 和 `permissions` 控制页面显示。
2. 后端按 `role_code` 和 `permission_codes` 控制接口访问。
3. 数据层按 `owner_user_id` 实现数据隔离。

### 4.6 登录日志
日志内容应包含：
- 账号
- 用户 ID
- 角色
- 登录时间
- 登录结果
- 失败原因
- 终端类型
- IP 地址
- 设备信息

## 5. 功能模块设计

### 5.1 账单上传模块
#### 功能目标
为用户提供统一的账单采集入口，支持多格式文件上传和预处理。

#### 支持类型
1. 手机拍照上传
2. 相册图片上传
3. 小票/发票图片
4. 电商订单截图
5. 银行或平台电子账单 PDF
6. 电子发票文件

#### 处理流程
1. 用户选择文件。
2. 前端进行格式、大小、数量校验。
3. 图片类文件进行压缩、旋转校正和预览。
4. 上传到对象存储。
5. 生成附件记录。
6. 触发识别任务队列。

#### 字段采集
- 账单类型
- 上传来源
- 上传时间
- 原始文件 URL
- 缩略图 URL
- 文件哈希
- 上传状态

### 5.2 OCR/AI 内容识别模块
#### 功能目标
自动提取账单中的结构化信息。

#### 识别字段
1. 总金额
2. 实付金额
3. 账单日期
4. 商家名称
5. 消费项目明细
6. 数量、单价、小计
7. 发票号码
8. 支付方式
9. 税额
10. 订单号
11. 币种

#### 识别流程
1. 图像预处理：去噪、裁剪、增强、纠偏。
2. OCR 文本识别：提取文本块与坐标。
3. 文档结构分析：识别标题区、金额区、明细区、底部备注区。
4. LLM 结构化抽取：将 OCR 结果转换为 JSON。
5. 置信度评分：对关键字段输出 confidence。
6. 保存候选结果并标记待审查。

### 5.3 金额提取与自动统计模块
#### 功能目标
从识别结果中提取金额类信息，并形成汇总统计。

#### 功能点
1. 自动提取账单总金额、优惠金额、实付金额、税额。
2. 自动识别明细行小计。
3. 自动统计按日、周、月、年消费金额。
4. 自动统计按分类、商家、支付方式消费金额。
5. 自动生成消费趋势与 TOP 分类。

#### 校验逻辑
1. 明细合计与总金额比对。
2. 优惠前后金额关系比对。
3. 币种统一与格式规范。
4. 异常值检测。

### 5.4 消费明细提取模块
#### 功能目标
提取消费条目，支持后续分类与分析。

#### 字段
- 明细名称
- 数量
- 单价
- 小计
- 商品类别
- AI 分类结果
- 置信度

#### 业务规则
1. 对表格型小票优先按行提取。
2. 对订单截图优先提取商品卡片结构。
3. 对 PDF 账单按文本区块和账单模板提取。
4. 若识别不完整，允许用户手动补录或修正。

### 5.5 AI 内容审查模块
#### 功能目标
对识别结果进行可信性、完整性、重复性、合理性和风险性审查。

#### 审查维度
1. 金额识别正确性
2. 明细合计与总金额一致性
3. 重复账单识别
4. 模糊、缺失、遮挡检测
5. 异常消费金额检测
6. 消费类别合理性判断
7. 可疑内容识别
8. 输出结论、风险等级、建议

### 5.6 异常账单提示模块
#### 提示场景
1. 识别置信度过低
2. 明细金额不一致
3. 疑似重复上传
4. 图片模糊、关键信息缺失
5. 消费金额明显偏高或偏离历史行为
6. 账单类型与内容不匹配

#### 提示方式
1. 识别结果页红黄绿风险提示
2. 历史列表异常标签
3. 消息通知
4. 管理员异常账单看板

### 5.7 历史账单管理模块
#### 功能目标
提供个人账单的可追溯、可筛选、可编辑管理。

#### 功能点
1. 按时间、金额、分类、商家筛选
2. 按状态筛选：待识别、已识别、待复核、已完成、异常
3. 查看账单原图、识别结果、AI 审查结果
4. 支持修改分类、标签、备注
5. 支持逻辑删除与恢复

### 5.8 分类统计与图表分析模块
#### 功能目标
以图表形式展示消费结构和趋势。

#### 图表建议
1. 月度消费趋势折线图
2. 分类占比饼图
3. 商家消费排行柱状图
4. 日历热力图
5. 异常账单占比图
6. AI 审查风险分布图

### 5.9 管理后台模块
#### 核心能力
1. 用户管理
2. 账单管理
3. 异常账单管理
4. AI 审查规则管理
5. 全局统计分析
6. 操作日志查询

#### 管理目标
帮助管理员掌握平台运行、识别质量、风险账单数量、规则效果和用户使用情况。

### 5.10 操作日志模块
#### 记录范围
1. 登录登出
2. 账单上传
3. 识别重试
4. 字段修正
5. 分类修改
6. AI 规则修改
7. 账号状态变更
8. 异常账单处理

#### 作用
1. 追踪关键业务操作
2. 支持问题排查
3. 支持规则审计
4. 支持管理员监管

## 6. AI 审查逻辑设计

### 6.1 AI 审查总体思路
AI 审查并不是单一大模型判断，而是建议采用“规则引擎 + OCR 结果校验 + 历史对比 + 大模型语义分析”的组合方案。规则负责确定性校验，模型负责模糊判断，最终形成可解释的审查结果。

### 6.2 审查流程
1. 读取 OCR 结构化结果和原始附件元数据。
2. 执行基础规则校验。
3. 执行重复账单检测。
4. 执行图像质量检测。
5. 执行金额异常检测。
6. 执行消费类别合理性判断。
7. 调用 LLM 输出自然语言审查意见。
8. 聚合生成结论、风险等级和处理建议。

### 6.3 审查点设计

#### 6.3.1 金额是否识别正确
1. 比较 OCR 金额候选框和语义抽取金额是否一致。
2. 对金额字段执行格式校验，如是否含非法字符、是否超出合理范围。
3. 若存在多个候选金额，优先结合“总计”“实付”“合计”等语义标签判断。

#### 6.3.2 明细金额之和是否与总金额一致
1. 汇总每一条明细小计。
2. 将明细合计与总金额进行差值比较。
3. 若差值在允许阈值内，例如小于 0.01，则判定一致。
4. 若差值超阈值，则标记 `AMOUNT_MISMATCH`。

#### 6.3.3 是否存在重复账单
重复检测建议组合以下特征：
1. 文件哈希或感知哈希
2. 商家名称 + 消费日期 + 总金额
3. 订单号或发票号
4. OCR 关键文本相似度

若重复概率高于设定阈值，则标记为疑似重复账单。

#### 6.3.4 是否存在模糊、缺失、遮挡信息
1. 检测图片清晰度、对比度、亮度。
2. 检测关键信息区域是否缺失。
3. 检测金额、商家、日期等字段置信度。
4. 若关键字段缺失或置信度低于阈值，则要求人工复核。

#### 6.3.5 是否存在异常消费金额
1. 与用户历史均值比较。
2. 与同分类消费中位数比较。
3. 对单笔超高金额、高频重复金额进行预警。
4. 可设置管理员自定义阈值，例如餐饮单笔超过 1000 元触发提示。

#### 6.3.6 消费类别是否合理
1. 根据商家名称、商品关键词、账单类型推断分类。
2. 若用户手动分类与 AI 推断明显冲突，则提示复核。
3. 例如“滴滴出行”被标为“餐饮”则应预警。

#### 6.3.7 是否存在可疑或需要人工复核的内容
1. 关键信息多字段冲突。
2. 时间不完整、金额缺失、商家名称异常乱码。
3. 图片经过明显裁剪或遮挡。
4. 同一用户短时间内重复上传同类账单。
5. 发票号格式异常或订单号不符合常见规则。

### 6.4 风险等级设计
- `LOW`：账单信息完整，识别可信，风险低。
- `MEDIUM`：存在少量字段低置信度或需要用户确认的问题。
- `HIGH`：存在金额不一致、重复账单、缺失严重、异常金额等高风险问题。
- `CRITICAL`：高度疑似错误账单、伪造账单或强制人工复核场景。

### 6.5 审查结果输出结构
1. 审查结论：通过、需确认、建议复核、不通过
2. 风险等级：低、中、高、严重
3. 风险标签：重复账单、金额不一致、信息缺失等
4. 审查建议：重新上传、人工修正、管理员复核、忽略
5. 审查解释：让用户知道为什么被判定异常

### 6.6 AI 审查示例
```json
{
  "review_conclusion": "NEEDS_REVIEW",
  "risk_level": "HIGH",
  "risk_tags": ["AMOUNT_MISMATCH", "LOW_IMAGE_QUALITY", "POSSIBLE_DUPLICATE"],
  "review_summary": "该账单明细合计与总金额不一致，且图片下半部分存在遮挡，同时与2026-04-10上传账单高度相似。",
  "suggestions": [
    "请重新上传完整清晰账单",
    "请核对总金额与明细小计",
    "如确认为新账单，请补充备注说明差异"
  ],
  "requires_manual_check": true
}
```

## 7. 页面结构设计

### 7.1 登录页
#### 功能
1. 账号输入
2. 密码输入
3. 登录按钮
4. 忘记密码
5. 账号状态提示
6. 登录失败提示

#### 页面说明
登录成功后根据角色自动跳转用户首页或管理员首页。

### 7.2 首页
#### 功能
1. 快速上传入口
2. 最近账单概览
3. 本月消费统计
4. AI 风险提醒
5. 常用分类快捷入口
6. 待确认账单提示

### 7.3 上传账单页
#### 功能
1. 拍照上传
2. 相册选择
3. 文件选择 PDF
4. 账单类型选择
5. 上传预览
6. 提交识别

### 7.4 识别结果页
#### 功能
1. 展示 OCR 提取的金额、时间、商家
2. 展示消费明细列表
3. 展示字段置信度
4. 支持用户修正信息
5. 触发重新识别

### 7.5 账单详情页
#### 功能
1. 查看原始附件
2. 查看结构化字段
3. 查看分类、标签、备注
4. 查看审查记录
5. 查看操作历史

### 7.6 AI 审查结果页
#### 功能
1. 展示审查结论
2. 展示风险等级
3. 展示问题明细
4. 展示 AI 建议
5. 支持一键跳转修正

### 7.7 历史账单页
#### 功能
1. 列表查看账单
2. 条件筛选
3. 状态筛选
4. 异常标签展示
5. 搜索商家、金额、时间

### 7.8 统计分析页
#### 功能
1. 月度总消费
2. 分类占比
3. 商家排行
4. 消费趋势
5. 异常消费分析
6. 风险账单统计

### 7.9 个人中心页
#### 功能
1. 个人资料
2. 账号安全
3. 密码修改
4. 通知中心
5. 使用帮助
6. 退出登录

### 7.10 管理员首页
#### 功能
1. 平台用户总数
2. 总账单数
3. 异常账单数
4. 今日识别成功率
5. 风险等级分布
6. 快捷进入管理模块

### 7.11 用户管理页
#### 功能
1. 用户列表
2. 用户状态变更
3. 角色查看
4. 密码重置
5. 用户账单概览

### 7.12 账单管理页
#### 功能
1. 查看全量账单
2. 按状态筛选
3. 按用户筛选
4. 查看账单详情
5. 发起人工复核

### 7.13 异常账单页
#### 功能
1. 查看高风险账单
2. 按异常类型筛选
3. 查看重复账单组
4. 标记处理结果
5. 添加复核意见

### 7.14 AI 规则管理页
#### 功能
1. 配置金额阈值
2. 配置分类规则
3. 配置重复判定规则
4. 配置人工复核条件
5. 查看规则版本与生效状态

### 7.15 日志管理页
#### 功能
1. 登录日志查看
2. 操作日志查看
3. 规则变更日志
4. 按用户/时间/模块筛选
5. 问题追踪导出

## 8. JSON 数据库设计

> 说明：以下采用 JSON 文档数据库设计方式，适用于腾讯云开发云数据库、MongoDB 或其他文档型存储。字段中的 `type` 表示建议数据类型，`required` 表示是否必填，`default` 为默认值，`example` 为示例值。

```json
{
  "entities": [
    {
      "entity_name": "users",
      "description": "系统账号表，存储用户与管理员账号信息",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "主键ID", "required": true, "default": "uuid", "example": "usr_001" },
        { "field_name": "account", "type": "string", "description": "登录账号", "required": true, "default": "", "example": "zhangsan01" },
        { "field_name": "password_hash", "type": "string", "description": "加密后的密码", "required": true, "default": "", "example": "$2b$10$abcxyz..." },
        { "field_name": "role_id", "type": "string", "description": "角色ID", "required": true, "default": "", "example": "role_user" },
        { "field_name": "nickname", "type": "string", "description": "昵称", "required": false, "default": "", "example": "张三" },
        { "field_name": "phone", "type": "string", "description": "手机号", "required": false, "default": "", "example": "13800138000" },
        { "field_name": "email", "type": "string", "description": "邮箱", "required": false, "default": "", "example": "zhangsan@example.com" },
        { "field_name": "status", "type": "string", "description": "账号状态", "required": true, "default": "ACTIVE", "example": "ACTIVE" },
        { "field_name": "failed_login_count", "type": "number", "description": "连续登录失败次数", "required": true, "default": 0, "example": 1 },
        { "field_name": "last_login_at", "type": "string", "description": "最后登录时间", "required": false, "default": null, "example": "2026-04-13T20:10:00+08:00" },
        { "field_name": "password_reset_required", "type": "boolean", "description": "是否强制重置密码", "required": true, "default": false, "example": false },
        { "field_name": "created_at", "type": "string", "description": "创建时间", "required": true, "default": "now()", "example": "2026-04-13T18:00:00+08:00" },
        { "field_name": "updated_at", "type": "string", "description": "更新时间", "required": true, "default": "now()", "example": "2026-04-13T20:10:00+08:00" }
      ],
      "sample_data": {
        "_id": "usr_001",
        "account": "zhangsan01",
        "password_hash": "$2b$10$abcxyz...",
        "role_id": "role_user",
        "nickname": "张三",
        "phone": "13800138000",
        "email": "zhangsan@example.com",
        "status": "ACTIVE",
        "failed_login_count": 0,
        "last_login_at": "2026-04-13T20:10:00+08:00",
        "password_reset_required": false,
        "created_at": "2026-04-13T18:00:00+08:00",
        "updated_at": "2026-04-13T20:10:00+08:00"
      },
      "relationships": [
        "users.role_id -> roles._id",
        "users._id -> bills.user_id",
        "users._id -> notifications.user_id",
        "users._id -> operation_logs.operator_user_id"
      ]
    },
    {
      "entity_name": "roles",
      "description": "角色表，定义用户端和管理员端权限集合",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "角色ID", "required": true, "default": "uuid", "example": "role_user" },
        { "field_name": "role_code", "type": "string", "description": "角色编码", "required": true, "default": "", "example": "USER" },
        { "field_name": "role_name", "type": "string", "description": "角色名称", "required": true, "default": "", "example": "普通用户" },
        { "field_name": "permissions", "type": "array<string>", "description": "权限编码列表", "required": true, "default": [], "example": ["bill:create", "bill:view:own", "stats:view:own"] },
        { "field_name": "landing_page", "type": "string", "description": "登录后默认首页路由", "required": true, "default": "", "example": "/pages/user/home/index" },
        { "field_name": "status", "type": "string", "description": "角色状态", "required": true, "default": "ACTIVE", "example": "ACTIVE" }
      ],
      "sample_data": {
        "_id": "role_user",
        "role_code": "USER",
        "role_name": "普通用户",
        "permissions": ["bill:create", "bill:view:own", "stats:view:own", "review:view:own"],
        "landing_page": "/pages/user/home/index",
        "status": "ACTIVE"
      },
      "relationships": [
        "roles._id -> users.role_id"
      ]
    },
    {
      "entity_name": "bills",
      "description": "账单主表，存储账单基础信息、识别结果摘要和状态",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "账单ID", "required": true, "default": "uuid", "example": "bill_001" },
        { "field_name": "user_id", "type": "string", "description": "所属用户ID", "required": true, "default": "", "example": "usr_001" },
        { "field_name": "bill_type", "type": "string", "description": "账单类型", "required": true, "default": "RECEIPT", "example": "INVOICE" },
        { "field_name": "source_type", "type": "string", "description": "上传来源类型", "required": true, "default": "IMAGE", "example": "PDF" },
        { "field_name": "merchant_name", "type": "string", "description": "商家名称", "required": false, "default": "", "example": "盒马鲜生" },
        { "field_name": "bill_date", "type": "string", "description": "账单日期", "required": false, "default": null, "example": "2026-04-12" },
        { "field_name": "currency", "type": "string", "description": "币种", "required": true, "default": "CNY", "example": "CNY" },
        { "field_name": "total_amount", "type": "number", "description": "账单总金额", "required": false, "default": 0, "example": 128.5 },
        { "field_name": "actual_amount", "type": "number", "description": "实付金额", "required": false, "default": 0, "example": 118.5 },
        { "field_name": "discount_amount", "type": "number", "description": "优惠金额", "required": false, "default": 0, "example": 10.0 },
        { "field_name": "tax_amount", "type": "number", "description": "税额", "required": false, "default": 0, "example": 1.2 },
        { "field_name": "category_code", "type": "string", "description": "账单分类编码", "required": false, "default": "uncategorized", "example": "food" },
        { "field_name": "ai_category_code", "type": "string", "description": "AI 推荐分类编码", "required": false, "default": "", "example": "food" },
        { "field_name": "ocr_status", "type": "string", "description": "OCR 状态", "required": true, "default": "PENDING", "example": "SUCCESS" },
        { "field_name": "review_status", "type": "string", "description": "AI 审查状态", "required": true, "default": "PENDING", "example": "NEEDS_REVIEW" },
        { "field_name": "risk_level", "type": "string", "description": "风险等级", "required": true, "default": "LOW", "example": "HIGH" },
        { "field_name": "duplicate_group_id", "type": "string", "description": "重复账单分组ID", "required": false, "default": null, "example": "dup_20260412_01" },
        { "field_name": "remark", "type": "string", "description": "用户备注", "required": false, "default": "", "example": "周末买菜小票" },
        { "field_name": "tags", "type": "array<string>", "description": "标签列表", "required": false, "default": [], "example": ["家庭消费", "超市"] },
        { "field_name": "is_deleted", "type": "boolean", "description": "是否逻辑删除", "required": true, "default": false, "example": false },
        { "field_name": "created_at", "type": "string", "description": "创建时间", "required": true, "default": "now()", "example": "2026-04-13T19:00:00+08:00" },
        { "field_name": "updated_at", "type": "string", "description": "更新时间", "required": true, "default": "now()", "example": "2026-04-13T19:05:00+08:00" }
      ],
      "sample_data": {
        "_id": "bill_001",
        "user_id": "usr_001",
        "bill_type": "INVOICE",
        "source_type": "PDF",
        "merchant_name": "盒马鲜生",
        "bill_date": "2026-04-12",
        "currency": "CNY",
        "total_amount": 128.5,
        "actual_amount": 118.5,
        "discount_amount": 10.0,
        "tax_amount": 1.2,
        "category_code": "food",
        "ai_category_code": "food",
        "ocr_status": "SUCCESS",
        "review_status": "NEEDS_REVIEW",
        "risk_level": "HIGH",
        "duplicate_group_id": null,
        "remark": "周末买菜小票",
        "tags": ["家庭消费", "超市"],
        "is_deleted": false,
        "created_at": "2026-04-13T19:00:00+08:00",
        "updated_at": "2026-04-13T19:05:00+08:00"
      },
      "relationships": [
        "bills.user_id -> users._id",
        "bills._id -> bill_items.bill_id",
        "bills._id -> bill_attachments.bill_id",
        "bills._id -> ai_review_results.bill_id",
        "bills._id -> bill_statistics.bill_id"
      ]
    },
    {
      "entity_name": "bill_items",
      "description": "账单明细表，存储每一行商品或消费项目",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "明细ID", "required": true, "default": "uuid", "example": "item_001" },
        { "field_name": "bill_id", "type": "string", "description": "所属账单ID", "required": true, "default": "", "example": "bill_001" },
        { "field_name": "item_name", "type": "string", "description": "明细名称", "required": true, "default": "", "example": "三文鱼刺身" },
        { "field_name": "quantity", "type": "number", "description": "数量", "required": false, "default": 1, "example": 2 },
        { "field_name": "unit_price", "type": "number", "description": "单价", "required": false, "default": 0, "example": 29.9 },
        { "field_name": "subtotal_amount", "type": "number", "description": "小计金额", "required": false, "default": 0, "example": 59.8 },
        { "field_name": "item_category_code", "type": "string", "description": "明细分类编码", "required": false, "default": "uncategorized", "example": "food" },
        { "field_name": "ai_category_code", "type": "string", "description": "AI 推荐分类", "required": false, "default": "", "example": "food" },
        { "field_name": "confidence", "type": "number", "description": "识别置信度", "required": true, "default": 0, "example": 0.92 },
        { "field_name": "sort_no", "type": "number", "description": "排序号", "required": true, "default": 1, "example": 1 }
      ],
      "sample_data": {
        "_id": "item_001",
        "bill_id": "bill_001",
        "item_name": "三文鱼刺身",
        "quantity": 2,
        "unit_price": 29.9,
        "subtotal_amount": 59.8,
        "item_category_code": "food",
        "ai_category_code": "food",
        "confidence": 0.92,
        "sort_no": 1
      },
      "relationships": [
        "bill_items.bill_id -> bills._id"
      ]
    },
    {
      "entity_name": "bill_attachments",
      "description": "账单附件表，存储原始图片、PDF、缩略图等文件信息",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "附件ID", "required": true, "default": "uuid", "example": "att_001" },
        { "field_name": "bill_id", "type": "string", "description": "账单ID", "required": true, "default": "", "example": "bill_001" },
        { "field_name": "file_name", "type": "string", "description": "文件名", "required": true, "default": "", "example": "hema_invoice_20260412.pdf" },
        { "field_name": "file_type", "type": "string", "description": "文件类型", "required": true, "default": "image/jpeg", "example": "application/pdf" },
        { "field_name": "file_size", "type": "number", "description": "文件大小，单位字节", "required": true, "default": 0, "example": 204800 },
        { "field_name": "storage_path", "type": "string", "description": "对象存储路径", "required": true, "default": "", "example": "cloud://lianlian-prod/bills/usr_001/20260412/invoice.pdf" },
        { "field_name": "file_url", "type": "string", "description": "可访问文件地址", "required": true, "default": "", "example": "https://cdn.xxx.com/bills/usr_001/20260412/invoice.pdf" },
        { "field_name": "thumbnail_url", "type": "string", "description": "缩略图地址", "required": false, "default": "", "example": "https://cdn.xxx.com/thumb/invoice.png" },
        { "field_name": "file_hash", "type": "string", "description": "文件哈希，用于去重", "required": true, "default": "", "example": "sha256:abcd1234" },
        { "field_name": "upload_status", "type": "string", "description": "上传状态", "required": true, "default": "UPLOADED", "example": "UPLOADED" },
        { "field_name": "created_at", "type": "string", "description": "创建时间", "required": true, "default": "now()", "example": "2026-04-13T19:00:01+08:00" }
      ],
      "sample_data": {
        "_id": "att_001",
        "bill_id": "bill_001",
        "file_name": "hema_invoice_20260412.pdf",
        "file_type": "application/pdf",
        "file_size": 204800,
        "storage_path": "cloud://lianlian-prod/bills/usr_001/20260412/invoice.pdf",
        "file_url": "https://cdn.xxx.com/bills/usr_001/20260412/invoice.pdf",
        "thumbnail_url": "https://cdn.xxx.com/thumb/invoice.png",
        "file_hash": "sha256:abcd1234",
        "upload_status": "UPLOADED",
        "created_at": "2026-04-13T19:00:01+08:00"
      },
      "relationships": [
        "bill_attachments.bill_id -> bills._id"
      ]
    },
    {
      "entity_name": "ai_review_results",
      "description": "AI 审查结果表，存储每次审查输出和风险标签",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "审查记录ID", "required": true, "default": "uuid", "example": "review_001" },
        { "field_name": "bill_id", "type": "string", "description": "账单ID", "required": true, "default": "", "example": "bill_001" },
        { "field_name": "review_version", "type": "string", "description": "审查版本号", "required": true, "default": "v1", "example": "v1.0.0" },
        { "field_name": "review_conclusion", "type": "string", "description": "审查结论", "required": true, "default": "PASS", "example": "NEEDS_REVIEW" },
        { "field_name": "risk_level", "type": "string", "description": "风险等级", "required": true, "default": "LOW", "example": "HIGH" },
        { "field_name": "risk_tags", "type": "array<string>", "description": "风险标签", "required": true, "default": [], "example": ["AMOUNT_MISMATCH", "LOW_IMAGE_QUALITY"] },
        { "field_name": "confidence_score", "type": "number", "description": "整体可信度评分", "required": true, "default": 0, "example": 0.73 },
        { "field_name": "review_summary", "type": "string", "description": "审查摘要", "required": true, "default": "", "example": "明细合计与总金额不一致，建议人工复核。" },
        { "field_name": "review_suggestions", "type": "array<string>", "description": "审查建议列表", "required": true, "default": [], "example": ["请核对总金额", "请重新上传清晰账单"] },
        { "field_name": "requires_manual_check", "type": "boolean", "description": "是否需要人工复核", "required": true, "default": false, "example": true },
        { "field_name": "rule_hits", "type": "array<object>", "description": "命中的规则列表", "required": false, "default": [], "example": [{ "rule_code": "R001", "message": "明细和总额不一致" }] },
        { "field_name": "reviewed_at", "type": "string", "description": "审查完成时间", "required": true, "default": "now()", "example": "2026-04-13T19:03:00+08:00" }
      ],
      "sample_data": {
        "_id": "review_001",
        "bill_id": "bill_001",
        "review_version": "v1.0.0",
        "review_conclusion": "NEEDS_REVIEW",
        "risk_level": "HIGH",
        "risk_tags": ["AMOUNT_MISMATCH", "LOW_IMAGE_QUALITY"],
        "confidence_score": 0.73,
        "review_summary": "明细合计与总金额不一致，建议人工复核。",
        "review_suggestions": ["请核对总金额", "请重新上传清晰账单"],
        "requires_manual_check": true,
        "rule_hits": [{ "rule_code": "R001", "message": "明细和总额不一致" }],
        "reviewed_at": "2026-04-13T19:03:00+08:00"
      },
      "relationships": [
        "ai_review_results.bill_id -> bills._id"
      ]
    },
    {
      "entity_name": "bill_statistics",
      "description": "账单统计快照表，存储单账单统计和聚合分析结果",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "统计记录ID", "required": true, "default": "uuid", "example": "stat_001" },
        { "field_name": "bill_id", "type": "string", "description": "账单ID", "required": false, "default": null, "example": "bill_001" },
        { "field_name": "user_id", "type": "string", "description": "用户ID", "required": true, "default": "", "example": "usr_001" },
        { "field_name": "stat_type", "type": "string", "description": "统计类型", "required": true, "default": "MONTHLY", "example": "MONTHLY" },
        { "field_name": "stat_period", "type": "string", "description": "统计周期标识", "required": true, "default": "", "example": "2026-04" },
        { "field_name": "total_amount", "type": "number", "description": "周期总金额", "required": true, "default": 0, "example": 5680.3 },
        { "field_name": "bill_count", "type": "number", "description": "账单数量", "required": true, "default": 0, "example": 42 },
        { "field_name": "category_breakdown", "type": "array<object>", "description": "分类金额分布", "required": false, "default": [], "example": [{ "category_code": "food", "amount": 1820.5, "count": 15 }] },
        { "field_name": "merchant_top_list", "type": "array<object>", "description": "商家排行", "required": false, "default": [], "example": [{ "merchant_name": "盒马鲜生", "amount": 860.0 }] },
        { "field_name": "risk_bill_count", "type": "number", "description": "风险账单数", "required": true, "default": 0, "example": 4 },
        { "field_name": "generated_at", "type": "string", "description": "生成时间", "required": true, "default": "now()", "example": "2026-04-13T19:10:00+08:00" }
      ],
      "sample_data": {
        "_id": "stat_001",
        "bill_id": null,
        "user_id": "usr_001",
        "stat_type": "MONTHLY",
        "stat_period": "2026-04",
        "total_amount": 5680.3,
        "bill_count": 42,
        "category_breakdown": [{ "category_code": "food", "amount": 1820.5, "count": 15 }],
        "merchant_top_list": [{ "merchant_name": "盒马鲜生", "amount": 860.0 }],
        "risk_bill_count": 4,
        "generated_at": "2026-04-13T19:10:00+08:00"
      },
      "relationships": [
        "bill_statistics.user_id -> users._id",
        "bill_statistics.bill_id -> bills._id"
      ]
    },
    {
      "entity_name": "notifications",
      "description": "通知表，存储系统通知、异常提醒、审查提醒等",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "通知ID", "required": true, "default": "uuid", "example": "notice_001" },
        { "field_name": "user_id", "type": "string", "description": "接收用户ID", "required": true, "default": "", "example": "usr_001" },
        { "field_name": "notice_type", "type": "string", "description": "通知类型", "required": true, "default": "SYSTEM", "example": "BILL_REVIEW" },
        { "field_name": "title", "type": "string", "description": "通知标题", "required": true, "default": "", "example": "账单需要复核" },
        { "field_name": "content", "type": "string", "description": "通知内容", "required": true, "default": "", "example": "你上传的账单存在金额不一致，请及时核对。" },
        { "field_name": "related_bill_id", "type": "string", "description": "关联账单ID", "required": false, "default": null, "example": "bill_001" },
        { "field_name": "is_read", "type": "boolean", "description": "是否已读", "required": true, "default": false, "example": false },
        { "field_name": "created_at", "type": "string", "description": "创建时间", "required": true, "default": "now()", "example": "2026-04-13T19:03:30+08:00" },
        { "field_name": "read_at", "type": "string", "description": "阅读时间", "required": false, "default": null, "example": null }
      ],
      "sample_data": {
        "_id": "notice_001",
        "user_id": "usr_001",
        "notice_type": "BILL_REVIEW",
        "title": "账单需要复核",
        "content": "你上传的账单存在金额不一致，请及时核对。",
        "related_bill_id": "bill_001",
        "is_read": false,
        "created_at": "2026-04-13T19:03:30+08:00",
        "read_at": null
      },
      "relationships": [
        "notifications.user_id -> users._id",
        "notifications.related_bill_id -> bills._id"
      ]
    },
    {
      "entity_name": "operation_logs",
      "description": "操作日志表，记录登录、上传、修改、规则变更等行为",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "日志ID", "required": true, "default": "uuid", "example": "log_001" },
        { "field_name": "operator_user_id", "type": "string", "description": "操作人ID", "required": true, "default": "", "example": "usr_001" },
        { "field_name": "operator_role_code", "type": "string", "description": "操作人角色", "required": true, "default": "", "example": "USER" },
        { "field_name": "module", "type": "string", "description": "模块名称", "required": true, "default": "", "example": "BILL_UPLOAD" },
        { "field_name": "action", "type": "string", "description": "操作动作", "required": true, "default": "", "example": "CREATE" },
        { "field_name": "target_type", "type": "string", "description": "目标对象类型", "required": false, "default": "", "example": "BILL" },
        { "field_name": "target_id", "type": "string", "description": "目标对象ID", "required": false, "default": null, "example": "bill_001" },
        { "field_name": "request_id", "type": "string", "description": "请求追踪ID", "required": false, "default": null, "example": "req_20260413_001" },
        { "field_name": "ip_address", "type": "string", "description": "IP 地址", "required": false, "default": "", "example": "10.0.0.1" },
        { "field_name": "device_info", "type": "string", "description": "设备信息", "required": false, "default": "", "example": "iPhone 15 Pro / WeChat 8.x" },
        { "field_name": "result", "type": "string", "description": "执行结果", "required": true, "default": "SUCCESS", "example": "SUCCESS" },
        { "field_name": "details", "type": "object", "description": "详细内容", "required": false, "default": {}, "example": { "message": "上传账单成功" } },
        { "field_name": "created_at", "type": "string", "description": "记录时间", "required": true, "default": "now()", "example": "2026-04-13T19:00:02+08:00" }
      ],
      "sample_data": {
        "_id": "log_001",
        "operator_user_id": "usr_001",
        "operator_role_code": "USER",
        "module": "BILL_UPLOAD",
        "action": "CREATE",
        "target_type": "BILL",
        "target_id": "bill_001",
        "request_id": "req_20260413_001",
        "ip_address": "10.0.0.1",
        "device_info": "iPhone 15 Pro / WeChat 8.x",
        "result": "SUCCESS",
        "details": { "message": "上传账单成功" },
        "created_at": "2026-04-13T19:00:02+08:00"
      },
      "relationships": [
        "operation_logs.operator_user_id -> users._id"
      ]
    },
    {
      "entity_name": "audit_rules",
      "description": "AI 审查规则表，支持动态配置审查条件和阈值",
      "fields": [
        { "field_name": "_id", "type": "string", "description": "规则ID", "required": true, "default": "uuid", "example": "rule_001" },
        { "field_name": "rule_code", "type": "string", "description": "规则编码", "required": true, "default": "", "example": "R001" },
        { "field_name": "rule_name", "type": "string", "description": "规则名称", "required": true, "default": "", "example": "明细金额与总金额一致性检查" },
        { "field_name": "rule_type", "type": "string", "description": "规则类型", "required": true, "default": "AMOUNT_CHECK", "example": "AMOUNT_CHECK" },
        { "field_name": "description", "type": "string", "description": "规则说明", "required": false, "default": "", "example": "检查明细小计之和与总金额差值是否超过阈值" },
        { "field_name": "conditions", "type": "object", "description": "规则条件配置", "required": true, "default": {}, "example": { "max_delta": 0.01 } },
        { "field_name": "risk_level", "type": "string", "description": "命中后风险等级", "required": true, "default": "MEDIUM", "example": "HIGH" },
        { "field_name": "action_type", "type": "string", "description": "命中后动作", "required": true, "default": "MARK", "example": "MANUAL_REVIEW" },
        { "field_name": "status", "type": "string", "description": "规则状态", "required": true, "default": "ACTIVE", "example": "ACTIVE" },
        { "field_name": "priority", "type": "number", "description": "优先级", "required": true, "default": 100, "example": 10 },
        { "field_name": "version", "type": "string", "description": "规则版本", "required": true, "default": "v1", "example": "v1.0.0" },
        { "field_name": "created_by", "type": "string", "description": "创建人ID", "required": true, "default": "", "example": "usr_admin_001" },
        { "field_name": "created_at", "type": "string", "description": "创建时间", "required": true, "default": "now()", "example": "2026-04-13T18:30:00+08:00" },
        { "field_name": "updated_at", "type": "string", "description": "更新时间", "required": true, "default": "now()", "example": "2026-04-13T18:45:00+08:00" }
      ],
      "sample_data": {
        "_id": "rule_001",
        "rule_code": "R001",
        "rule_name": "明细金额与总金额一致性检查",
        "rule_type": "AMOUNT_CHECK",
        "description": "检查明细小计之和与总金额差值是否超过阈值",
        "conditions": { "max_delta": 0.01 },
        "risk_level": "HIGH",
        "action_type": "MANUAL_REVIEW",
        "status": "ACTIVE",
        "priority": 10,
        "version": "v1.0.0",
        "created_by": "usr_admin_001",
        "created_at": "2026-04-13T18:30:00+08:00",
        "updated_at": "2026-04-13T18:45:00+08:00"
      },
      "relationships": [
        "audit_rules.created_by -> users._id",
        "audit_rules.rule_code -> ai_review_results.rule_hits.rule_code"
      ]
    }
  ]
}
```

## 9. 技术架构建议

### 9.1 微信小程序前端架构建议
建议将当前示例工程重构为业务化目录结构：

```text
miniprogram/
  pages/
    auth/
      login/
      reset-password/
    user/
      home/
      upload/
      recognition-result/
      bill-detail/
      ai-review/
      history/
      analytics/
      profile/
    admin/
      dashboard/
      users/
      bills/
      abnormal-bills/
      rules/
      logs/
  components/
    bill-card/
    risk-tag/
    amount-summary/
    chart-panel/
    upload-panel/
  services/
    auth.js
    user.js
    bill.js
    review.js
    stats.js
    admin.js
  store/
    app-store.js
    user-store.js
  utils/
    request.js
    permission.js
    formatter.js
    chart.js
```

前端建议：
1. 页面层负责展示与交互。
2. `services` 统一封装接口请求。
3. `store` 维护登录态、角色、权限和基础缓存。
4. `components` 抽取通用账单卡片、风险标签、图表容器等组件。
5. 采用分包加载，用户端和管理员端分开，减少主包体积。

### 9.2 后端接口模块建议
建议拆分为以下模块：
1. 认证模块 `auth`
   - 登录
   - 退出
   - 刷新 token
   - 密码重置
2. 用户模块 `users`
   - 获取个人信息
   - 修改资料
   - 用户列表
   - 账号状态管理
3. 账单模块 `bills`
   - 创建账单
   - 上传附件
   - 查询账单列表
   - 获取账单详情
   - 编辑账单
   - 删除账单
4. OCR 模块 `ocr`
   - 发起识别
   - 查询识别结果
   - 重新识别
5. 审查模块 `reviews`
   - 发起 AI 审查
   - 查询审查结果
   - 人工复核提交
6. 统计模块 `statistics`
   - 首页统计
   - 分类统计
   - 趋势统计
   - 商家排行
7. 管理模块 `admin`
   - 全局统计
   - 异常账单
   - 规则管理
   - 日志查询

### 9.3 OCR 与 AI 识别流程设计
```text
用户上传文件
-> 文件存储与附件落库
-> 图片/PDF 预处理
-> OCR 识别文本与坐标
-> 文档版面分析
-> LLM 结构化抽取 JSON
-> 字段置信度评分
-> 金额规则校验
-> AI 审查
-> 保存识别结果与审查结果
-> 通知用户查看
```

### 9.4 JSON 数据存储与调用逻辑
1. 账单主信息存 `bills`。
2. 明细行单独存 `bill_items`，方便后续统计。
3. 原始文件单独存 `bill_attachments`，便于多附件扩展。
4. AI 审查输出单独存 `ai_review_results`，支持版本化。
5. 聚合结果存 `bill_statistics`，用于加速图表页面。
6. 规则存 `audit_rules`，支持管理员动态调整阈值。

调用逻辑建议：
1. 列表页优先读取 `bills` 摘要字段。
2. 详情页按需查询 `bill_items`、`bill_attachments`、`ai_review_results`。
3. 统计页优先读取预聚合的 `bill_statistics`，避免每次实时全量计算。

### 9.5 基于角色的权限控制设计
1. 登录后后端返回 `role_code`、`permissions`、`landing_page`。
2. 前端将其缓存到全局状态。
3. 页面进入时校验页面权限。
4. 接口调用时由后端二次校验角色和数据归属。
5. 管理接口统一要求管理员角色。
6. 普通用户接口必须附带 `user_id = 当前登录用户ID` 的数据隔离限制。

### 9.6 账单图片/文件上传存储方案
建议使用“微信小程序上传 + 云对象存储 + CDN + 附件元数据落库”的方案。

#### 存储流程
1. 前端选择文件。
2. 获取上传签名或云存储路径。
3. 文件上传到对象存储。
4. 生成缩略图或预览图。
5. 记录附件元数据到 `bill_attachments`。

#### 路径建议
```text
/bills/{user_id}/{yyyyMM}/{bill_id}/original/
/bills/{user_id}/{yyyyMM}/{bill_id}/preview/
```

### 9.7 AI 审查结果返回机制
建议采用“异步任务 + 轮询/订阅结果”的方式。

#### 原因
OCR 和 AI 审查耗时不稳定，若全部同步等待，用户体验较差。

#### 机制
1. 上传后立即返回任务 ID。
2. 前端进入“识别中”状态页。
3. 后端异步完成 OCR 与 AI 审查。
4. 前端轮询查询任务状态，或通过订阅消息通知用户。
5. 识别完成后自动跳转到识别结果页或审查结果页。

### 9.8 图表统计实现建议
1. 小程序端采用 `F2`、`uCharts`、`ECharts for WeChat` 等图表库。
2. 统计接口返回轻量 JSON，不在前端做复杂计算。
3. 分类图、趋势图、排行图等采用不同接口分别返回。
4. 高频统计数据可按天离线聚合，提升响应速度。

## 10. 项目亮点与创新点总结

### 10.1 亮点总结
1. 从传统报销场景转向个人账单智能管理，应用场景更广。
2. 支持图片、截图、发票、PDF 等多账单形态统一接入。
3. 采用 OCR + LLM 结合方式，将非结构化账单转成结构化数据。
4. 引入 AI 审查机制，不仅识别账单，还判断账单是否可信、完整、合理。
5. 提供分类统计、趋势分析、异常分析和风险提示，增强消费透明度。
6. 支持用户纠错和管理员规则配置，兼顾智能化与可控性。
7. 数据结构采用 JSON 文档模型，天然适配云开发和快速迭代。

### 10.2 创新点
1. “识别 + 审查 + 管理 + 分析”闭环设计，不只是 OCR 工具。
2. 引入重复账单识别、金额一致性校验、图像质量检测等多维审查机制。
3. 将 AI 审查结果解释化输出，便于用户理解和修正。
4. 管理端支持动态规则调整，可逐步提升识别质量与审查精度。
5. 面向课程设计和系统开发都具备较强落地性，可直接演进为可运行项目。

### 10.3 后续可扩展方向
1. 预算管理与超支预警
2. 月度/年度报表导出
3. 家庭共享账本
4. 多币种账单识别
5. 发票真伪校验接口接入
6. 语音录入补充说明
7. 消费习惯智能建议
