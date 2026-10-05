/**
 * dsh-force-chinese v0.4.0 · client half（浏览器半）
 * DSH 标准 Client 插件：window.__ModuleLoader__.load({id, factory})
 *
 * 自绘设置面板（小球）：
 *  - 屏幕右侧中部小圆球（鲸鱼 SVG 图标），点击弹出设置面板
 *  - 面板：强制中文（固定开启）+「大肥鱼模式」开关 +「省 Token 模式」滑块(0-100)
 *  - 与 host 通信：异步 fetch（相对路径 /dsh-force-chinese/config，桌面端 renderer
 *    可正常访问 host webServer —— 与 whale-widget 的 /dsh-whale/* 同机制）
 *  - 乐观更新：点击立即切换 UI，异步保存 host；失败回滚并提示
 *  - 本地持久化：localStorage 兜底（刷新后先恢复 UI，再尝试同步 host）
 *
 * v0.4.0 新增：
 *  - 省 Token 滑块（0-100，默认 0）：滑动实时更新百分比与档位文案，
 *    松手(change) 时 PUT { fatWhale, saveTokenLevel } 给 host。
 *  - 小球拖拽（pointerdown/move/up）：更新 left/top 并做屏幕边界钳制，
 *    拖拽结束写入 localStorage: dsh-force-chinese:ballPos，加载时恢复。
 *  - 底线：面板 × 只执行 panel.classList.remove('open')，绝不隐藏/移除小球。
 *
 * 样式防御（对齐 whale-widget 已验证模式）：
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
    var LS_TOKEN_KEY = 'dsh-force-chinese:saveTokenLevel';
    var LS_POS_KEY = 'dsh-force-chinese:ballPos';
    var BALL_SIZE = 46;

    /* ================= 状态与通信（全异步） ================= */
    var fatWhale = false;
    var tokenLevel = 0;

    /* ---------- 数值规范化 / 档位文案 ---------- */
    function normalizeLevel(v) {
      var n = typeof v === 'number' ? v : parseInt(v, 10);
      if (!isFinite(n)) return 0;
      n = Math.round(n);
      if (n < 0) return 0;
      if (n > 100) return 100;
      return n;
    }

    function tokenTip(level) {
      if (level <= 0) return '正常模式';
      if (level <= 30) return '轻度精简';
      if (level <= 60) return '中度精简';
      if (level <= 90) return '极限压榨';
      return '终极闭麦';
    }

    /* ---------- localStorage ---------- */
    function readLocal() {
      try { return localStorage.getItem(LS_KEY) === '1'; } catch (e) { return false; }
    }
    function writeLocal(v) {
      try { localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch (e) { /* 隐私模式等 */ }
    }
    function readLocalLevel() {
      try { return normalizeLevel(localStorage.getItem(LS_TOKEN_KEY)); } catch (e) { return 0; }
    }
    function writeLocalLevel(v) {
      try { localStorage.setItem(LS_TOKEN_KEY, String(normalizeLevel(v))); } catch (e) { /* 隐私模式等 */ }
    }
    function readPos() {
      try {
        var raw = localStorage.getItem(LS_POS_KEY);
        if (!raw) return null;
        var p = JSON.parse(raw);
        if (p && typeof p.left === 'number' && typeof p.top === 'number' &&
            isFinite(p.left) && isFinite(p.top)) {
          return { left: p.left, top: p.top };
        }
      } catch (e) { /* 解析失败忽略 */ }
      return null;
    }
    function writePos(pos) {
      try {
        localStorage.setItem(LS_POS_KEY, JSON.stringify({ left: Math.round(pos.left), top: Math.round(pos.top) }));
      } catch (e) { /* 隐私模式等 */ }
    }

    /* ---------- 小球坐标：边界钳制 ---------- */
    function viewport() {
      var w = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 1024;
      var h = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 768;
      return { w: w, h: h };
    }
    function clampPos(left, top) {
      var vp = viewport();
      var maxLeft = Math.max(0, vp.w - BALL_SIZE);
      var maxTop = Math.max(0, vp.h - BALL_SIZE);
      var l = (typeof left === 'number' && isFinite(left)) ? left : 0;
      var t = (typeof top === 'number' && isFinite(top)) ? top : 0;
      return {
        left: Math.min(Math.max(0, l), maxLeft),
        top: Math.min(Math.max(0, t), maxTop),
      };
    }
    function defaultPos() {
      var vp = viewport();
      return clampPos(vp.w - BALL_SIZE, Math.round(vp.h / 2 - BALL_SIZE / 2));
    }

    /* ---------- host 通信 ---------- */
    function fetchConfig() {
      return fetch(API_CONFIG, { method: 'GET', headers: { 'Accept': 'application/json' } })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          return {
            fatWhale: data.fatWhale === true,
            saveTokenLevel: normalizeLevel(data.saveTokenLevel),
          };
        })
        .catch(function () { return undefined; });
    }

    function saveConfig(nextFatWhale, nextTokenLevel) {
      return fetch(API_CONFIG, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fatWhale: nextFatWhale === true,
          saveTokenLevel: normalizeLevel(nextTokenLevel),
        }),
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
        /* ---- 小球（位置由 JS 用 left/top 控制，支持拖拽） ---- */
        '#dsh-force-chinese-ball{position:fixed;z-index:9999;' +
        'width:46px;height:46px;border-radius:50% 0 0 50%;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;touch-action:none;background:linear-gradient(135deg,#4a6cf7,#6a5acd);' +
        'box-shadow:-2px 2px 10px rgba(74,108,247,.45);' +
        'transition:background .2s ease;user-select:none;-webkit-user-select:none}' +
        '#dsh-force-chinese-ball:hover{background:linear-gradient(135deg,#3a5cf0,#5a4acd)}' +
        '#dsh-force-chinese-ball svg{width:24px;height:24px;display:block;pointer-events:none}' +
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
        '#dsh-force-chinese-panel .dshfc-row.dshfc-block{display:block}' +
        '#dsh-force-chinese-panel .dshfc-row:last-child{border-bottom:none}' +
        '#dsh-force-chinese-panel .dshfc-label{font-size:13px;line-height:1.45}' +
        '#dsh-force-chinese-panel .dshfc-headline{display:flex;align-items:center;justify-content:space-between;gap:8px;' +
        'font-size:13px;line-height:1.45}' +
        '#dsh-force-chinese-panel .dshfc-pct{font-size:12px;font-weight:600;color:#4a6cf7;font-variant-numeric:tabular-nums}' +
        '#dsh-force-chinese-panel .dshfc-hint{font-size:11px;color:#94a3b8;margin-top:2px}' +
        '#dsh-force-chinese-panel .dshfc-locked{font-size:11px;color:#22c55e;font-weight:500;margin-top:2px}' +
        '#dsh-force-chinese-panel .dshfc-status{font-size:11px;color:#ef4444;margin-top:2px;min-height:14px}' +
        '#dsh-force-chinese-panel .dshfc-switch{position:relative;width:42px;height:24px;flex:none;cursor:pointer;' +
        'border-radius:12px;background:#cbd5e1;transition:background .18s ease}' +
        '#dsh-force-chinese-panel .dshfc-switch.on{background:#4a6cf7}' +
        '#dsh-force-chinese-panel .dshfc-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;' +
        'border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .18s ease}' +
        '#dsh-force-chinese-panel .dshfc-switch.on::after{left:21px}' +
        /* ---- 省 Token 滑块 ---- */
        '#dsh-force-chinese-panel .dshfc-slider{-webkit-appearance:none;appearance:none;display:block;width:100%;' +
        'height:4px;margin:10px 0 0;padding:0;border:none;border-radius:2px;background:#e2e8f0;outline:none;cursor:pointer}' +
        '#dsh-force-chinese-panel .dshfc-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;' +
        'width:16px;height:16px;border:none;border-radius:50%;background:#4a6cf7;box-shadow:0 1px 3px rgba(15,23,42,.35);' +
        'cursor:pointer}' +
        '#dsh-force-chinese-panel .dshfc-slider::-moz-range-thumb{width:16px;height:16px;border:none;border-radius:50%;' +
        'background:#4a6cf7;box-shadow:0 1px 3px rgba(15,23,42,.35);cursor:pointer}' +
        '#dsh-force-chinese-panel .dshfc-slider::-moz-range-track{height:4px;border-radius:2px;background:#e2e8f0}' +
        '#dsh-force-chinese-panel .dshfc-foot{padding:0 16px 14px;font-size:11px;color:#94a3b8;line-height:1.5}' +
        /* ---- 纵深防御：宿主皮肤按几何特征（fixed+高 z-index）给悬浮元素套皮肤，必须清掉 ---- */
        'html #dsh-force-chinese-ball,body #dsh-force-chinese-ball,' +
        'html #dsh-force-chinese-panel,body #dsh-force-chinese-panel{' +
        'background-image:none !important;border:0 !important;outline:0 !important;' +
        'backdrop-filter:none !important;-webkit-backdrop-filter:none !important;filter:none !important}' +
        'html #dsh-force-chinese-ball,body #dsh-force-chinese-ball{' +
        'background:linear-gradient(135deg,#4a6cf7,#6a5acd) !important;' +
        'width:46px !important;height:46px !important;border-radius:50% 0 0 50% !important}' +
        'html #dsh-force-chinese-panel,body #dsh-force-chinese-panel{background:#ffffff !important;width:280px !important}' +
        'html #dsh-force-chinese-panel .dshfc-slider,body #dsh-force-chinese-panel .dshfc-slider{' +
        '-webkit-appearance:none !important;appearance:none !important;width:100% !important;height:4px !important;' +
        'background:#e2e8f0 !important;border:0 !important;border-radius:2px !important;box-shadow:none !important}' +
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

      /* 恢复上次拖拽位置（读取失败则回到默认：屏幕右侧中部） */
      var savedPos = readPos();
      var fallback = defaultPos();
      var initialPos = clampPos(
        savedPos ? savedPos.left : fallback.left,
        savedPos ? savedPos.top : fallback.top,
      );
      ball.style.left = initialPos.left + 'px';
      ball.style.top = initialPos.top + 'px';

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
          '<div class="dshfc-row dshfc-block">' +
            '<div class="dshfc-label">' +
              '<div class="dshfc-headline">' +
                '<span>省 Token 模式</span>' +
                '<span class="dshfc-pct" id="dsh-force-chinese-pct">0%</span>' +
              '</div>' +
              '<div class="dshfc-hint" id="dsh-force-chinese-tip">正常模式</div>' +
            '</div>' +
            '<input class="dshfc-slider" id="dsh-force-chinese-token" type="range" min="0" max="100" step="1" value="0" />' +
          '</div>' +
          '<div class="dshfc-status" id="dsh-force-chinese-status"></div>' +
        '</div>' +
        '<div class="dshfc-foot">设置保存于 DSH profile 目录 dsh-force-chinese.json · 切换即时生效</div>';

      document.body.appendChild(panel);

      /* ================= 元素引用 ================= */
      var fwSwitch = panel.querySelector('#dsh-force-chinese-fw');
      var tokenInput = panel.querySelector('#dsh-force-chinese-token');
      var pctEl = panel.querySelector('#dsh-force-chinese-pct');
      var tipEl = panel.querySelector('#dsh-force-chinese-tip');
      var statusEl = panel.querySelector('#dsh-force-chinese-status');

      function applyState() {
        fwSwitch.classList.toggle('on', fatWhale);
      }

      function applyTokenUI() {
        var v = String(tokenLevel);
        if (tokenInput.value !== v) tokenInput.value = v;
        if (pctEl) pctEl.textContent = tokenLevel + '%';
        if (tipEl) tipEl.textContent = tokenTip(tokenLevel);
      }

      function setStatus(text) {
        if (statusEl) statusEl.textContent = text || '';
      }

      /* ================= 小球拖拽（pointer events） ================= */
      var dragging = false;
      var dragged = false;
      var dragStartX = 0;
      var dragStartY = 0;
      var dragStartLeft = 0;
      var dragStartTop = 0;

      ball.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        dragged = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        var rect = ball.getBoundingClientRect();
        dragStartLeft = rect.left;
        dragStartTop = rect.top;
        try { ball.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      });

      ball.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - dragStartX;
        var dy = e.clientY - dragStartY;
        if (!dragged && (Math.abs(dx) + Math.abs(dy)) < 4) return; // 抖动阈值：仍视为点击
        dragged = true;
        var pos = clampPos(dragStartLeft + dx, dragStartTop + dy); // 屏幕边界限制，防拖丢
        ball.style.left = pos.left + 'px';
        ball.style.top = pos.top + 'px';
      });

      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        try { ball.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        if (!dragged) return;
        var rect = ball.getBoundingClientRect();
        var pos = clampPos(rect.left, rect.top);
        ball.style.left = pos.left + 'px';
        ball.style.top = pos.top + 'px';
        writePos(pos); // 拖拽结束持久化坐标
      }

      ball.addEventListener('pointerup', endDrag);
      ball.addEventListener('pointercancel', endDrag);

      /* 视口变化：把小球夹回可视区 */
      window.addEventListener('resize', function () {
        if (dragging) return;
        var rect = ball.getBoundingClientRect();
        var pos = clampPos(rect.left, rect.top);
        ball.style.left = pos.left + 'px';
        ball.style.top = pos.top + 'px';
        writePos(pos);
      });

      /* ================= 交互 ================= */

      /* 点击小球：切换面板（拖拽后不触发） */
      ball.addEventListener('click', function () {
        if (dragged) { dragged = false; return; }
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
          // 打开面板时同步一次 host 最新状态（异步）
          fetchConfig().then(function (cfg) {
            if (!cfg) return;
            if (cfg.fatWhale !== fatWhale) {
              fatWhale = cfg.fatWhale;
              writeLocal(fatWhale);
              applyState();
            }
            if (cfg.saveTokenLevel !== tokenLevel) {
              tokenLevel = cfg.saveTokenLevel;
              writeLocalLevel(tokenLevel);
              applyTokenUI();
            }
          });
        }
      });

      /* 关闭按钮：只收起面板，绝不影响小球（死保底线） */
      panel.querySelector('.dshfc-close').addEventListener('click', function () {
        panel.classList.remove('open');
      });

      /* 大肥鱼模式开关 */
      fwSwitch.addEventListener('click', function () {
        var next = !fatWhale;
        // 乐观更新：UI 先动
        fatWhale = next;
        applyState();
        writeLocal(next);
        setStatus('同步中…');
        saveConfig(fatWhale, tokenLevel).then(function (ok) {
          if (ok) {
            setStatus('');
          } else {
            // 同步失败：保留 UI 与本地，下次打开面板再同步
            setStatus('同步失败，将在下次打开面板时重试');
          }
        });
      });

      /* 省 Token 滑块：拖动实时更新 UI */
      tokenInput.addEventListener('input', function () {
        tokenLevel = normalizeLevel(tokenInput.value);
        applyTokenUI();
      });

      /* 省 Token 滑块：松手落盘（change 在释放时触发） */
      tokenInput.addEventListener('change', function () {
        tokenLevel = normalizeLevel(tokenInput.value);
        applyTokenUI();
        writeLocalLevel(tokenLevel);
        setStatus('同步中…');
        saveConfig(fatWhale, tokenLevel).then(function (ok) {
          if (ok) {
            setStatus('');
          } else {
            setStatus('同步失败，将在下次打开面板时重试');
          }
        });
      });

      /* 初始化：先恢复本地状态，再异步拉 host 权威值 */
      fatWhale = readLocal();
      tokenLevel = readLocalLevel();
      applyState();
      applyTokenUI();
      fetchConfig().then(function (cfg) {
        if (!cfg) return;
        fatWhale = cfg.fatWhale;
        writeLocal(fatWhale);
        applyState();
        tokenLevel = cfg.saveTokenLevel;
        writeLocalLevel(tokenLevel);
        applyTokenUI();
      });
    }

    mount();

    exports.name = 'dsh-force-chinese-client';
    exports.apply = function apply() {};
    return module.exports;
  },
});
