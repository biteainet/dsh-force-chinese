/**
 * dsh-force-chinese v0.5.0 · client half
 * 绝对有球版：修复定位防滚木，完美保留小球+面板原貌
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
    var LS_KEY_FAT = 'dsh-force-chinese:fatWhale';
    var LS_KEY_TOKEN = 'dsh-force-chinese:tokenLevel';
    var LS_KEY_BALL_POS = 'dsh-force-chinese:ballPos';

    /* ================= 状态与通信 ================= */
    var fatWhale = false;
    var tokenLevel = 0;

    function readLocal(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function writeLocal(key, val) {
      try { localStorage.setItem(key, typeof val === 'boolean' ? (val ? '1' : '0') : val); } catch (e) {}
    }

    function getTokenDesc(val) {
      if (val === 0) return "正常模式：爱说啥说啥";
      if (val < 30) return "轻度精简：少点寒暄";
      if (val < 60) return "中度精简：只说重点";
      if (val < 90) return "极限压榨：少废话多干活";
      return "终极闭麦：只执行，不废话";
    }

    function fetchConfig() {
      return fetch(API_CONFIG, { method: 'GET', headers: { 'Accept': 'application/json' } })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.fatWhale !== undefined) fatWhale = data.fatWhale;
          if (data.saveTokenLevel !== undefined) tokenLevel = data.saveTokenLevel;
          return true;
        })
        .catch(function () { return false; });
    }

    function saveConfig() {
      return fetch(API_CONFIG, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatWhale: fatWhale, saveTokenLevel: tokenLevel }),
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
        '#dsh-force-chinese-ball{position:fixed;z-index:9999;' +
        'width:46px;height:46px;border-radius:50% 0 0 50%;display:flex;align-items:center;justify-content:center;' +
        'cursor:grab;background:linear-gradient(135deg,#4a6cf7,#6a5acd);box-shadow:-2px 2px 10px rgba(74,108,247,.45);' +
        'transition:background .2s ease;user-select:none;-webkit-user-select:none}' +
        '#dsh-force-chinese-ball:active{cursor:grabbing}' +
        '#dsh-force-chinese-ball:hover{background:linear-gradient(135deg,#3a5cf0,#5a4acd)}' +
        '#dsh-force-chinese-ball svg{width:24px;height:24px;display:block}' +
        /* 面板 */
        '#dsh-force-chinese-panel{position:fixed;z-index:10000;' +
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
        /* 滑块 */
        '#dsh-force-chinese-panel .dshfc-slider-box{padding:12px 0;border-bottom:1px solid rgba(15,23,42,.05);display:flex;flex-direction:column;gap:6px}' +
        '#dsh-force-chinese-panel .dshfc-slider-header{display:flex;justify-content:space-between;font-size:12px}' +
        '#dsh-force-chinese-panel .dshfc-slider-val{color:#4a6cf7;font-weight:bold}' +
        '#dsh-force-chinese-panel input[type=range]{width:100%;cursor:pointer;accent-color:#4a6cf7;' +
        'height:6px;background:#e2e8f0;border-radius:3px;-webkit-appearance:none}' +
        '#dsh-force-chinese-panel input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;' +
        'background:#4a6cf7;cursor:pointer}' +
        '#dsh-force-chinese-panel .dshfc-desc{font-size:11px;color:#94a3b8;text-align:center}' +
        /* 防御 */
        'html #dsh-force-chinese-ball,body #dsh-force-chinese-ball{' +
        'background-image:none !important;border:0 !important;outline:0 !important;' +
        'backdrop-filter:none !important;-webkit-backdrop-filter:none !important;filter:none !important}' +
        'html #dsh-force-chinese-ball,body #dsh-force-chinese-ball{' +
        'background:linear-gradient(135deg,#4a6cf7,#6a5acd) !important;width:46px !important;height:46px !important}' +
        'html #dsh-force-chinese-panel,body #dsh-force-chinese-panel{background:#ffffff !important;width:280px !important}' +
        '#dsh-force-chinese-ball svg,#dsh-force-chinese-panel svg{width:24px !important;height:24px !important}';

      document.head.appendChild(style);

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
      
      // 恢复小球位置（带防滚木校验）
      var savedPos = null;
      try { savedPos = JSON.parse(localStorage.getItem(LS_KEY_BALL_POS)); } catch (e) {}
      
      var isPosValid = savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number' &&
                       savedPos.left >= -10 && savedPos.left <= window.innerWidth &&
                       savedPos.top >= -10 && savedPos.top <= window.innerHeight;
      
      if (isPosValid) {
        ball.style.left = savedPos.left + 'px';
        ball.style.top = savedPos.top + 'px';
      } else {
        // 如果坐标不对（或者第一次装），强制拉到屏幕正中间，绝对不滚木！
        ball.style.left = (window.innerWidth - 46) + 'px';
        ball.style.top = (window.innerHeight / 2 - 23) + 'px';
      }
      
      document.body.appendChild(ball);

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
          '<div class="dshfc-slider-box">' +
            '<div class="dshfc-slider-header"><span>省 Token 强度</span><span class="dshfc-slider-val" id="dshfc-token-val">0%</span></div>' +
            '<input type="range" id="dshfc-token-slider" min="0" max="100" value="0">' +
            '<div class="dshfc-desc" id="dshfc-token-desc">正常模式：爱说啥说啥</div>' +
          '</div>' +
          '<div class="dshfc-status" id="dsh-force-chinese-status"></div>' +
        '</div>' +
        '<div class="dshfc-foot">设置保存于 DSH profile 目录 dsh-force-chinese.json · 切换即时生效</div>';

      document.body.appendChild(panel);

      var fwSwitch = panel.querySelector('#dsh-force-chinese-fw');
      var statusEl = panel.querySelector('#dsh-force-chinese-status');
      var tokenSlider = document.getElementById('dshfc-token-slider');
      var tokenVal = document.getElementById('dshfc-token-val');
      var tokenDesc = document.getElementById('dshfc-token-desc');

      function applyState() {
        fwSwitch.classList.toggle('on', fatWhale);
        tokenSlider.value = tokenLevel;
        tokenVal.textContent = tokenLevel + '%';
        tokenDesc.textContent = getTokenDesc(tokenLevel);
      }
      function setStatus(text) {
        if (statusEl) statusEl.textContent = text || '';
      }

      /* ---- 拖拽 ---- */
      var isDragging = false, startX, startY, initialLeft, initialTop;
      
      ball.addEventListener('pointerdown', function (e) {
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        var rect = ball.getBoundingClientRect();
        initialLeft = rect.left; initialTop = rect.top;
        ball.style.right = 'auto';
        ball.style.transform = 'none';
        ball.setPointerCapture(e.pointerId);
      });

      ball.addEventListener('pointermove', function (e) {
        if (!isDragging) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        var newLeft = Math.max(0, Math.min(initialLeft + dx, window.innerWidth - ball.offsetWidth));
        var newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - ball.offsetHeight));
        ball.style.left = newLeft + 'px';
        ball.style.top = newTop + 'px';
      });

      ball.addEventListener('pointerup', function (e) {
        if (!isDragging) return;
        isDragging = false;
        ball.releasePointerCapture(e.pointerId);
        localStorage.setItem(LS_KEY_BALL_POS, JSON.stringify({
          left: parseInt(ball.style.left, 10),
          top: parseInt(ball.style.top, 10)
        }));
      });

      /* ---- 点击打开面板 ---- */
      ball.addEventListener('click', function () {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
          var rect = ball.getBoundingClientRect();
          var panelLeft = rect.left - 280 - 10;
          if (panelLeft < 0) panelLeft = rect.right + 10;
          var panelTop = rect.top - 100;
          if (panelTop < 0) panelTop = 10;
          if (panelTop + panel.offsetHeight > window.innerHeight) panelTop = window.innerHeight - panel.offsetHeight - 10;
          
          panel.style.left = panelLeft + 'px';
          panel.style.top = panelTop + 'px';

          fetchConfig().then(function () { applyState(); });
        }
      });

      panel.querySelector('.dshfc-close').addEventListener('click', function () {
        panel.classList.remove('open');
      });

      fwSwitch.addEventListener('click', function () {
        fatWhale = !fatWhale;
        applyState();
        writeLocal(LS_KEY_FAT, fatWhale);
        setStatus('同步中…');
        saveConfig().then(function (ok) { setStatus(ok ? '' : '同步失败'); });
      });

      tokenSlider.addEventListener('input', function (e) {
        tokenLevel = parseInt(e.target.value, 10);
        tokenVal.textContent = tokenLevel + '%';
        tokenDesc.textContent = getTokenDesc(tokenLevel);
        writeLocal(LS_KEY_TOKEN, tokenLevel);
      });
      
      tokenSlider.addEventListener('change', function () {
        setStatus('同步中…');
        saveConfig().then(function (ok) { setStatus(ok ? '' : '同步失败'); });
      });

      /* 初始化 */
      fatWhale = readLocal(LS_KEY_FAT) === '1';
      tokenLevel = parseInt(readLocal(LS_KEY_TOKEN) || '0', 10);
      applyState();
      fetchConfig().then(function () { applyState(); });
    }

    mount();

    exports.name = 'dsh-force-chinese-client';
    exports.apply = function apply() {};
    return module.exports;
  },
});