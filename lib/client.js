/**
 * dsh-force-chinese v0.3.0 · client half（浏览器半）
 * DSH 标准 Client 插件：window.__ModuleLoader__.load({id, factory})
 *
 * 自绘设置面板（小球）：
 *  - 屏幕右侧中部小圆球（鲸鱼 SVG 图标），点击弹出设置面板
 *  - 面板：强制中文（固定开启，仅展示状态）+「大肥鱼模式」开关（可切换）
 *  - 开关经 webServer API（/dsh-force-chinese/config）读写，切换即时生效
 *  - 样式自绘（无第三方 UI 包），无 emoji，全部 SVG 图标
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

    /* ================= 状态 ================= */
    var fatWhale = false;

    function getConfig() {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', API_CONFIG, false);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          var data = JSON.parse(xhr.responseText || '{}');
          return { fatWhale: data.fatWhale === true };
        }
      } catch (e) { /* host 未就绪 */ }
      return { fatWhale: false };
    }

    function putConfig(next) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('PUT', API_CONFIG, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ fatWhale: next }));
        if (xhr.status >= 200 && xhr.status < 300) {
          var data = JSON.parse(xhr.responseText || '{}');
          return data.ok === true;
        }
      } catch (e) { /* host 未就绪 */ }
      return false;
    }

    /* ================= DOM 注入 ================= */
    function mount() {
      if (!document.body) { document.addEventListener('DOMContentLoaded', mount); return; }
      if (document.getElementById('dsh-force-chinese-ball')) return;

      var style = document.createElement('style');
      style.id = 'dsh-force-chinese-style';
      style.textContent =
        '#dsh-force-chinese-ball{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483647;' +
        'width:46px;height:46px;border-radius:50% 0 0 50%;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;background:linear-gradient(135deg,#4a6cf7,#6a5acd);box-shadow:-2px 2px 10px rgba(74,108,247,.45);' +
        'transition:background .2s ease,transform .15s ease;user-select:none}' +
        '#dsh-force-chinese-ball:hover{background:linear-gradient(135deg,#3a5cf0,#5a4acd);transform:translateY(-50%) scale(1.06)}' +
        '#dsh-force-chinese-ball:active{transform:translateY(-50%) scale(.96)}' +
        '#dsh-force-chinese-ball svg{width:24px;height:24px;display:block}' +
        '#dsh-force-chinese-panel{position:fixed;right:14px;top:50%;transform:translateY(-50%);z-index:2147483647;' +
        'width:280px;background:#ffffff;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,.18);' +
        'border:1px solid rgba(15,23,42,.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;' +
        'color:#0f172a;overflow:hidden;display:none;user-select:none}' +
        '#dsh-force-chinese-panel.open{display:block;animation:dsh-force-chinese-pop .18s ease}' +
        '@keyframes dsh-force-chinese-pop{from{opacity:0;transform:translateY(-50%) translateX(8px)}to{opacity:1;transform:translateY(-50%) translateX(0)}}' +
        '#dsh-force-chinese-panel .dshfc-head{display:flex;align-items:center;justify-content:space-between;' +
        'padding:14px 16px 12px;border-bottom:1px solid rgba(15,23,42,.06)}' +
        '#dsh-force-chinese-panel .dshfc-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}' +
        '#dsh-force-chinese-panel .dshfc-title svg{width:18px;height:18px;color:#4a6cf7}' +
        '#dsh-force-chinese-panel .dshfc-close{width:24px;height:24px;border:none;background:transparent;cursor:pointer;' +
        'border-radius:6px;display:flex;align-items:center;justify-content:center;color:#64748b}' +
        '#dsh-force-chinese-panel .dshfc-close:hover{background:rgba(15,23,42,.06);color:#0f172a}' +
        '#dsh-force-chinese-panel .dshfc-close svg{width:16px;height:16px}' +
        '#dsh-force-chinese-panel .dshfc-body{padding:6px 16px 14px}' +
        '#dsh-force-chinese-panel .dshfc-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;' +
        'border-bottom:1px solid rgba(15,23,42,.05)}' +
        '#dsh-force-chinese-panel .dshfc-row:last-child{border-bottom:none}' +
        '#dsh-force-chinese-panel .dshfc-label{font-size:13px;line-height:1.45}' +
        '#dsh-force-chinese-panel .dshfc-hint{font-size:11px;color:#94a3b8;margin-top:2px}' +
        '#dsh-force-chinese-panel .dshfc-locked{font-size:11px;color:#22c55e;font-weight:500;margin-top:2px}' +
        '#dsh-force-chinese-panel .dshfc-switch{position:relative;width:42px;height:24px;flex:none;cursor:pointer;' +
        'border-radius:12px;background:#cbd5e1;transition:background .18s ease}' +
        '#dsh-force-chinese-panel .dshfc-switch.on{background:#4a6cf7}' +
        '#dsh-force-chinese-panel .dshfc-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;' +
        'border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .18s ease}' +
        '#dsh-force-chinese-panel .dshfc-switch.on::after{left:21px}' +
        '#dsh-force-chinese-panel .dshfc-foot{padding:0 16px 14px;font-size:11px;color:#94a3b8;line-height:1.5}';

      document.head.appendChild(style);

      /* 小球按钮（鲸鱼 SVG） */
      var ball = document.createElement('div');
      ball.id = 'dsh-force-chinese-ball';
      ball.title = '强制中文 · 设置';
      ball.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
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
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M12 2c1.5 0 3 1 3 2.5V7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1"/><path d="M12 2c-1.5 0-3 1-3 2.5V7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1"/>' +
              '<path d="M9 15h6"/><path d="M9 11.5h.01M15 11.5h.01"/>' +
            '</svg>' +
            '强制中文' +
          '</div>' +
          '<button class="dshfc-close" title="关闭">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
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
        '</div>' +
        '<div class="dshfc-foot">设置保存于 DSH profile 目录 dsh-force-chinese.json · 切换即时生效</div>';

      document.body.appendChild(panel);

      /* 开关交互 */
      var fwSwitch = panel.querySelector('#dsh-force-chinese-fw');
      function applyState() {
        fwSwitch.classList.toggle('on', fatWhale);
      }
      ball.addEventListener('click', function () {
        panel.classList.toggle('open');
      });
      panel.querySelector('.dshfc-close').addEventListener('click', function () {
        panel.classList.remove('open');
      });
      fwSwitch.addEventListener('click', function () {
        var next = !fatWhale;
        if (putConfig(next)) {
          fatWhale = next;
          applyState();
        }
      });

      /* 初始化状态 */
      fatWhale = getConfig().fatWhale;
      applyState();

      /* 面板随更新同步（可选：每 5s 拉一次，避免外部改动） */
      setInterval(function () {
        var cur = getConfig().fatWhale;
        if (cur !== fatWhale) { fatWhale = cur; applyState(); }
      }, 5000);
    }

    mount();

    exports.name = 'dsh-force-chinese-client';
    exports.apply = function apply() {};
    return module.exports;
  },
});
