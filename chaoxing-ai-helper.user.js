// ==UserScript==
// @name         超星学习通AI学习辅助
// @namespace    https://github.com/bbpp/chaoxing-ai-study-helper
// @version      1.2.1
// @description  超星学习通AI学习辅助篡改猴脚本 — font-cxsecret加密字体自动解密、智能题目提取、对接大模型API生成答案、章节摘要提取、讨论草稿自动生成
// @author       bbpp
// @match        *://*.chaoxing.com/*
// @match        *://mooc1.chaoxing.com/*
// @match        *://*.edu.cn/*
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js
// @require      https://www.forestpolice.org/ttf/TyprMd5.js
// @resource     Table https://www.forestpolice.org/ttf/2.0/table.json
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @connect      open.bigmodel.cn
// @connect      api.deepseek.com
// @connect      www.forestpolice.org
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://github.com/bbpp12/chaoxing-ai-study-helper/raw/refs/heads/main/chaoxing-ai-helper.user.js
// @updateURL    https://github.com/bbpp12/chaoxing-ai-study-helper/raw/refs/heads/main/chaoxing-ai-helper.user.js
// ==/UserScript==

/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                     ⚠️  免责声明（请仔细阅读）                             ║
 * ║                                                                               ║
 * ║  本项目仅用于前端技术学习与篡改猴（Tampermonkey）脚本开发交流。                ║
 * ║  严禁用于考试作弊、违规答题、刷课等违反超星学习通平台规则、                   ║
 * ║  学校校规及相关法律法规的行为。                                               ║
 * ║                                                                               ║
 * ║  使用者需自行承担使用本脚本带来的一切后果。                                   ║
 * ║  项目作者不承担任何学业、法律及连带责任。                                     ║
 * ║                                                                               ║
 * ║  禁止将本项目用于任何商业用途。                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

