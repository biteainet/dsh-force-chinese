/**
 * dsh-force-chinese v0.3.3 · client half（浏览器半）
 * DSH 标准 Client 插件：window.__ModuleLoader__.load({id, factory})
 *
 * 自绘设置面板（小球）：
 *  - 屏幕右侧中部小圆球（鲸鱼 SVG 图标），点击弹出设置面板
 *  - 面板：强制中文（固定开启）+「大肥鱼模式」开关
 *  - 与 host 通信：异步 fetch（相对路径 /dsh-force-chinese/config，桌面端 renderer
 *    可正常访问 host webServer —— 与 whale-widget 的 /dsh-whale/* 同机制）
 *  - 乐观更新：点击立即切换 UI，异步保存 host；失败回滚并提示
 *  - 本地持久化：localStorage 兜底（刷新后先恢复 UI，再尝试同步 host）
 *
 * 样式防御（v0.3.3，对齐 whale-widget 已验证模式）：
 *  - z-index 用常规量级（9999/10000），不用 2147483647 —— 宿主皮肤会按
 *    "position:fixed + 极高 z-index" 的几何特征给悬浮元素套皮肤，导致巨图/错位
 *  - 纵深防御：html/body 前缀 + !important 清除宿主可能注入的背景/边框/阴影/滤镜
 *  - SVG 内联 width/height 属性 + 属性选择器 !important 约束，防宿主 svg 全局样式放大
 *  - 类名统一 dshfc- 前缀，避免与宿主样式冲突
 */
