# chaoxing-ai-study-helper

> **超星学习通 AI 学习辅助篡改猴脚本** — 加密字体解密 · 智能题目提取 · AI 自动生成答案

---

## ⚠️ 免责声明

> **本项目仅用于前端技术学习与篡改猴（Tampermonkey）脚本开发交流。严禁用于考试作弊、违规答题、刷课等违反超星学习通平台规则、学校校规及相关法律法规的行为。**
>
> 使用者需自行承担使用本脚本带来的一切后果。项目作者不承担任何学业、法律及连带责任。
>
> **禁止将本项目用于任何商业用途。**

---

## ✨ 功能特性

- **🔤 超星 font-cxsecret 加密字体自动解密** — 基于字形 MD5 匹配算法，解决题目乱码问题，支持最新的超星字体加密方案
- **🧠 智能题目提取** — 多层过滤机制避免重复与误识别，支持单选题、多选题、判断题、填空题、简答题等常见题型
- **🤖 对接大模型 API 自动生成答案** — 支持智谱 GLM、DeepSeek 等所有兼容 OpenAI 格式的模型（目前已测试 DeepSeek 和智谱 GLM 的 API可以使用）
- **📝 章节摘要与知识点提取** — 自动提取页面正文内容，生成章节摘要和高频知识点列表
- **💬 讨论草稿自动生成** — 根据章节内容智能生成讨论区发言草稿，一键填入
- **🪟 浮动面板** — 挂载浏览器顶层窗口，固定不跟随页面滚动，支持拖拽、缩放、收起/展开
- **⚙️ 可配置参数** — 题目上限、文本长度阈值、过滤关键词、AI 模型参数均可自由调整

---

## 📦 安装教程

### 前置环境

- **浏览器**：Chrome / Edge / Firefox（推荐 Chrome 或 Edge）
- **脚本管理器**：[Tampermonkey（篡改猴）](https://www.tampermonkey.net/)（必须安装）

### 安装步骤

1. **安装篡改猴扩展**：在浏览器的扩展商店搜索 "Tampermonkey" 并安装
2. **新建脚本**：点击浏览器工具栏中的篡改猴图标 → "添加新脚本"
3. **粘贴代码**：将 `chaoxing-ai-helper.user.js` 的全部代码复制并覆盖到编辑器中
4. **保存脚本**：按 `Ctrl + S`（Mac：`Cmd + S`）保存，脚本即开始生效
5. 访问超星学习通（chaoxing.com）相关页面，页面加载后浮动面板会自动出现在右上角

---

## 🚀 使用说明

### 基础使用流程

1. 打开超星学习通的作业 / 测验 / 章节页面
2. 点击浮动面板中的 **「刷新解析」** 按钮，等待页面文本解析完成
3. 点击 **「AI 生成答案」** 按钮，等待 AI 返回结果
4. 面板中会显示每道题目的 AI 标准答案（所有操作均 **不会自动提交试卷**）

### API 配置教程

AI 功能需要您自行配置 API 接口。打开脚本源码，找到 `AI_CONFIG` 配置段（约第 270 行）：

```javascript
const AI_CONFIG = {
  apiUrl: "https://api.deepseek.com/chat/completions",   // API 接口地址
  apiKey: "",                                             // 在双引号中粘贴你的 API 密钥
  model: "deepseek-chat",                                 // 模型名称
  temperature: 0.1,                                       // 生成温度（0~1）
  // ...
};
```

#### 智谱 GLM 配置示例

```javascript
apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
apiKey: "你的智谱API密钥",
model: "glm-4-flash",
```

#### DeepSeek 配置示例

```javascript
apiUrl: "https://api.deepseek.com/chat/completions",
apiKey: "sk-你的DeepSeek密钥",
model: "deepseek-chat",
```

> **提示**：其他兼容 OpenAI 格式的 API（如通义千问、Kimi 等）也可以使用，只需修改 `apiUrl`、`apiKey` 和 `model` 三个参数即可。

### 常用功能说明

| 功能 | 操作方式 |
|------|----------|
| 查看字体解密状态 | 面板顶部显示「字体解密状态：成功/失败」 |
| 调整显示题目数量 | 修改 `MAX_QUESTION_COUNT` 常数（默认 35） |
| 拖拽面板 | 按住面板顶部标题区域拖动 |
| 缩放面板 | 拖拽面板右下角调整大小 |
| 收起/展开面板 | 点击面板右上角「收起」/「展开」按钮 |

---

## ⚙️ 自定义配置

脚本顶部定义了一系列可调参数，您可以根据需要修改：

| 参数名 | 默认值 | 说明 |
|--------|--------|------|
| `MAX_CONTENT_LENGTH` | 6000 | 发送给 AI 的最大文本长度（字符数） |
| `MAX_QUESTION_COUNT` | 35 | 最大提取题目数量 |
| `OCR_MIN_TEXT_LENGTH` | 120 | OCR 触发的最小文本长度阈值 |
| `DOM_GOOD_CONTENT_LENGTH` | 220 | DOM 文本质量判定阈值 |
| `OCR_MAX_SCROLL_STEPS` | 8 | OCR 滚动最大步数 |
| `MIN_QUESTION_TEXT_LEN` | 30 | 题干最小字符数，低于此值将被过滤 |
| `MIN_OPTION_TEXT_LEN` | 3 | 选项最小字符数 |
| `STOP_WORDS` | （详见源码） | 关键词提取时的停用词表 |
| `NOISE_WORDS` | （详见源码） | 干扰关键词，命中过多则丢弃文本 |
| `QUESTION_MARK_WORDS` | （详见源码） | 题型特征关键词，用于识别题目 |
| `TARGET_SIDEBAR_INDEX` | 3 | 在多层 iframe 中显示的面板序号 |
| `AI_CONFIG.operateDelay` | 1800 | 自动填入答案时的操作间隔（毫秒） |

---

## 🙏 参考与致谢

- **字体解密方案** — 参考自 [forestpolice.org](https://www.forestpolice.org) 提供的超星字体反爬解密方案，基于 Typr.js 的字形 MD5 匹配算法与官方字形映射表，是目前超星字体解密的通用主流方案
- **依赖开源项目**：
  - [tesseract.js](https://github.com/naptha/tesseract.js) — 纯前端 OCR 引擎，用于图片/PDF 中的文本识别
  - [Typr.js](https://github.com/finh/Vecta/wiki/Typr.js-documentation) — 字体文件解析库

---

## 📜 开源协议

本项目基于 [MIT 许可证](./LICENSE) 开源。

---

> **⚠️ 再次提醒：本脚本仅用于学习与交流，请勿用于任何违规用途。使用本脚本所产生的一切后果由使用者自行承担。**
