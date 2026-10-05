/**
 * dsh-force-chinese v0.4.0 · client half
 * 可拖拽悬浮窗 + 省 Token 滑块
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
    var LS_KEY_POS = 'dsh-force-chinese:position';

    /* ================= 状态管理 ================= */
    var fatWhale = false;
    var tokenLevel = 0;

    function readLocal() {
      try {
        fatWhale = localStorage.getItem(LS_KEY_FAT) === '1';
        tokenLevel = parseInt(localStorage.getItem(LS_KEY_TOKEN) || '0', 10);
      } catch (e) { /* 隐私模式等 */ }
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
        .then(res => res.json())
        .then(data => {
          if (data.fatWhale !== undefined) fatWhale = data.fatWhale;
          if (data.saveTokenLevel !== undefined) tokenLevel = data.saveTokenLevel;
          return true;
        })
        .catch(() => false);
    }

    function saveConfig() {
      return fetch(API_CONFIG, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatWhale: fatWhale, saveTokenLevel: tokenLevel }),
      }).then(res => res.json()).then(data => data.ok).catch(() => false);
    }

    /* ================= DOM 注入与拖拽 ================= */
    function mount() {
      if (!document.body) { document.addEventListener('DOMContentLoaded', mount); return; }
      if (document.getElementById('dsh-force-chinese-float')) return;

      var style = document.createElement('style');
      style.textContent = `
        #dsh-force-chinese-float {
          position: fixed;
          width: 260px;
          background: #1e1e1e;
          color: #fff;
          border-radius: 10px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.6);
          border: 1px solid #333;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
          user-select: none;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        #dsh-force-chinese-float * { box-sizing: border-box; }
        .dshfc-header {
          padding: 10px 12px;
          background: #252525;
          cursor: grab;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #333;
          font-size: 13px;
          font-weight: bold;
        }
        .dshfc-header:active { cursor: grabbing; }
        .dshfc-close { cursor: pointer; color: #888; font-size: 16px; padding: 0 4px; }
        .dshfc-close:hover { color: #fff; }
        .dshfc-body { padding: 12px; display: flex; flex-direction: column; gap: 14px; }
        .dshfc-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .dshfc-locked { font-size: 11px; color: #4CAF50; }
        .dshfc-slider-box { display: flex; flex-direction: column; gap: 6px; }
        .dshfc-slider-header { display: flex; justify-content: space-between; font-size: 12px; }
        .dshfc-slider-val { color: #4CAF50; font-weight: bold; }
        input[type=range] {
          width: 100%; cursor: pointer; accent-color: #4CAF50;
          height: 6px; background: #333; border-radius: 3px; -webkit-appearance: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
          background: #4CAF50; cursor: pointer;
        }
        .dshfc-desc { font-size: 11px; color: #888; text-align: center; }
        /* 防御宿主皮肤 */
        html #dsh-force-chinese-float, body #dsh-force-chinese-float {
          background-image: none !important; border: 1px solid #333 !important; filter: none !important;
        }
      `;
      document.head.appendChild(style);

      var container = document.createElement('div');
      container.id = 'dsh-force-chinese-float';
      
      // 从 localStorage 读取位置
      var savedPos = null;
      try { savedPos = JSON.parse(localStorage.getItem(LS_KEY_POS)); } catch(e) {}
      if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
        container.style.left = savedPos.left + 'px';
        container.style.top = savedPos.top + 'px';
      } else {
        container.style.right = '20px';
        container.style.bottom = '20px';
      }

      container.innerHTML = `
        <div class="dshfc-header" id="dshfc-drag-handle">
          <span>DSH 控制台</span>
          <span class="dshfc-close" id="dshfc-close" title="隐藏">×</span>
        </div>
        <div class="dshfc-body">
          <div class="dshfc-row">
            <div class="dshfc-label">强制中文<div class="dshfc-locked">已锁定</div></div>
            <div style="font-size:12px; color:#4CAF50;">ON</div>
          </div>
          <div class="dshfc-row">
            <div class="dshfc-label">大肥鱼模式</div>
            <div class="dshfc-switch" id="dshfc-fw" style="width:36px;height:20px;background:#444;border-radius:10px;position:relative;cursor:pointer;transition:.2s;"></div>
          </div>
          <div class="dshfc-slider-box">
            <div class="dshfc-slider-header">
              <span>省 Token 强度</span>
              <span class="dshfc-slider-val" id="dshfc-token-val">0%</span>
            </div>
            <input type="range" id="dshfc-token-slider" min="0" max="100" value="0">
            <div class="dshfc-desc" id="dshfc-token-desc">正常模式：爱说啥说啥</div>
          </div>
        </div>
      `;
      document.body.appendChild(container);

      var fwSwitch = document.getElementById('dshfc-fw');
      var tokenSlider = document.getElementById('dshfc-token-slider');
      var tokenVal = document.getElementById('dshfc-token-val');
      var tokenDesc = document.getElementById('dshfc-token-desc');

      function applyState() {
        // 更新大肥鱼开关 UI
        fwSwitch.style.background = fatWhale ? '#4CAF50' : '#444';
        fwSwitch.innerHTML = '<div style="width:16px;height:16px;background:#fff;border-radius:50%;position:absolute;top:2px;left:'+(fatWhale?'18px':'2px')+';transition:.2s;"></div>';
        
        // 更新滑块 UI
        tokenSlider.value = tokenLevel;
        tokenVal.textContent = tokenLevel + '%';
        tokenDesc.textContent = getTokenDesc(tokenLevel);
      }

      /* ---- 拖拽逻辑 ---- */
      var isDragging = false, startX, startY, initialLeft, initialTop;
      var handle = document.getElementById('dshfc-drag-handle');

      handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.dshfc-close')) return; // 点关闭按钮不拖拽
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        var rect = container.getBoundingClientRect();
        initialLeft = rect.left; initialTop = rect.top;
        
        // 切换为 left/top 定位，方便计算
        container.style.left = initialLeft + 'px';
        container.style.top = initialTop + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        
        handle.setPointerCapture(e.pointerId);
      });

      handle.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        
        var newLeft = initialLeft + dx;
        var newTop = initialTop + dy;
        
        // 窗口边界限制（防止拖出屏幕外找不回来）
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - container.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - container.offsetHeight));
        
        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';
      });

      handle.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        handle.releasePointerCapture(e.pointerId);
        
        // 记录拖拽后的坐标
        localStorage.setItem(LS_KEY_POS, JSON.stringify({
          left: parseInt(container.style.left, 10),
          top: parseInt(container.style.top, 10)
        }));
      });

      /* ---- 交互事件 ---- */
      document.getElementById('dshfc-close').addEventListener('click', () => {
        container.style.display = 'none'; // 隐藏控制台
      });

      fwSwitch.addEventListener('click', () => {
        fatWhale = !fatWhale;
        localStorage.setItem(LS_KEY_FAT, fatWhale ? '1' : '0');
        applyState();
        saveConfig(); // 实时同步到后台
      });

      tokenSlider.addEventListener('input', (e) => {
        tokenLevel = parseInt(e.target.value, 10);
        localStorage.setItem(LS_KEY_TOKEN, tokenLevel);
        applyState();
      });
      
      tokenSlider.addEventListener('change', () => {
        saveConfig(); // 滑动松手后保存到后台
      });

      /* ---- 初始化 ---- */
      readLocal();
      applyState();
      fetchConfig().then(() => applyState()); // 异步拉取后台最新状态
    }

    mount();

    exports.name = 'dsh-force-chinese-client';
    exports.apply = function apply() {};
    return module.exports;
  },
});