window.__ModuleLoader__.load({
  id: 'dsh-force-chinese',
  factory: (require) => {
    'use strict';
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      exports.name = 'dsh-force-chinese-client';
      exports.apply = function apply() {};
      return module.exports;
    }
    if (window.__dshForceChineseInstalled) {
      exports.name = 'dsh-force-chinese-client';
      exports.apply = function apply() {};
      return module.exports;
    }
    window.__dshForceChineseInstalled = true;

    var API_CONFIG = '/dsh-force-chinese/config';
    var LS_KEY = 'dsh-force-chinese:fatWhale';

    /* ================= 状态与通信（全异步） ================= */
    var fatWhale = false;

    function readLocal() {
      try { return localStorage.getItem(LS_KEY) === '1'; } catch (e) { return false; }
    }
    function writeLocal(v) {
      try { localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch (e) { /* 隐私模式等 */ }
    }

    function fetchConfig() {
      return fetch(API_CONFIG, { method: 'GET', headers: { 'Accept': 'application/json' } })
        .then(function (res) { return res.json(); })
        .then(function (data) { return data.fatWhale === true; })
        .catch(function () { return undefined; });
    }

    function saveConfig(next) {
      return fetch(API_CONFIG, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatWhale: next }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) { return data.ok === true; })
        .catch(function () { return false; });
    }

    /* ================= DOM 注入 ================= */
    function mount() {
      if (!document.body) { document.addEventListener('DOMContentLoaded', mount); return; }
      if (document.getElementById('dsh-force-chinese-ball')) return;

      var style = document.createElement('style');
      style.id = 'dsh-force-chinese-style';
      style.textContent =
        /* ---- 小球 ---- */
        '#dsh-force-chinese-ball{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:9999;' +
        'width:46px;height:46px;border-radius:50% 0 0 50%;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;background:linear-gradient(135deg,#4a6cf7,#6a5acd);box-shadow:-2px 2px 10px rgba(74,108,247,.45);' +
        'transition:background .2s ease,transform .15s ease;user-select:none;-webkit-user-select:none}' +
        '#dsh-force-chinese-ball:hover{background:linear-gradient(135deg,#3a5cf0,#5a4acd)}' +
        '#dsh-force-chinese-ball:active{transform:translateY(-50%) scale(.96)}' +
        '#dsh-force-chinese-ball svg{width:24px;height:24px;display:block}' +
        /* ---- 面板 ---- */
        '#dsh-force-chinese-panel{position:fixed;right:14px;top:50%;transform:translateY(-50%);z-index:10000;' +
        'width:280px;background:#ffffff;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,.18);' +
        'border:1px solid rgba(15,23,42,.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;' +
        'color:#0f172a;overflow:hidden;display:none;user-select:none;-webkit-user-select:none}' +
        '#dsh-force-chinese-panel.open{display:block}' +
        '#dsh-force-chinese-panel .dshfc-head{display:flex;align-items:center;justify-content:space-between;' +
        'padding:14px 16px 12px;border-bottom:1px solid rgba(15,23,42,.06)}' +
        '#dsh-force-chinese-panel .dshfc-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}' +
        '#dsh-force-chinese-panel .dshfc-title svg{width:18px;height:18px;color:#4a6cf7}' +
        '#dsh-force-chinese-panel .dshfc-close{width:24px;height:24px;border:none;background:transparent;cursor:pointer;' +
        'border-radius:6px;display:flex;align-items:center;justify-content:center;color:#64748b;padding:0}' +
        '#dsh-force-chinese-panel .dshfc-close:hover{background:rgba(15,23,42,.06);color:#0f172a}' +
        '#dsh-force-chinese-panel .dshfc-close svg{width:16px;height:16px}' +
        '#dsh-force-chinese-panel .dshfc-body{padding:6px 16px 14px}' +
        '#dsh-force-chinese-panel .dshfc-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;' +
        'border-bottom:1px solid rgba(15,23,42,.05)}' +
        '#dsh-force-chinese-panel .dshfc-row:last-child{border-bottom:none}' +
        '#dsh-force-chinese-panel .dshfc-label{font-size:13px;line-height:1.45}' +
        '#dsh-force-chinese-panel .dshfc-hint{font-size:11px;color:#94a3b8;margin-top:2px}' +
        '#dsh-force-chinese-panel .dshfc-locked{font-size:11px;color:#22c55e;font-weight:500;margin-top:2px}' +
        '#dsh-force-chinese-panel .dshfc-status{font-size:11px;color:#ef4444;margin-top:2px;min-height:14px}' +
        '#dsh-force-chinese-panel .dshfc-switch{position:relative;width:42px;height:24px;flex:none;cursor:pointer;' +
        'border-radius:12px;background:#cbd5e1;transition:background .18s ease}' +
        '#dsh-force-chinese-panel .dshfc-switch.on{background:#4a6cf7}' +
        '#dsh-force-chinese-panel .dshfc-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;' +
        'border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .18s ease}' +
        '#dsh-force-chinese-panel .dshfc-switch.on::after{left:21px}' +
        '#dsh-force-chinese-panel .dshfc-foot{padding:0 16px 14px;font-size:11px;color:#94a3b8;line-height:1.5}' +
        /* ---- 纵深防御：宿主皮肤按几何特征（fixed+高 z-index）给悬浮元素套皮肤，必须清掉 ---- */
        'html #dsh-force-chinese-ball,body #dsh-force-chinese-ball,' +
        'html #dsh-force-chinese-panel,body #dsh-force-chinese-panel{' +
        'background-image:none !important;border:0 !important;outline:0 !important;' +
        'backdrop-filter:none !important;-webkit-backdrop-filter:none !important;filter:none !important}' +
        'html #dsh-force-chinese-ball,body #dsh-force-chinese-ball{' +
        'background:linear-gradient(135deg,#4a6cf7,#6a5acd) !important;' +
        'width:46px !important;height:46px !important}' +
        'html #dsh-force-chinese-panel,body #dsh-force-chinese-panel{background:#ffffff !important;width:280px !important}' +
        '#dsh-force-chinese-ball svg,#dsh-force-chinese-panel svg{width:24px !important;height:24px !important}';

      document.head.appendChild(style);

      /* 小球按钮（鲸鱼 SVG，内联尺寸防宿主放大） */
      var ball = document.createElement('div');
      ball.id = 'dsh-force-chinese-ball';
      ball.title = '强制中文 · 设置';
      ball.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 12a8 8 0 1 0 16 0"/><path d="M4 12c0-4 3.6-7.2 8-7.2S20 8 20 12"/>' +
        '<path d="M6 12c0 1.6 2 1.6 2 0M10 12c0 1.6 2 1.6 2 0M14 12c0 1.6 2 1.6 2 0"/>' +
        '<path d="M20 9.2c1.6.9 1.6 2.9 0 3.8M4 9.2C2.4 10.1 2.4 12.1 4 13"/>' +
        '<path d="M4 12c0 1.6 2 1.6 2 0"/>' +
        '</svg>';
      document.body.appendChild(ball);

      /* 设置面板 */
      var panel = document.createElement('div');
      panel.id = 'dsh-force-chinese-panel';
      panel.innerHTML =
        '<div class="dshfc-head">' +
          '<div class="dshfc-title">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M12 2c1.5 0 3 1 3 2.5V7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1"/><path d="M12 2c-1.5 0-3 1-3 2.5V7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1"/>' +
              '<path d="M9 15h6"/><path d="M9 11.5h.01M15 11.5h.01"/>' +
            '</svg>' +
            '强制中文' +
          '</div>' +
          '<button class="dshfc-close" title="关闭">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="dshfc-body">' +
          '<div class="dshfc-row">' +
            '<div class="dshfc-label">强制中文<div class="dshfc-locked">已开启 · 不可关闭</div></div>' +
            '<div class="dshfc-switch on"></div>' +
          '</div>' +
          '<div class="dshfc-row">' +
            '<div class="dshfc-label">大肥鱼模式<div class="dshfc-hint">开启后注入鲸鱼娘人设</div></div>' +
            '<div class="dshfc-switch" id="dsh-force-chinese-fw"></div>' +
          '</div>' +
          '<div class="dshfc-status" id="dsh-force-chinese-status"></div>' +
        '</div>' +
        '<div class="dshfc-foot">设置保存于 DSH profile 目录 dsh-force-chinese.json · 切换即时生效</div>';

      document.body.appendChild(panel);

      /* 交互 */
      var fwSwitch = panel.querySelector('#dsh-force-chinese-fw');
      var statusEl = panel.querySelector('#dsh-force-chinese-status');

      function applyState() {
        fwSwitch.classList.toggle('on', fatWhale);
      }
      function setStatus(text) {
        if (statusEl) statusEl.textContent = text || '';
      }

      ball.addEventListener('click', function () {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
          // 打开面板时同步一次 host 最新状态（异步）
          fetchConfig().then(function (host) {
            if (host !== undefined && host !== fatWhale) { fatWhale = host; writeLocal(host); applyState(); }
          });
        }
      });
      panel.querySelector('.dshfc-close').addEventListener('click', function () {
        panel.classList.remove('open');
      });

      fwSwitch.addEventListener('click', function () {
        var next = !fatWhale;
        // 乐观更新：UI 先动
        fatWhale = next;
        applyState();
        writeLocal(next);
        setStatus('同步中…');
        saveConfig(next).then(function (ok) {
          if (ok) {
            setStatus('');
          } else {
            // 同步失败：保留 UI 与本地，下次打开面板再同步
            setStatus('同步失败，将在下次打开面板时重试');
          }
        });
      });

      /* 初始化：先恢复本地状态，再异步拉 host 权威值 */
      fatWhale = readLocal();
      applyState();
      fetchConfig().then(function (host) {
        if (host !== undefined) { fatWhale = host; writeLocal(host); applyState(); }
      });
    }

    mount();

    exports.name = 'dsh-force-chinese-client';
    exports.apply = function apply() {};
    return module.exports;
  },
});