(function () {
  'use strict';

  // ==========================================================================
  //  常量定义
  // ==========================================================================

  const PANEL_ID = 'trae-xxt-study-helper-panel';
  const STYLE_ID = 'trae-xxt-study-helper-style';

  /** AI 请求时最大发送文本长度（字符数） */
  const MAX_CONTENT_LENGTH = 6000;
  /** 最大提取题目数量 */
  const MAX_QUESTION_COUNT = 35;
  /** 触发 OCR 的最小文本长度阈值 */
  const OCR_MIN_TEXT_LENGTH = 120;
  /** OCR 候选元素最大数量 */
  const OCR_MAX_CANDIDATES = 2;
  /** DOM 文本质量判定阈值：超过此长度则不再执行 OCR */
  const DOM_GOOD_CONTENT_LENGTH = 220;
  /** OCR 滚动最大步数 */
  const OCR_MAX_SCROLL_STEPS = 8;
  /** OCR 滚动等待时间（毫秒） */
  const OCR_SCROLL_WAIT_MS = 900;
  /** OCR 连续无新文本时停止的容忍次数 */
  const OCR_STAGNANT_LIMIT = 2;

  /** 在多层 iframe 中显示面板的序号 */
  const TARGET_SIDEBAR_INDEX = 3;
  /** 目标框架范围描述 */
  const TARGET_SIDEBAR_SCOPE = '内嵌框架';

  // ==========================================================================
  //  停用词与选择器定义
  // ==========================================================================

  /** 关键词提取时过滤的停用词 */
  const STOP_WORDS = new Set([
    '我们', '你们', '他们', '这个', '那个', '以及', '进行', '通过', '因为', '所以', '如果', '可以',
    '需要', '当前', '本章', '章节', '内容', '知识', '学习', '讨论', '问题', '题目', '练习', '答案',
    '根据', '一个', '一种', '一些', '已经', '还有', '自己', '相关', '其中', '然后', '就是', '时候',
    '如何', '什么', '为什么', '对于', '关于', '并且', '能够', '具有', '出现', '为了', '没有', '不是',
    '中的', '以及', '本节', '课程', '单元', '方面', '情况', '分析', '说明', '理解', '判断', '选择',
    '填空', '简答', '材料', '下列', '正确', '错误', '选项'
  ]);

  /** 题目容器 CSS 选择器 */
  const QUESTION_SELECTORS = [
    '.TiMu',
    '.questionLi',
    '.questionWrap',
    '.mark_item',
    '.subjectBox',
    '.singleQuesId',
    '.stem_con',
    '.Zy_ulTop li',
    '.tkItem'
  ];

  /** 正文内容 CSS 选择器 */
  const CONTENT_SELECTORS = [
    '.mainCon',
    '.chapter',
    '.content',
    '.ans-cc',
    '.font-cxsecret',
    '.mark_content',
    '.course-content',
    '.article',
    '.detail',
    '.catalog_task'
  ];

  /** 标题 CSS 选择器 */
  const TITLE_SELECTORS = [
    'h1',
    '.chapter-title',
    '.mark_title',
    '.catalog_name',
    '.headtit',
    '.subNav .on',
    '.course-name'
  ];

  /** 选项容器 CSS 选择器 */
  const OPTION_SELECTORS = [
    '.Zy_ulTop li',
    '.answerList li',
    '.option',
    '.choices li',
    '.ulanswer li',
    'label'
  ];

  /** OCR 候选元素 CSS 选择器（图片/画布等可视元素） */
  const OCR_CANDIDATE_SELECTORS = [
    'img',
    'canvas',
    '.pdfViewer canvas',
    '.pdfViewer img',
    '.reader img',
    '.reader canvas',
    '.doc-view img',
    '.doc-view canvas',
    '.reader-page img',
    '.reader-page canvas'
  ];

  /** 手动排除选择器（目录、导航等非正文内容） */
  const MANUAL_EXCLUDE_SELECTORS = [
    '.catalog_task',
    '.catalog_name'
  ];

  /** 1. 完全排除的父容器（目录、导航、侧边栏、弹窗、讨论区） */
  const BLACKLIST_SELECTORS = [
    '.catalog_task', '.catalog_name', '.nav', '.sidebar', '.popup', '.dialog',
    '.discuss', '.talk', '.chapter-nav', '.page-header', '.page-footer',
    '.tip', '.notice', '.guide', '.advert', '#header', '#footer', '.readCatalog'
  ];

  /** 2. 纯干扰关键词（匹配到直接丢弃 — 章节介绍、知识点、目录文字等） */
  const NOISE_WORDS = new Set([
    '本章', '本节', '单元', '章节', '目录', '知识点', '学习目标', '拓展阅读',
    '参考答案', '解析', '查看答案', '返回', '上一页', '下一页', '提交', '保存',
    '讨论', '留言', '课件', '视频', '音频', '文档', '提示', '说明', '导语'
  ]);

  /** 3. 有效题目必须包含的题型特征（缺少则判定为非题目） */
  const QUESTION_MARK_WORDS = new Set([
    '单选题', '多选题', '判断题', '填空', '简答', '论述', '材料题',
    '下列', '正确', '错误', 'A.', 'B.', 'C.', 'D.',
    'A、', 'B、', 'C、', 'D、',
    '【单选', '【多选', '【判断'
  ]);

  /** 4. 文本长度过滤：题干太短直接排除 */
  const MIN_QUESTION_TEXT_LEN = 30;
  /** 选项最小字符长度，过滤纯字母、单个字符的无效选项 */
  const MIN_OPTION_TEXT_LEN = 3;

  /** 选项父容器黑名单：处于这些容器内的节点一定是选项，不可能是题目 */
  const OPTION_WRAPPER_SELECTORS = [
    '.Zy_ulTop', '.answerList', '.choices', '.ulanswer', '.option', '.answer-option'
  ];

  // ==========================================================================
  //  拖拽与缩放全局状态
  // ==========================================================================

  const dragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    panelLeft: 0,
    panelTop: 0
  };

  const resizeState = {
    isResizing: false,
    startX: 0,
    startY: 0,
    panelWidth: 0,
    panelHeight: 0
  };

  // ==========================================================================
  //  字体解密核心模块（修复版）
  //  方案：基于 Typr.js 解析字体文件 → 计算字形 MD5 → 匹配官方映射表 → 替换页面加密文本
  //  参考自 forestpolice.org 提供的超星字体反爬解密方案
  // ==========================================================================

  let fontDecryptStatus = '未执行';
  let fontDecryptCount = 0;

  /**
   * 将 Base64 字符串转换为 Uint8Array
   * @param {string} base64 - Base64 编码的字体数据
   * @returns {Uint8Array}
   */
  function base64ToUint8Array(base64) {
    const data = window.atob(base64);
    const buffer = new Uint8Array(data.length);
    for (let i = 0; i < data.length; ++i) {
      buffer[i] = data.charCodeAt(i);
    }
    return buffer;
  }

  /**
   * 解密页面中的 font-cxsecret 加密字体
   * 步骤：检测加密字体样式 → 提取 Base64 字体 → 解析字形 → MD5 匹配映射表 → 替换页面文本
   * @returns {boolean} 是否成功完成解密
   */
  function decryptFontCxSecret() {
    try {
      // 检查依赖是否加载
      if (typeof Typr === 'undefined') {
        fontDecryptStatus = '失败：Typr库未加载';
        console.warn('[字体解密] Typr 未定义，脚本资源加载失败');
        return false;
      }
      if (typeof md5 === 'undefined') {
        fontDecryptStatus = '失败：md5函数未加载';
        console.warn('[字体解密] md5 未定义，脚本资源加载失败');
        return false;
      }

      // 查找包含 font-cxsecret 的样式节点
      const styleNodes = document.querySelectorAll('style');
      let targetStyle = null;
      for (const style of styleNodes) {
        if (style.textContent.includes('font-cxsecret')) {
          targetStyle = style;
          break;
        }
      }
      if (!targetStyle) {
        fontDecryptStatus = '未检测到加密字体';
        return false;
      }

      // 提取 Base64 编码的字体数据
      const fontMatch = targetStyle.textContent.match(/base64,([\w\W]+?)'/);
      if (!fontMatch || !fontMatch[1]) {
        fontDecryptStatus = '失败：无法提取字体数据';
        return false;
      }

      // 使用 Typr.js 解析字体文件
      let fontData;
      try {
        fontData = Typr.parse(base64ToUint8Array(fontMatch[1]))[0];
      } catch (e) {
        fontDecryptStatus = '失败：字体解析出错';
        console.warn('[字体解密] 字体解析失败:', e);
        return false;
      }

      // 加载官方字形映射表
      let table;
      try {
        table = JSON.parse(GM_getResourceText('Table'));
      } catch (e) {
        fontDecryptStatus = '失败：映射表加载失败';
        console.warn('[字体解密] 映射表加载失败:', e);
        return false;
      }

      const charMap = {};
      let matchCount = 0;

      // 遍历中文 Unicode 范围（CJK 统一表意文字：U+4E00 ~ U+9F99），计算字形 MD5 并匹配映射表
      for (let i = 19968; i < 40870; i++) {
        const glyph = Typr.U.codeToGlyph(fontData, i);
        if (!glyph) continue;
        const path = Typr.U.glyphToPath(fontData, glyph);
        const hash = md5(JSON.stringify(path)).slice(24);
        if (table[hash]) {
          charMap[i] = table[hash];
          matchCount++;
        }
      }

      if (matchCount === 0) {
        fontDecryptStatus = '失败：无匹配字形';
        console.warn('[字体解密] 映射表与当前字体不匹配');
        return false;
      }

      // 批量替换页面中所有 .font-cxsecret 元素的加密字符
      const secretElements = document.querySelectorAll('.font-cxsecret');
      let replacedCount = 0;
      secretElements.forEach(el => {
        let html = el.innerHTML;
        let changed = false;
        Object.keys(charMap).forEach(key => {
          const fakeChar = String.fromCharCode(Number(key));
          const realChar = String.fromCharCode(charMap[key]);
          if (html.includes(fakeChar)) {
            html = html.replace(new RegExp(fakeChar, 'g'), realChar);
            changed = true;
          }
        });
        if (changed) {
          el.innerHTML = html;
          el.classList.remove('font-cxsecret');
          replacedCount++;
        }
      });

      fontDecryptCount = replacedCount;
      fontDecryptStatus = `成功：替换${replacedCount}处`;
      console.log(`[字体解密] 完成，匹配${matchCount}字，替换${replacedCount}处元素`);
      return true;
    } catch (err) {
      fontDecryptStatus = '失败：' + err.message;
      console.warn('[字体解密] 异常:', err);
      return false;
    }
  }

  /** 获取字体解密状态文本 */
  function getFontDecryptStatus() {
    return fontDecryptStatus;
  }

  // ==========================================================================
  //  AI 大模型配置
  //  支持所有兼容 OpenAI Chat Completions 格式的 API
  //
  //  配置示例：
  //    - 智谱 GLM: https://open.bigmodel.cn/api/paas/v4/chat/completions
  //      密钥格式: 无前缀
  //      推荐模型: glm-4-flash
  //
  //    - DeepSeek: https://api.deepseek.com/chat/completions
  //      密钥格式: sk-xxx
  //      推荐模型: deepseek-v4-flash
  // ==========================================================================

  const AI_CONFIG = {
    /** API 接口地址（替换为你使用的模型的完整 URL） */
    apiUrl: "https://api.deepseek.com/chat/completions",
    /** API 密钥（在双引号中间粘贴你的密钥） */
    apiKey: "",
    /** 模型名称 */
    model: "deepseek-v4-flash",
    /** 生成温度（0~1，越低越确定） */
    temperature: 0.1,
    /** 系统提示词，指导 AI 按要求输出纯 JSON */
    systemPrompt: `你是学习通答题助手，严格按要求输出纯JSON数组，不要额外文字。
题型区分：
1.单选题：只输出大写字母A/B/C/D
2.多选题：多个字母逗号分隔 A,B
3.判断题：正确 / 错误
4.填空/简答：直接输出标准答案
输出格式示例：
[
  {"idx":1,"type":"radio","ans":"A"},
  {"idx":2,"type":"checkbox","ans":"A,C"},
  {"idx":3,"type":"judge","ans":"正确"},
  {"idx":4,"type":"input","ans":"标准答案文本"}
]
仅返回纯JSON，无任何解释、换行、注释`,
    /** 讨论区发言模板池（随机选取一条填入） */
    discussPool: [
      "本章知识点梳理清晰，做完习题巩固了内容，对关键概念有了更系统的理解。",
      "借助习题查漏补缺，对本章内容理解更深，之前模糊的知识点现在清晰了。",
      "章节题目覆盖重点，理论结合例题更容易掌握。",
      "完成测验检验了学习成果，对后续章节更有信心。"
    ],
    /** 自动填入答案时的操作间隔（毫秒） */
    operateDelay: 1800
  };

  // ==========================================================================
  //  全局缓存变量
  // ==========================================================================

  /** 缓存提取的题目列表 */
  let cachedQuestionList = [];
  /** AI 返回的答案数据 */
  let aiAnswerData = [];

  // ==========================================================================
  //  浮动面板交互模块（拖拽 + 缩放）
  // ==========================================================================

  /**
   * 初始化面板的拖拽与缩放交互
   * @param {HTMLElement} panel - 浮动面板根元素
   */
  function initPanelInteractions(panel) {
    const topWin = window.top;
    const topDoc = topWin.document;

    // ========== 拖拽：事件委托到面板根元素 ==========
    panel.addEventListener('mousedown', (e) => {
      // 点击按钮不触发拖拽
      if (e.target.tagName === 'BUTTON') return;
      // 只有点击头部区域才触发拖拽
      if (!e.target.closest('.helper-header')) return;

      dragState.isDragging = true;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      dragState.panelLeft = rect.left;
      dragState.panelTop = rect.top;
      panel.style.right = 'auto';

      topDoc.addEventListener('mousemove', handleDragMove);
      topDoc.addEventListener('mouseup', handleDragEnd);
      topDoc.addEventListener('mouseleave', handleDragEnd);
    });

    // ========== 缩放：事件委托到面板根元素 ==========
    panel.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.resize-handle')) return;
      e.preventDefault();

      resizeState.isResizing = true;
      resizeState.startX = e.clientX;
      resizeState.startY = e.clientY;
      resizeState.panelWidth = panel.offsetWidth;
      resizeState.panelHeight = panel.offsetHeight;

      topDoc.addEventListener('mousemove', handleResizeMove);
      topDoc.addEventListener('mouseup', handleResizeEnd);
      topDoc.addEventListener('mouseleave', handleResizeEnd);
    });

    /** 拖拽移动处理 */
    function handleDragMove(e) {
      if (!dragState.isDragging) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      let newLeft = dragState.panelLeft + dx;
      let newTop = dragState.panelTop + dy;
      // 边界限制，不拖出屏幕
      newLeft = Math.max(0, Math.min(newLeft, topWin.innerWidth - 100));
      newTop = Math.max(0, Math.min(newTop, topWin.innerHeight - 100));
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
    }

    /** 拖拽结束（含鼠标移出窗口兜底） */
    function handleDragEnd() {
      dragState.isDragging = false;
      topDoc.removeEventListener('mousemove', handleDragMove);
      topDoc.removeEventListener('mouseup', handleDragEnd);
      topDoc.removeEventListener('mouseleave', handleDragEnd);
    }

    /** 缩放移动处理 */
    function handleResizeMove(e) {
      if (!resizeState.isResizing) return;
      const dw = e.clientX - resizeState.startX;
      const dh = e.clientY - resizeState.startY;
      let newW = resizeState.panelWidth + dw;
      let newH = resizeState.panelHeight + dh;
      // 最小/最大宽高限制
      newW = Math.max(320, Math.min(newW, topWin.innerWidth * 0.9));
      newH = Math.max(400, Math.min(newH, topWin.innerHeight * 0.9));
      panel.style.width = newW + 'px';
      panel.style.height = newH + 'px';
    }

    /** 缩放结束 */
    function handleResizeEnd() {
      resizeState.isResizing = false;
      topDoc.removeEventListener('mousemove', handleResizeMove);
      topDoc.removeEventListener('mouseup', handleResizeEnd);
      topDoc.removeEventListener('mouseleave', handleResizeEnd);
    }
  }

  // ==========================================================================
  //  样式注入模块
  // ==========================================================================

  /** 注入浮动面板 CSS 样式到顶层文档 */
  function injectStyle() {
    const topDoc = window.top.document;
    if (topDoc.getElementById(STYLE_ID)) return;
    const style = topDoc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 72px;
        right: 16px;
        width: 420px;
        height: 620px;
        max-width: 90vw;
        min-width: 320px;
        min-height: 400px;
        z-index: 2147483647 !important;
        background: rgba(255, 255, 255, 0.98);
        border: 1px solid #d9e2f2;
        border-radius: 14px;
        box-shadow: 0 12px 32px rgba(18, 42, 76, 0.16);
        font-size: 14px;
        line-height: 1.6;
        color: #1f2937;
        overflow: hidden;
        backdrop-filter: blur(10px);
        user-select: none;
      }
      #${PANEL_ID} .helper-header { cursor: move !important; }
      #${PANEL_ID}.collapsed { width: 56px; height: 56px; }
      #${PANEL_ID} * { box-sizing: border-box; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; }
      #${PANEL_ID} .helper-header {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 12px 14px; background: linear-gradient(135deg, #eff6ff, #f8fbff);
        border-bottom: 1px solid #e5edf8;
      }
      #${PANEL_ID} .helper-title { font-size: 15px; font-weight: 700; color: #0f172a; }
      #${PANEL_ID} .helper-badge { display: inline-block; margin-top: 2px; font-size: 12px; color: #475569; }
      #${PANEL_ID} .helper-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      #${PANEL_ID} button {
        border: 1px solid #c9d7ef; background: #fff; color: #1e3a8a;
        border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 12px;
      }
      #${PANEL_ID} button.ai-btn { background:#2563eb; color:#fff; border:none; }
      #${PANEL_ID} button.fill-btn { background:#059669; color:#fff; border:none; }
      #${PANEL_ID} button:hover { background: #eff6ff; }
      #${PANEL_ID} .helper-body { overflow-y: auto; height: calc(100% - 130px); padding: 14px; }
      #${PANEL_ID}.collapsed .helper-body,
      #${PANEL_ID}.collapsed .helper-badge,
      #${PANEL_ID}.collapsed .helper-title-text,
      #${PANEL_ID}.collapsed .helper-actions button:not(.toggle-button) { display: none; }
      #${PANEL_ID}.collapsed .helper-header { border-bottom: none; padding: 10px; }
      #${PANEL_ID}.collapsed .helper-actions { width: 100%; justify-content: center; }
      #${PANEL_ID} .helper-section {
        margin-bottom: 14px; padding: 12px; border: 1px solid #e5edf8;
        border-radius: 12px; background: #ffffff;
      }
      #${PANEL_ID} .helper-section h3 { margin: 0 0 8px; font-size: 14px; color: #0f172a; }
      #${PANEL_ID} .helper-note { margin: 0; color: #475569; font-size: 12px; }
      #${PANEL_ID} .helper-list { padding-left: 18px; margin: 8px 0 0; }
      #${PANEL_ID} .helper-list li { margin-bottom: 6px; }
      #${PANEL_ID} .question-card { border-top: 1px dashed #d7e2f0; padding-top: 10px; margin-top: 10px; }
      #${PANEL_ID} .question-card:first-child { border-top: none; padding-top: 0; margin-top: 0; }
      #${PANEL_ID} .question-type {
        display: inline-block; margin-bottom: 6px; padding: 2px 8px;
        border-radius: 999px; background: #e8f0ff; color: #1d4ed8; font-size: 12px;
      }
      #${PANEL_ID} .question-stem { font-weight: 600; color: #0f172a; margin-bottom: 6px; }
      #${PANEL_ID} .question-options { margin: 6px 0; padding-left: 18px; color: #334155; }
      #${PANEL_ID} .helper-subtitle { margin: 8px 0 4px; font-size: 12px; font-weight: 700; color: #334155; }
      #${PANEL_ID} .helper-textarea {
        width: 100%; min-height: 68px; margin-top: 8px; padding: 8px 10px;
        border: 1px solid #d8e2f0; border-radius: 8px; resize: vertical; font-size: 13px;
      }
      #${PANEL_ID} .muted { color: #64748b; }
      #${PANEL_ID} .helper-warning {
        font-size: 12px; color: #7c2d12; background: #fff7ed;
        border: 1px solid #fed7aa; padding: 8px 10px; border-radius: 8px; margin-bottom: 12px;
      }
      #${PANEL_ID} .helper-empty { color: #64748b; font-size: 13px; }
      #${PANEL_ID} .sidebar-id {
        display: inline-block; padding: 2px 8px; margin-right: 6px;
        border-radius: 999px; background: #dbeafe; color: #1d4ed8;
        font-size: 12px; font-weight: 700;
      }
      #${PANEL_ID} .helper-status { margin-top: 6px; font-size: 12px; color: #475569; }
      #${PANEL_ID} .font-status {
        font-size: 12px; padding: 6px 10px; border-radius: 6px;
        background: #f0fdf4; color: #166534; margin-top: 6px;
      }
      #${PANEL_ID} .font-status.error { background: #fef2f2; color: #991b1b; }
      #${PANEL_ID} .resize-handle {
        position: absolute; right: 0; bottom: 0; width: 16px; height: 16px;
        cursor: nwse-resize; background: transparent;
      }
    `;
    topDoc.head.appendChild(style);
  }

  // ==========================================================================
  //  文本处理工具函数
  // ==========================================================================

  /**
   * 标准化文本：替换不换行空格、合并空白、去除首尾空格
   * @param {string} text
   * @returns {string}
   */
  function normalizeText(text) {
    return (text || '')
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  /**
   * 清洗题干：移除末尾附带的 A/B/C/D 选项文本
   * 匹配选项起始格式：空格 + A/B/C/D + （顿号/点/空格）
   * 支持 A、A. A．A 四种常见格式，避免误伤题干里的字母
   * @param {string} stem - 原始题干
   * @returns {string} 清洗后的题干
   */
  function cleanQuestionStem(stem) {
    if (!stem) return '';
    const optionStartRegex = /\s+[A-D][、.．\s]/;
    const matchIndex = stem.search(optionStartRegex);
    if (matchIndex > 5) {
      // 选项起始位置不在最开头，才截断（避免题干第一个字就是A的极端情况）
      return stem.slice(0, matchIndex).trim();
    }
    return stem.trim();
  }

  /**
   * 获取元素的可见文本内容
   * @param {Element} element
   * @returns {string}
   */
  function getVisibleText(element) {
    if (!element) return '';
    return normalizeText(element.innerText || element.textContent || '');
  }

  /**
   * 判断元素是否在页面上可见
   * @param {Element} element
   * @returns {boolean}
   */
  function isVisibleElement(element) {
    if (!element || !(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * 判断文本是否为页面元数据（资源ID、下载链接、时间戳等非正文内容）
   * @param {string} text
   * @returns {boolean}
   */
  function looksLikeMetadataText(text) {
    const sample = text || '';
    if (!sample) return false;
    return /resourceID|download|nonce|timestamp|appid|creator|JSON|Map|selfFile|puid|type=document|var\s+\w+\s*=|https?:\/\//i.test(sample);
  }

  /**
   * 判断文本是否为测验页面特征文本
   * @param {string} text
   * @returns {boolean}
   */
  function isQuizPageText(text) {
    const sample = text || '';
    return /单选题|多选题|判断题|填空题|简答题|章节测验|本次成绩|查看作答记录|第\d+次作答/.test(sample);
  }

  /**
   * 粗略检测页面是否包含题目结构
   * @returns {boolean}
   */
  function hasQuestionStructure() {
    let count = 0;
    QUESTION_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (count >= 3) return;
        if (isExcludedNode(node) || !isVisibleElement(node)) return;
        const text = getVisibleText(node);
        if (text && text.length >= 8) count += 1;
      });
    });
    return count >= 2;
  }

  /**
   * 判断节点是否应该被排除（面板自身、目录、导航等）
   * @param {Node} node
   * @returns {boolean}
   */
  function isExcludedNode(node) {
    if (!node || !(node instanceof Element)) return true;
    if (node.id === PANEL_ID || node.closest(`#${PANEL_ID}`)) return true;
    return MANUAL_EXCLUDE_SELECTORS.some((selector) => {
      try { return !!node.closest(selector); } catch (error) { return false; }
    });
  }

  // ==========================================================================
  //  iframe 实例管理模块
  // ==========================================================================

  /**
   * 获取当前 iframe 实例信息（序号 + 作用域）
   * @returns {{ index: number, scope: string }}
   */
  function getSidebarInstanceInfo() {
    const info = { index: 1, scope: '当前框架' };
    try {
      const root = window.top || window;
      if (!root.__TRAE_SIDEBAR_COUNTER__) root.__TRAE_SIDEBAR_COUNTER__ = 0;
      if (!window.__TRAE_SIDEBAR_INSTANCE_ID__) {
        root.__TRAE_SIDEBAR_COUNTER__ += 1;
        window.__TRAE_SIDEBAR_INSTANCE_ID__ = root.__TRAE_SIDEBAR_COUNTER__;
      }
      info.index = window.__TRAE_SIDEBAR_INSTANCE_ID__;
      info.scope = window === root ? '主页面' : '内嵌框架';
    } catch (error) {
      if (!window.__TRAE_SIDEBAR_INSTANCE_ID__) window.__TRAE_SIDEBAR_INSTANCE_ID__ = 1;
      info.index = window.__TRAE_SIDEBAR_INSTANCE_ID__;
      info.scope = '当前框架';
    }
    return info;
  }

  /**
   * 判断当前框架是否应该渲染浮动面板
   * @param {{ index: number, scope: string }} instanceInfo
   * @returns {boolean}
   */
  function shouldRenderThisSidebar(instanceInfo) {
    return instanceInfo.index === TARGET_SIDEBAR_INDEX && instanceInfo.scope === TARGET_SIDEBAR_SCOPE;
  }

  /**
   * 从一组选择器中获取第一个非空文本
   * @param {string[]} selectors - CSS 选择器列表
   * @returns {string}
   */
  function findFirstText(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = getVisibleText(node);
      if (text) return text;
    }
    return normalizeText(document.title || '当前学习页面');
  }

  // ==========================================================================
  //  页面内容提取模块
  // ==========================================================================

  /**
   * 收集页面正文内容（从 CONTENT_SELECTORS 中提取）
   * @returns {string}
   */
  function collectPageContent() {
    const parts = [];
    const seen = new Set();
    for (const selector of CONTENT_SELECTORS) {
      document.querySelectorAll(selector).forEach((node) => {
        if (isExcludedNode(node)) return;
        if (!isVisibleElement(node)) return;
        const text = getVisibleText(node);
        if (looksLikeMetadataText(text)) return;
        if (text && text.length > 30 && !seen.has(text)) {
          seen.add(text);
          parts.push(text);
        }
      });
    }
    if (!parts.length) {
      const rawText = normalizeText(
        Array.from(document.body.children)
          .filter((node) => !isExcludedNode(node) && isVisibleElement(node))
          .map((node) => getVisibleText(node))
          .join('\n')
      );
      return rawText ? rawText.slice(0, MAX_CONTENT_LENGTH) : "";
    }
    const joinText = normalizeText(parts.join('\n'));
    return joinText ? joinText.slice(0, MAX_CONTENT_LENGTH) : "";
  }

  /**
   * 获取元素的可见尺寸矩形
   * @param {Element} element
   * @returns {DOMRect|null}
   */
  function getVisibleRect(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return rect;
  }

  /**
   * 延时等待
   * @param {number} ms - 毫秒
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  // ==========================================================================
  //  OCR 识别模块（基于 tesseract.js）
  // ==========================================================================

  /**
   * 获取适合 OCR 识别的候选元素（图片/画布），按评分排序
   * @returns {Array<{ node: Element, rect: DOMRect, area: number, score: number }>}
   */
  function getOcrCandidates() {
    const results = [];
    const seen = new Set();
    OCR_CANDIDATE_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (!(node instanceof Element)) return;
        if (isExcludedNode(node)) return;
        if (seen.has(node)) return;
        seen.add(node);
        const rect = getVisibleRect(node);
        if (!rect) return;
        if (rect.width < 180 || rect.height < 180) return;
        if (!isVisibleElement(node)) return;
        const area = rect.width * rect.height;
        const centerBias = Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2);
        const pageLikeRatio = rect.height / Math.max(rect.width, 1);
        const pageLikeBonus = pageLikeRatio > 1.1 ? 1 : 1;
        const score = (area * pageLikeBonus) - centerBias * 800;
        results.push({ node, rect, area, score });
      });
    });
    return results.sort((a, b) => b.score - a.score).slice(0, OCR_MAX_CANDIDATES);
  }

  /**
   * 判断元素是否可以滚动
   * @param {Element} element
   * @returns {boolean}
   */
  function isScrollableElement(element) {
    if (!element || !(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY || style.overflow;
    return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight + 120;
  }

  /**
   * 从候选元素出发，查找最佳滚动容器
   * @param {Array} candidates - OCR 候选元素列表
   * @returns {Element}
   */
  function getBestScrollContainer(candidates) {
    for (const candidate of candidates) {
      let current = candidate.node.parentElement;
      while (current && current !== document.body) {
        if (isScrollableElement(current)) return current;
        current = current.parentElement;
      }
    }
    let bestElement = null;
    let bestArea = 0;
    document.querySelectorAll('div, section, main, article').forEach((element) => {
      if (!isScrollableElement(element) || !isVisibleElement(element) || isExcludedNode(element)) return;
      const rect = element.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) { bestArea = area; bestElement = element; }
    });
    return bestElement || document.scrollingElement || document.documentElement;
  }

  /**
   * 滚动容器一次
   * @param {Element} container
   * @returns {boolean} 是否成功滚动
   */
  function scrollContainerOnce(container) {
    const target = container === document.body ? (document.scrollingElement || document.documentElement) : container;
    if (!target) return false;
    const prevTop = target.scrollTop;
    const viewportHeight = target === document.scrollingElement || target === document.documentElement
      ? window.innerHeight : target.clientHeight;
    const step = Math.max(240, Math.floor(viewportHeight * 0.72));
    target.scrollTop = Math.min(target.scrollTop + step, target.scrollHeight);
    return target.scrollTop > prevTop + 2;
  }

  /**
   * 构建 OCR 文本去重键
   * @param {string} text
   * @returns {string}
   */
  function buildOcrTextKey(text) {
    return normalizeText(text)
      .replace(/[^一-龥A-Za-z0-9]/g, '')
      .slice(0, 80);
  }

  /**
   * 从候选节点获取图像源（图片 URL 或 Canvas 数据）
   * @param {Element} node
   * @returns {string|null}
   */
  function getOcrSourceFromNode(node) {
    if (!node) return null;
    const tag = node.tagName.toLowerCase();
    if (tag === 'img') return node.currentSrc || node.src || null;
    if (tag === 'canvas') {
      try { return preprocessCanvasImage(node); }
      catch (error) { return null; }
    }
    return null;
  }

  /**
   * 预处理 Canvas 图像：放大、灰度化、二值化，提升 OCR 识别率
   * @param {HTMLCanvasElement} sourceNode
   * @returns {string|null} DataURL
   */
  function preprocessCanvasImage(sourceNode) {
    const sourceCanvas = document.createElement('canvas');
    const width = Math.max(1, Math.floor(sourceNode.width || sourceNode.naturalWidth || sourceNode.clientWidth || 1));
    const height = Math.max(1, Math.floor(sourceNode.height || sourceNode.naturalHeight || sourceNode.clientWidth || 1));
    sourceCanvas.width = width * 2;
    sourceCanvas.height = height * 2;
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    ctx.drawImage(sourceNode, 0, 0, sourceCanvas.width, sourceCanvas.height);
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const value = gray > 185 ? 255 : 0;
      data[i] = value; data[i + 1] = value; data[i + 2] = value; data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return sourceCanvas.toDataURL('image/png');
  }

  /**
   * 在图像源上执行 OCR 识别
   * @param {string} source - 图像 URL 或 DataURL
   * @returns {Promise<string>} 识别文本
   */
  async function runOcrOnSource(source) {
    if (!source || typeof Tesseract === 'undefined') return '';
    try {
      const result = await Tesseract.recognize(source, 'chi_sim+eng', {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1'
      });
      return normalizeText(result?.data?.text || '');
    } catch (error) { return ''; }
  }

  /**
   * 通过 OCR 收集页面内容（滚动 + 识别多个候选区域）
   * @returns {Promise<{ text: string, source: string }>}
   */
  async function collectOcrContent() {
    const collectedTexts = [];
    const seenKeys = new Set();
    let stagnantCount = 0;
    let scrollContainer = null;
    for (let step = 0; step < OCR_MAX_SCROLL_STEPS; step += 1) {
      const candidates = getOcrCandidates();
      if (!candidates.length) break;
      if (!scrollContainer) scrollContainer = getBestScrollContainer(candidates);
      let hasNewText = false;
      for (const candidate of candidates) {
        const source = getOcrSourceFromNode(candidate.node);
        const text = await runOcrOnSource(source);
        if (!text || text.length < 20 || looksLikeMetadataText(text)) continue;
        const key = buildOcrTextKey(text);
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        collectedTexts.push(text);
        hasNewText = true;
      }
      if (collectedTexts.join('\n').length >= MAX_CONTENT_LENGTH) break;
      if (hasNewText) stagnantCount = 0; else stagnantCount += 1;
      if (stagnantCount >= OCR_STAGNANT_LIMIT) break;
      if (!scrollContainerOnce(scrollContainer)) break;
      await sleep(OCR_SCROLL_WAIT_MS);
    }
    return {
      text: normalizeText(collectedTexts.join('\n')).slice(0, MAX_CONTENT_LENGTH),
      source: collectedTexts.length ? 'ocr' : 'none'
    };
  }

  // ==========================================================================
  //  文本分析与信息提取模块
  // ==========================================================================

  /**
   * 从文本中提取高频关键词
   * @param {string} text
   * @param {number} [limit=8] - 返回关键词数量上限
   * @returns {string[]}
   */
  function extractKeywords(text, limit = 8) {
    const matches = text.match(/[一-龥A-Za-z]{2,12}/g) || [];
    const counter = new Map();
    matches.forEach((raw) => {
      const word = raw.trim();
      if (!word || STOP_WORDS.has(word)) return;
      if (/^\d+$/.test(word)) return;
      counter.set(word, (counter.get(word) || 0) + 1);
    });
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].length - b[0])
      .slice(0, limit)
      .map(([word]) => word);
  }

  /**
   * 将文本按标点符号拆分为句子
   * @param {string} text
   * @returns {string[]}
   */
  function splitSentences(text) {
    return normalizeText(text)
      .split(/(?<=[。！？!?；;])/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 12);
  }

  /**
   * 生成章节摘要（取开头与中间代表性句子）
   * @param {string} content - 正文文本
   * @returns {string[]}
   */
  function summarizeContent(text) {
    const safeText = text || "";
    const sentences = splitSentences(safeText);
    if (!sentences.length) {
      return ['当前页面可提取正文较少，建议先展开章节正文后再点击"刷新解析"。'];
    }
    const summary = [];
    summary.push(sentences[0]);
    if (sentences.length > 2) summary.push(sentences[Math.min(1, sentences.length - 1)]);
    if (sentences.length > 4) summary.push(sentences[Math.min(3, sentences.length - 1)]);
    return [...new Set(summary)].slice(0, 3);
  }

  // ==========================================================================
  //  题目提取与解析模块
  // ==========================================================================

  /**
   * 根据文本内容检测题目类型
   * @param {string} text - 题干文本
   * @param {string[]} options - 选项列表
   * @returns {string} 题型标识（judge / input / radio / checkbox）
   */
  function detectQuestionType(text, options) {
    const combined = `${text} ${(options || []).join(' ')}`;
    if (/判断|对错|正确|错误/.test(combined)) return 'judge';
    if (/填空|空格|____|___/.test(combined)) return 'input';
    if (/简答|论述|分析/.test(combined)) return 'input';
    if ((options || []).length >= 4) return '选择题';
    return '练习题';
  }

  /**
   * 从页面中提取题目列表
   * 多层过滤流程：可见性检查 → 排除选项容器 → 排除黑名单 → 文本长度过滤 →
   * 题干去重 → 格式校验 → 干扰词过滤 → 题型特征校验 → 提取选项 → 解析题型
   * @param {string[]} pageKeywords - 页面关键词（当前未直接使用，保留接口）
   * @returns {Array<{ idx: number, domNode: Element, stem: string, options: string[], type: string }>}
   */
  function extractQuestions(pageKeywords) {
    const results = [];
    const nodeSet = new Set();

    // 第一步：收集所有候选题目节点
    QUESTION_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach(node => {
        if (isVisibleElement(node) && !isExcludedNode(node)) {
          nodeSet.add(node);
        }
      });
    });

    // 第二步：逐层过滤
    for (const node of nodeSet) {
      if (results.length >= MAX_QUESTION_COUNT) break;

      // 第1层：选项容器内的节点直接排除（核心修复）
      let inOptionWrapper = false;
      for (const sel of OPTION_WRAPPER_SELECTORS) {
        if (node.closest(sel)) {
          inOptionWrapper = true;
          break;
        }
      }
      if (inOptionWrapper) continue;

      // 第2层：黑名单容器过滤
      let inBlack = false;
      for (const blackSel of BLACKLIST_SELECTORS) {
        if (node.closest(blackSel)) {
          inBlack = true;
          break;
        }
      }
      if (inBlack) continue;

      // 第3层：文本基础过滤
      const rawText = getVisibleText(node);
      if (!rawText || rawText.length < MIN_QUESTION_TEXT_LEN) continue;

      const lines = rawText.split(/\n+/).map(line => line.trim()).filter(Boolean);
      const rawStem = normalizeText(lines[0] || rawText);
      const cleanedStem = cleanQuestionStem(rawStem);
      const stem = cleanedStem.slice(0, 220);

      // 题干文本去重
      if (results.some(q => q.stem === stem)) continue;

      // 第4层：题干格式强校验（必须有题号 + 题型标记，如「14【单选题】」）
      const hasValidStemFormat = /^\d+[\.、\s]*【[单多判]选[题]?】/.test(rawStem)
                              || /^第\d+题/.test(rawStem)
                              || /^\d+[\.、\s]*\(/.test(rawStem);
      if (!hasValidStemFormat) continue;

      // 第5层：干扰词过滤
      let hitNoise = 0;
      for (const word of NOISE_WORDS) {
        if (rawText.includes(word)) hitNoise++;
      }
      if (hitNoise >= 3) continue;

      // 第6层：题型特征校验
      let hasQuestionMark = false;
      for (const mark of QUESTION_MARK_WORDS) {
        if (rawText.includes(mark)) {
          hasQuestionMark = true;
          break;
        }
      }
      if (/【[单多判]选[题]?】/.test(rawText)) hasQuestionMark = true;
      if (!hasQuestionMark) continue;

      // 提取选项
      const optionNodes = [];
      OPTION_SELECTORS.forEach(optSelector => {
        node.querySelectorAll(optSelector).forEach(opt => {
          if (isVisibleElement(opt)) optionNodes.push(opt);
        });
      });

      // 选项嵌套去重（子节点不重复计入）
      const validOptionNodes = optionNodes.filter((opt, index) => {
        return !optionNodes.some((otherOpt, otherIdx) => {
          return index !== otherIdx && otherOpt.contains(opt);
        });
      });

      // 选项文本过滤
      let optionTexts = [];
      validOptionNodes.forEach(opt => {
        const t = getVisibleText(opt);
        if (t && t.length >= MIN_OPTION_TEXT_LEN && !optionTexts.includes(t)) {
          optionTexts.push(t);
        }
      });

      // 前缀去重（去除重复前缀的选项）
      optionTexts = optionTexts.filter((opt, idx) => {
        return !optionTexts.some((otherOpt, otherIdx) => {
          return idx !== otherIdx && otherOpt.startsWith(opt);
        });
      });

      // 解析题型
      const typeRaw = detectQuestionType(stem, optionTexts);
      let type;
      if (typeRaw === "选择题") type = "radio";
      else if (typeRaw === "判断题") type = "judge";
      else type = "input";
      if (type === "radio" && node.querySelector('input[type="checkbox"]')) type = "checkbox";

      results.push({
        idx: results.length + 1,
        domNode: node,
        stem,
        options: optionTexts,
        type
      });
    }

    cachedQuestionList = results;
    return results;
  }

  // ==========================================================================
  //  AI 接口请求模块
  // ==========================================================================

  /**
   * 调用 AI 接口生成题目答案
   * 将缓存的题目列表发送给大模型，解析返回的 JSON 答案
   * @returns {Promise<Array|null>}
   */
  async function fetchAIAnswers() {
    if (cachedQuestionList.length === 0) {
      alert("先点击刷新解析提取页面题目");
      return null;
    }
    let promptText = "下面是所有题目，严格只输出纯JSON数组，不要多余文字：\n";
    cachedQuestionList.forEach(q => {
      promptText += `题号${q.idx} 题型${q.type} 题干：${q.stem}`;
      if (q.options.length) promptText += ` 选项：${q.options.join("、")}`;
      promptText += "\n";
    });
    const postData = JSON.stringify({
      model: AI_CONFIG.model,
      temperature: AI_CONFIG.temperature,
      messages: [
        { role: "system", content: AI_CONFIG.systemPrompt },
        { role: "user", content: promptText }
      ]
    });
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: AI_CONFIG.apiUrl,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${AI_CONFIG.apiKey}`
        },
        data: postData,
        timeout: 30000,
        onload: function (res) {
          try {
            if (res.status < 200 || res.status >= 300) throw new Error(`请求失败，状态码${res.status}`);
            const json = JSON.parse(res.responseText);
            const rawContent = json.choices[0].message.content.trim();
            const matchResult = rawContent.match(/\[.*\]/s);
            if (!matchResult) throw new Error("AI未返回标准JSON");
            aiAnswerData = JSON.parse(matchResult[0]);
            analyzePage().then(pageData => {
              renderPanel(pageData);
              alert("✅答案获取完成");
              resolve(aiAnswerData);
            });
          } catch (err) {
            alert("❌ AI生成失败：" + err.message);
            reject(err);
          }
        },
        onerror: () => reject(new Error("网络请求错误，跨域拦截")),
        ontimeout: () => reject(new Error("请求超时"))
      });
    });
  }

  // ==========================================================================
  //  自动填入答案模块
  // ==========================================================================

  /**
   * 将 AI 生成的答案自动填入页面中的题目
   * 支持题型：单选（点击 label）、多选（点击 label）、判断（点击 label）、填空/简答（填入 input）
   * 注意：不会自动提交试卷
   */
  async function fillAllAnswers() {
    if (aiAnswerData.length === 0 || cachedQuestionList.length === 0) {
      alert("请先刷新解析+调用AI生成答案");
      return;
    }
    const map = {};
    (aiAnswerData || []).forEach(item => map[item.idx] = item.ans);
    let fillNum = 0;
    for (const q of cachedQuestionList) {
      await sleep(AI_CONFIG.operateDelay);
      const ans = map[q.idx];
      if (!ans) continue;
      const wrap = q.domNode;
      if (q.type === "radio" || q.type === "checkbox") {
        const letters = ans.split(/[,，]/);
        wrap.querySelectorAll(OPTION_SELECTORS.join(",")).forEach(opt => {
          const txt = getVisibleText(opt);
          const label = opt.querySelector("label") || opt;
          const letter = txt.slice(0, 1);
          if (letters.includes(letter)) label.click();
        });
        fillNum++;
      } else if (q.type === "judge") {
        const target = ans === "正确" ? "正确" : "错误";
        wrap.querySelectorAll("label").forEach(lab => {
          if (getVisibleText(lab).includes(target)) lab.click();
        });
        fillNum++;
      } else {
        const input = wrap.querySelector("textarea,input[type=text]");
        if (input) {
          input.value = ans;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          fillNum++;
        }
      }
    }
    alert(`填入完成，共${fillNum}道题目已填写（不自动提交）`);
  }

  // ==========================================================================
  //  讨论区模块
  // ==========================================================================

  /**
   * 将随机讨论模板填入页面中的讨论输入框
   */
  function fillDiscussText() {
    const textarea = document.querySelector('textarea[id*="content"],textarea,.cke_editable');
    if (!textarea) return alert("未找到讨论输入框");
    const rand = AI_CONFIG.discussPool[Math.floor(Math.random() * AI_CONFIG.discussPool.length)];
    if (!confirm("填入讨论文本：\n" + rand)) return;
    textarea.value = rand;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    alert("讨论内容已填入，手动发布");
  }

  /**
   * 根据章节信息生成讨论发言草稿
   * @param {string} title - 章节标题
   * @param {string[]} summary - 章节摘要句子
   * @param {string[]} keywords - 关键词列表
   * @returns {string}
   */
  function buildDiscussionDraft(title, summary, keywords) {
    const safeKeywords = keywords || [];
    const safeSummary = summary || [];
    const line1 = `学习到"${title}"这一部分后，我对${safeKeywords.slice(0, 2).join('和') || '本章核心知识'}有了更清晰的认识。章节内容不仅介绍了基本概念，也让我看到这些知识在实际情境中的作用。`;
    const line2 = `我目前的理解是：${safeSummary[0] || '本章强调先把关键概念弄懂，再结合案例去应用'}。如果只停留在记忆层面，遇到题目变化时很容易混淆，所以我更倾向于把知识点和具体场景对应起来。`;
    const line3 = `接下来我会重点复习${safeKeywords.slice(0, 3).join('、') || '本章重点'}，并尝试用自己的话重新整理一遍。如果同学们有更好的记忆方法或案例理解，也欢迎一起交流。`;
    return [line1, line2, line3].join('\n\n');
  }

  // ==========================================================================
  //  导出与复制工具模块
  // ==========================================================================

  /**
   * 构建导出文本（Markdown 格式）
   * @param {Object} data - 页面分析数据
   * @returns {string}
   */
  function buildExportText(data) {
    const lines = [];
    lines.push(`# ${data.title}`);
    lines.push('');
    lines.push('## 章节摘要');
    (data.summary || []).forEach((item) => lines.push(`- ${item}`));
    lines.push('');
    lines.push('## 知识点');
    (data.keywords || []).forEach((item) => lines.push(`- ${item}`));
    lines.push('');
    lines.push('## 题目整理');
    if (!data.questions.length) {
      lines.push('- 当前页面未识别到明确的题目。');
    } else {
      data.questions.forEach((q, idx) => {
        lines.push(`### ${idx + 1}. ${q.stem}`);
        const typeTxt = q.type === "radio" ? "单选" : q.type === "checkbox" ? "多选" : q.type === "judge" ? "判断" : "填空";
        lines.push(`- 题型：${typeTxt}`);
        if (q.options.length) q.options.forEach((opt) => lines.push(`- 选项：${opt}`));
        lines.push('');
      });
    }
    lines.push('## 讨论参考稿');
    lines.push(data.discussionDraft);
    lines.push('');
    lines.push('仅供学习参考，不自动答题、不自动提交、不自动发帖。');
    return lines.join('\n');
  }

  /**
   * 复制文本到剪贴板
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  function copyText(text) {
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text);
      return Promise.resolve(true);
    }
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }

  // ==========================================================================
  //  页面综合分析模块
  // ==========================================================================

  /**
   * 综合分析当前页面：执行字体解密 → 提取标题 → 收集正文 → OCR 降级 → 提取关键词 →
   * 生成摘要 → 提取题目 → 生成讨论草稿
   * @returns {Promise<Object>} 页面分析结果
   */
  async function analyzePage() {
    // 解析页面前强制执行字体解密
    decryptFontCxSecret();

    const title = findFirstText(TITLE_SELECTORS) || '当前学习页面';
    let content = collectPageContent();
    let contentSource = 'dom';
    const quizLike = hasQuestionStructure() || isQuizPageText(content);
    if (looksLikeMetadataText(content)) content = '';
    const domLooksGood = content && content.length >= DOM_GOOD_CONTENT_LENGTH && !looksLikeMetadataText(content);
    if (!quizLike && (!domLooksGood || content.length < OCR_MIN_TEXT_LENGTH)) {
      const ocrResult = await collectOcrContent();
      if (ocrResult.text) {
        content = ocrResult.text;
        contentSource = ocrResult.source;
      }
    }
    const safeText = content || "";
    const keywords = extractKeywords(`${title}\n${safeText}`, 8);
    const summary = summarizeContent(safeText);
    const questions = extractQuestions(keywords);
    const discussionDraft = buildDiscussionDraft(title, summary, keywords);
    // isQuizPage 字段标记当前是否为测验/作业页
    return { title, content: safeText, keywords, summary, questions, discussionDraft, contentSource, isQuizPage: quizLike };
  }

  // ==========================================================================
  //  浮动面板 UI 模块
  // ==========================================================================

  /**
   * 创建浮动面板 DOM 元素
   * @returns {HTMLElement}
   */
  function createPanel() {
    const topDoc = window.top.document;
    if (topDoc.getElementById(PANEL_ID)) return topDoc.getElementById(PANEL_ID);
    const instanceInfo = getSidebarInstanceInfo();
    const panel = topDoc.createElement('aside');
    panel.id = PANEL_ID;
    panel.dataset.instanceId = String(instanceInfo.index);
    panel.dataset.instanceScope = instanceInfo.scope;
    panel.innerHTML = `
      <div class="helper-header">
        <div>
          <div class="helper-title">
            <span class="helper-title-text">学习辅助+AI答题</span>
          </div>
          <div class="helper-badge">
            <span class="sidebar-id">#${instanceInfo.index}</span>
            ${instanceInfo.scope}，AI仅填充不自动提交
          </div>
        </div>
        <div class="helper-actions">
          <button type="button" data-action="refresh">刷新解析</button>
          <button type="button" class="ai-btn" data-action="getAI">AI生成答案</button>
          <button type="button" class="toggle-button" data-action="toggle">收起</button>
        </div>
      </div>
      <div class="helper-body"></div>
      <div class="resize-handle"></div>
    `;
    topDoc.body.appendChild(panel);
    initPanelInteractions(panel);
    return panel;
  }

  /**
   * 转义 HTML 特殊字符
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * 转义 textarea 内容（仅防 XSS 标签注入）
   * @param {string} text
   * @returns {string}
   */
  function escapeTextarea(text) {
    return String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * 渲染面板内容
   * @param {Object} data - 页面分析结果
   */
  function renderPanel(data) {
    const topDoc = window.top.document;
    const panel = topDoc.getElementById(PANEL_ID);
    if (!panel) return;
    const body = panel.querySelector('.helper-body');
    if (!body) return;

    const fontStatus = getFontDecryptStatus();
    const isFontError = fontStatus.startsWith('失败');

    let qHtml = "";
    const ansMap = {};
    (aiAnswerData || []).forEach(item => ansMap[item.idx] = item.ans);
    if (data.questions.length) {
      data.questions.forEach((q, idx) => {
        const typeTxt = q.type === "radio" ? "单选" : q.type === "checkbox" ? "多选" : q.type === "judge" ? "判断" : "填空";
        const currentAns = ansMap[q.idx] ?? "暂未获取AI答案";
        qHtml += `
          <div class="question-card">
            <div class="question-type">${typeTxt}</div>
            <div style="color:#059669;font-weight:bold;margin-bottom:4px;">AI标准答案：${escapeHtml(currentAns)}</div>
            <div class="question-stem">${idx + 1}. ${escapeHtml(q.stem)}</div>
            ${q.options.length ? `<div class="helper-subtitle">选项</div><ul class="question-options">${q.options.map(o => `<li>${escapeHtml(o)}</li>`).join("")}</ul>` : ""}
          </div>
        `;
      });
    } else {
      qHtml = `<div class="helper-empty">未识别题目，刷新页面重试</div>`;
    }

    const summarySection = data.isQuizPage ? "" : `
      <section class="helper-section">
        <h3>章节摘要</h3>
        <ul class="helper-list">${(data.summary || []).map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
      </section>
      <section class="helper-section">
        <h3>高频知识点</h3>
        <p class="muted">${(data.keywords || []).length ? escapeHtml(data.keywords.join('、')) : '无'}</p>
      </section>
    `;

    const discussSection = data.isQuizPage ? "" : `
      <section class="helper-section">
        <h3>讨论草稿</h3>
        <textarea class="helper-textarea" style="min-height:140px;">${escapeTextarea(data.discussionDraft)}</textarea>
      </section>
    `;

    body.innerHTML = `
      <div class="helper-warning">⚠️ AI答案仅供参考，所有填入操作不会自动提交试卷/发帖</div>
      <div class="font-status ${isFontError ? 'error' : ''}">🔤 字体解密状态：${escapeHtml(fontStatus)}</div>
      <section class="helper-section">
        <h3>当前章节</h3>
        <div>${escapeHtml(data.title)}</div>
        <div class="helper-status">正文来源：${data.contentSource === 'ocr' ? 'OCR识别' : '页面文本'}</div>
      </section>
      ${summarySection}
      <section class="helper-section">
        <h3>题目列表（已缓存用于AI）</h3>
        <p class="helper-note">共${(data.questions || []).length}道，点击AI生成答案获取填写内容</p>
        ${qHtml}
      </section>
      ${discussSection}
    `;
    panel.dataset.exportText = buildExportText(data);
  }

  // ==========================================================================
  //  事件绑定模块
  // ==========================================================================

  /**
   * 绑定面板按钮的事件处理
   * @param {HTMLElement} panel - 浮动面板根元素
   */
  function bindEvents(panel) {
    panel.addEventListener('click', async (event) => {
      const target = event.target.closest('button[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      target.disabled = true;
      const oldTxt = target.textContent;
      try {
        if (action === 'refresh') {
          window.__CX_FONT_DECRYPTED__ = false;
          renderPanel(await analyzePage());
          alert("页面解析完成，题目已缓存");
        }
        if (action === 'getAI') await fetchAIAnswers();
        if (action === 'toggle') {
          panel.classList.toggle('collapsed');
          target.textContent = panel.classList.contains('collapsed') ? "展开" : "收起";
        }
      } catch (err) {
        alert("操作失败：" + err.message);
      } finally {
        target.disabled = false;
        target.textContent = oldTxt;
      }
    });
  }

  // ==========================================================================
  //  初始化入口
  // ==========================================================================

  function init() {
    const instanceInfo = getSidebarInstanceInfo();
    if (!shouldRenderThisSidebar(instanceInfo)) return;
    injectStyle();
    const panel = createPanel();
    bindEvents(panel);
    renderPanel({
      title: '正在加载页面...',
      content: '',
      keywords: [],
      summary: ['等待解析页面文本与题目'],
      questions: [],
      discussionDraft: '',
      contentSource: 'dom',
      isQuizPage: false
    });

    // 延迟执行，确保 iframe 内题目和字体样式加载完成
    setTimeout(() => {
      analyzePage().then((data) => {
        renderPanel(data);
      }).catch(() => {
        renderPanel({
          title: '页面解析失败',
          content: '',
          keywords: [],
          summary: ['页面解析异常，请刷新页面重试'],
          questions: [],
          discussionDraft: '',
          contentSource: 'dom',
          isQuizPage: false
        });
      });
    }, 1500);
  }

  // 延迟 1 秒启动，保证页面基础 DOM 加载完成
  window.setTimeout(init, 1000);
})();
