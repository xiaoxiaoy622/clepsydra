(function () {
    'use strict';

    var _origSetTimeout = window.setTimeout;
    var _origClearTimeout = window.clearTimeout;
    var _origSetInterval = window.setInterval;
    var _origClearInterval = window.clearInterval;
    var _origDate = window.Date;
    var _origDateNow = _origDate.now.bind ? _origDate.now.bind(_origDate) : function () { return _origDate.now(); };
    var _origDateParse = _origDate.parse;
    var _origDateUTC = _origDate.UTC;

    var _percentage = 1.0;
    var _invPercentage = 1.0;
    var _timeoutIds = {};
    var _intervalIds = {};
    var _autoUniqueId = 1;
    var _hooksInstalled = false;

    var _lastRealTime = _origDateNow();
    var _lastVirtualTime = _origDateNow();

    function genUniqueId() { return _autoUniqueId++; }

    function notifyExec(uniqueId) {
        if (!uniqueId) return;
        for (var id in _timeoutIds) {
            var info = _timeoutIds[id];
            if (info.uniqueId === uniqueId) {
                _origClearTimeout.call(window, info.nowId);
                delete _timeoutIds[info.originId];
                break;
            }
        }
    }

    function hookedSetTimeout() {
        var uniqueId = genUniqueId();
        var callback = arguments[0];
        if (typeof callback === 'function') {
            var _cb = callback;
            arguments[0] = function () {
                var ret = _cb.apply(this, arguments);
                notifyExec(uniqueId);
                return ret;
            };
        }
        var originMS = arguments[1];
        arguments[1] = (originMS || 0) * _percentage;
        var resultId = _origSetTimeout.apply(window, arguments);
        _timeoutIds[resultId] = {
            args: arguments, originMS: originMS, originId: resultId,
            nowId: resultId, uniqueId: uniqueId, oldPercentage: _percentage,
            exceptNextFireTime: _origDateNow() + (originMS || 0)
        };
        return resultId;
    }

    function hookedSetInterval() {
        var uniqueId = genUniqueId();
        var callback = arguments[0];
        if (typeof callback === 'function') {
            var _cb = callback;
            arguments[0] = function () {
                var ret = _cb.apply(this, arguments);
                notifyExec(uniqueId);
                return ret;
            };
        }
        var originMS = arguments[1];
        arguments[1] = (originMS || 0) * _percentage;
        var resultId = _origSetInterval.apply(window, arguments);
        _intervalIds[resultId] = {
            args: arguments, originMS: originMS, originId: resultId,
            nowId: resultId, uniqueId: uniqueId, oldPercentage: _percentage,
            exceptNextFireTime: _origDateNow() + (originMS || 0)
        };
        return resultId;
    }

    function hookedClearTimeout() {
        var id = arguments[0];
        if (_timeoutIds[id]) { arguments[0] = _timeoutIds[id].nowId; delete _timeoutIds[id]; }
        return _origClearTimeout.apply(window, arguments);
    }

    function hookedClearInterval() {
        var id = arguments[0];
        if (_intervalIds[id]) { arguments[0] = _intervalIds[id].nowId; delete _intervalIds[id]; }
        return _origClearInterval.apply(window, arguments);
    }

    function percentageChangeHandler(newPercentage) {
        var now = _origDateNow();
        var intKeys = Object.keys(_intervalIds);
        for (var i = 0; i < intKeys.length; i++) {
            var idObj = _intervalIds[intKeys[i]];
            idObj.args[1] = Math.floor((idObj.originMS || 1) * newPercentage);
            _origClearInterval.call(window, idObj.nowId);
            idObj.nowId = _origSetInterval.apply(window, idObj.args);
        }
        var toutKeys = Object.keys(_timeoutIds);
        for (var j = 0; j < toutKeys.length; j++) {
            var idObj2 = _timeoutIds[toutKeys[j]];
            var exceptTime = idObj2.exceptNextFireTime;
            var oldPercentage = idObj2.oldPercentage;
            var time = exceptTime - now;
            if (time < 0) time = 0;
            var changedTime = Math.floor(newPercentage / oldPercentage * time);
            idObj2.args[1] = changedTime;
            idObj2.exceptNextFireTime = now + changedTime;
            idObj2.oldPercentage = newPercentage;
            _origClearTimeout.call(window, idObj2.nowId);
            idObj2.nowId = _origSetTimeout.apply(window, idObj2.args);
        }
    }

    function _HookedDate() {
        var n = arguments.length;
        if (n === 0) return new _origDate(Date.now());
        if (n === 1) return new _origDate(arguments[0]);
        if (n === 2) return new _origDate(arguments[0], arguments[1]);
        if (n === 3) return new _origDate(arguments[0], arguments[1], arguments[2]);
        if (n === 4) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3]);
        if (n === 5) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);
        if (n === 6) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5]);
        return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6]);
    }

    function _hookedDateNow() {
        var realNow = _origDateNow();
        return _lastVirtualTime + (realNow - _lastRealTime) * _invPercentage;
    }

    function installHooks() {
        if (_hooksInstalled) return;
        _hooksInstalled = true;
        window.setTimeout = hookedSetTimeout;
        window.setInterval = hookedSetInterval;
        window.clearTimeout = hookedClearTimeout;
        window.clearInterval = hookedClearInterval;
        window.Date = _HookedDate;
        _HookedDate.now = _hookedDateNow;
        _HookedDate.parse = _origDateParse;
        _HookedDate.UTC = _origDateUTC;
    }

    function removeHooks() {
        if (!_hooksInstalled) return;
        _hooksInstalled = false;
        window.setTimeout = _origSetTimeout;
        window.setInterval = _origSetInterval;
        window.clearTimeout = _origClearTimeout;
        window.clearInterval = _origClearInterval;
        window.Date = _origDate;
        _intervalIds = {};
        _timeoutIds = {};
    }

    function _applySpeed(speed) {
        var realNow = _origDateNow();
        if (speed === 1) {
            _lastVirtualTime = _hookedDateNow();
            _lastRealTime = realNow;
            _percentage = 1.0;
            _invPercentage = 1.0;
            percentageChangeHandler(1.0);
            return;
        }
        installHooks();
        _lastVirtualTime = _hookedDateNow();
        _lastRealTime = realNow;
        var newPercentage = 1 / speed;
        percentageChangeHandler(newPercentage);
        _percentage = newPercentage;
        _invPercentage = speed;
    }

    window.$hookTimer = {
        setSpeed: function (speed) {
            if (typeof speed !== 'number' || speed <= 0) return;
            _applySpeed(speed);
        },
        getSpeed: function () { return 1 / _percentage; },
        getPercentage: function () { return _percentage; }
    };

    // ===================== UI =====================
    var _jsq_value = 1;
    var _isPersistent = false;
    var _ballLeft = 20, _ballTop = 25;

    var PRESETS = [0.5, 1, 2, 5, 10, 50];
    var MIN = 0.1, MAX = 200;
    var logMin = Math.log(MIN), logMax = Math.log(MAX);
    var STORAGE_KEY = 'accel_leoke_speed';
    var PERSIST_KEY = 'accel_leoke_persist';

    function speedToPos(s) { return (Math.log(s) - logMin) / (logMax - logMin); }
    function posToSpeed(p) { return Math.exp(logMin + p * (logMax - logMin)); }

    function snapToPreset(s) {
        for (var i = 0; i < PRESETS.length; i++) {
            if (Math.abs(PRESETS[i] - s) / s < 0.08) return PRESETS[i];
        }
        return Math.round(s * 100) / 100;
    }

    function fmtSpeed(s) { return s >= 10 ? Math.round(s) : (Math.round(s * 10) / 10); }

    function updateDrips(currentSpeed) {
        var drips = document.querySelectorAll('.drip');
        var interval = Math.max(0.3, 2 / currentSpeed);
        for (var i = 0; i < drips.length; i++) {
            drips[i].style.animationDuration = interval + 's';
        }
    }

    var _cssText = [
        '@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&display=swap");',
        '#leoke-stamp{position:fixed;z-index:2147483647;width:54px;height:54px;border-radius:50%;border:2px solid #8b7355;background:radial-gradient(circle at 35% 35%,rgba(139,115,85,0.3),rgba(15,15,30,0.95));color:#d4a843;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;user-select:none;font-weight:900;line-height:1;box-shadow:0 2px 12px rgba(139,115,85,0.3),inset 0 0 15px rgba(139,115,85,0.1);touch-action:none;transform:translateZ(0)}',
        '#leoke-stamp::before{content:"";position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:14px;height:10px;border-radius:2px 2px 0 0;background:#6d5a3a;border:1.5px solid #8b7355;border-bottom:none}',
        '#leoke-stamp::after{content:"";position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);width:2px;height:20px;background:linear-gradient(180deg,#c23a2b,#8b1a10);border-radius:0 0 1px 1px;animation:tasselSway 3s ease-in-out infinite;transform-origin:top center}',
        '@keyframes tasselSway{0%,100%{transform:translateX(-50%) rotate(-2deg)}50%{transform:translateX(-50%) rotate(2deg)}}',
        '#leoke-stamp:hover{box-shadow:0 4px 20px rgba(212,168,67,0.35),inset 0 0 15px rgba(139,115,85,0.15)}',
        '#leoke-stamp.dragging{cursor:grabbing}',
        '#leoke-stamp .stamp-char{font-size:16px;color:#c23a2b;text-shadow:0 0 6px rgba(194,58,43,0.4);margin-bottom:1px;font-family:"Noto Serif SC","SimSun","Songti SC",serif}',
        '#leoke-stamp .stamp-speed{font-size:11px;color:#d4a843;letter-spacing:0}',
        '#leoke-panel{position:fixed;z-index:2147483647;width:210px;visibility:hidden;opacity:0;transform:translateY(-8px) scale(0.96);transition:all .3s cubic-bezier(.4,0,.2,1);pointer-events:none}',
        '#leoke-panel.open{visibility:visible;opacity:1;transform:translateY(0) scale(1);pointer-events:auto}',
        '#leoke-panel .panel-body{background:linear-gradient(180deg,rgba(22,22,42,0.97),rgba(15,15,30,0.99));border:1.5px solid #8b7355;border-radius:4px;padding:0;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 1px rgba(139,115,85,0.3);font-family:"Noto Serif SC","SimSun","Songti SC",serif}',
        '#leoke-panel .panel-close{position:absolute;top:20px;right:10px;width:22px;height:22px;border:1px solid rgba(212,168,67,0.25);background:rgba(194,58,43,0.08);color:#c23a2b;font-size:13px;cursor:pointer;border-radius:2px;display:flex;align-items:center;justify-content:center;transition:all .15s;z-index:5;font-family:"Noto Serif SC","SimSun","Songti SC",serif}',
        '#leoke-panel .panel-close:hover{background:#c23a2b;color:#d4a843;border-color:#c23a2b}',
        '.huiwen-top{height:16px;margin:0;position:relative;overflow:hidden;border-bottom:1px solid rgba(212,168,67,0.2)}',
        '.huiwen-top svg{width:100%;height:100%;display:block}',
        '.huiwen-bottom{height:10px;position:relative;overflow:hidden;border-top:1px solid rgba(212,168,67,0.15)}',
        '.huiwen-bottom svg{width:100%;height:100%;display:block}',
        '#leoke-panel .panel-inner{padding:14px 16px 16px}',
        '#leoke-panel .panel-title{text-align:center;font-size:18px;font-weight:900;color:#d4a843;letter-spacing:6px;margin-bottom:14px;text-shadow:0 0 12px rgba(212,168,67,0.25);font-family:"Noto Serif SC","SimSun","Songti SC",serif}',
        '#leoke-panel .speed-readout{text-align:center;margin-bottom:14px;padding:10px 0;border-bottom:1px solid rgba(212,168,67,0.1);position:relative}',
        '#leoke-panel .speed-readout::before,#leoke-panel .speed-readout::after{content:"\u25c7";position:absolute;top:50%;transform:translateY(-50%);font-size:6px;color:#c23a2b;opacity:0.5}',
        '#leoke-panel .speed-readout::before{left:4px}',
        '#leoke-panel .speed-readout::after{right:4px}',
        '#leoke-panel .speed-readout .num{font-size:38px;font-weight:900;color:#f5f0e6;line-height:1;font-family:"Noto Serif SC","SimSun","Songti SC",serif}',
        '#leoke-panel .speed-readout .unit{font-size:11px;color:rgba(245,240,230,0.35);margin-top:2px;letter-spacing:2px;font-family:"Noto Serif SC","SimSun","Songti SC",serif}',
        '.漏刻-wrap{display:flex;justify-content:center;margin-bottom:14px;padding:6px 0}',
        '.漏刻{position:relative;width:56px;height:200px}',
        '.漏刻-vessel{position:absolute;top:0;left:0;right:0;bottom:0;border:2px solid #8b7355;border-radius:4px 4px 12px 12px;background:rgba(15,15,30,0.6);overflow:hidden;box-shadow:inset 0 0 20px rgba(0,0,0,0.4),0 2px 8px rgba(0,0,0,0.3)}',
        '.漏刻-rim{position:absolute;top:-1px;left:-3px;right:-3px;height:8px;background:linear-gradient(180deg,#a89070,#8b7355,#6d5a3a);border-radius:3px 3px 0 0;z-index:3}',
        '.漏刻-water{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(0deg,#2e5560,#4a7c8a,#6aacba);border-radius:0 0 10px 10px;transition:height .2s ease;box-shadow:0 -2px 8px rgba(74,124,138,0.3)}',
        '.漏刻-water::before{content:"";position:absolute;top:-1px;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,rgba(106,172,186,0.5),transparent);border-radius:2px}',
        '.漏刻-drips{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:20px;height:40px;z-index:4;pointer-events:none}',
        '.drip{position:absolute;left:50%;transform:translateX(-50%);width:4px;height:4px;background:#6aacba;border-radius:50%;opacity:0;animation:dripFall 1.5s ease-in infinite}',
        '.drip:nth-child(2){animation-delay:.5s}',
        '.drip:nth-child(3){animation-delay:1s}',
        '@keyframes dripFall{0%{top:0;opacity:0;transform:translateX(-50%) scale(0.5)}10%{opacity:0.8;transform:translateX(-50%) scale(1)}90%{opacity:0.6}100%{top:40px;opacity:0;transform:translateX(-50%) scale(0.3)}}',
        '.漏刻-marks{position:absolute;top:10px;left:0;right:0;bottom:0;z-index:2;pointer-events:none}',
        '.漏刻-mark{position:absolute;left:0;right:0;display:flex;align-items:center}',
        '.漏刻-mark-line{width:8px;height:1px;background:rgba(212,168,67,0.25)}',
        '.漏刻-mark-label{font-size:8px;color:rgba(245,240,230,0.3);margin-left:2px;white-space:nowrap;font-family:"Noto Serif SC","SimSun","Songti SC",serif}',
        '.漏刻-thumb{position:absolute;left:50%;transform:translate(-50%,0);width:38px;height:14px;z-index:5;background:linear-gradient(180deg,#a89070,#8b7355,#6d5a3a);border:1.5px solid #a89070;border-radius:7px;box-shadow:0 0 8px rgba(139,115,85,0.4),0 2px 4px rgba(0,0,0,0.4);cursor:grab}',
        '.漏刻-thumb::before{content:"";position:absolute;top:3px;left:6px;right:6px;height:1px;background:rgba(245,240,230,0.2)}',
        '.漏刻-thumb::after{content:"";position:absolute;bottom:3px;left:6px;right:6px;height:1px;background:rgba(245,240,230,0.15)}',
        '.漏刻-thumb:active{cursor:grabbing;box-shadow:0 0 14px rgba(212,168,67,0.4)}',
        '.漏刻-tooltip{position:absolute;left:calc(100% + 8px);top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:#d4a843;white-space:nowrap;background:rgba(15,15,30,0.9);padding:3px 8px;border-radius:3px;border:1px solid rgba(212,168,67,0.25);pointer-events:none;opacity:0;transition:opacity .2s;font-family:"Noto Serif SC","SimSun","Songti SC",serif;z-index:6}',
        '.漏刻:hover .漏刻-tooltip,.漏刻-thumb:active ~ .漏刻-tooltip{opacity:1}',
        '#leoke-panel .preset-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px}',
        '#leoke-panel .preset-btn{height:30px;border:1px solid rgba(212,168,67,0.2);background:rgba(212,168,67,0.04);color:#c8c0b0;font-size:11px;font-weight:700;cursor:pointer;border-radius:2px;display:flex;align-items:center;justify-content:center;transition:all .15s;font-family:"Noto Serif SC","SimSun","Songti SC",serif;letter-spacing:0}',
        '#leoke-panel .preset-btn:hover{background:rgba(212,168,67,0.12);border-color:rgba(212,168,67,0.35)}',
        '#leoke-panel .preset-btn.active{background:rgba(194,58,43,0.2);border-color:#c23a2b;color:#d4a843;box-shadow:0 0 8px rgba(212,168,67,0.2)}',
        '#leoke-panel .panel-bottom{display:flex;gap:6px}',
        '#leoke-panel .ctrl-btn{flex:1;height:30px;border:1px solid rgba(212,168,67,0.2);background:rgba(212,168,67,0.04);color:#c8c0b0;font-size:11px;font-weight:600;cursor:pointer;border-radius:2px;transition:all .15s;letter-spacing:2px;font-family:"Noto Serif SC","SimSun","Songti SC",serif}',
        '#leoke-panel .ctrl-btn:hover{background:rgba(212,168,67,0.1);border-color:rgba(212,168,67,0.3)}',
        '#leoke-panel .ctrl-btn.on{background:rgba(194,58,43,0.15);border-color:#c23a2b;color:#d4a843}',
        '.leoke-mountain{position:fixed;bottom:0;left:0;right:0;height:300px;pointer-events:none;z-index:0}',
        '.leoke-mountain::before{content:"";position:absolute;bottom:0;left:-5%;width:110%;height:180px;background:radial-gradient(ellipse 60% 100% at 15% 100%,rgba(22,22,42,0.9) 0%,transparent 70%),radial-gradient(ellipse 40% 80% at 45% 100%,rgba(22,22,42,0.7) 0%,transparent 60%),radial-gradient(ellipse 50% 90% at 75% 100%,rgba(22,22,42,0.8) 0%,transparent 65%),radial-gradient(ellipse 30% 60% at 90% 100%,rgba(22,22,42,0.6) 0%,transparent 55%)}',
        '.leoke-mountain::after{content:"";position:absolute;bottom:0;left:0;right:0;height:100px;background:linear-gradient(0deg,#0f0f1e 0%,transparent 100%)}',
        '.leoke-dust{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}',
        '.leoke-dust-p{position:absolute;width:2px;height:2px;background:rgba(212,168,67,0.15);border-radius:50%;animation:leokeDustFloat linear infinite}',
        '@keyframes leokeDustFloat{0%{opacity:0;transform:translateY(0)}20%{opacity:.4}80%{opacity:.3}100%{opacity:0;transform:translateY(-60vh)}}',
        '@media(max-width:767px){#leoke-stamp{width:42px;height:42px}#leoke-stamp .stamp-char{font-size:13px}#leoke-stamp .stamp-speed{font-size:10px}#leoke-panel{width:210px}.漏刻{height:140px}.漏刻-thumb{width:32px;height:12px}#leoke-panel .preset-btn{height:26px}#leoke-panel .ctrl-btn{height:26px}#leoke-panel .panel-inner{padding:10px 12px 12px}}',
        '@media(prefers-reduced-motion:reduce){#leoke-stamp::after{animation:none}#leoke-panel{transition:none}.漏刻-water{transition:none}.drip{animation:none}.leoke-dust-p{animation:none}}'
    ];

    var _styleNode = document.createElement('style');
    _styleNode.textContent = _cssText.join('');

    var _scaleItems = [
        {speed: 0.1, label: '\u5341\u5206'},
        {speed: 0.5, label: '\u534a\u606f'},
        {speed: 1,   label: '\u4e00\u606f'},
        {speed: 2,   label: '\u4e8c\u606f'},
        {speed: 5,   label: '\u534a\u523b'},
        {speed: 10,  label: '\u4e00\u523b'},
        {speed: 50,  label: '\u4e09\u523b'},
        {speed: 100, label: '\u4e00\u65f6'},
        {speed: 200, label: '\u6781'}
    ];

    var _stamp = document.createElement('div');
    _stamp.id = 'leoke-stamp';
    _stamp.setAttribute('role', 'button');
    _stamp.setAttribute('aria-label', '\u6e38\u620f\u52a0\u901f\u5668');
    _stamp.setAttribute('tabindex', '0');
    _stamp.innerHTML = '<span class="stamp-char">\u6f0f</span><span class="stamp-speed" id="leokeStampSpeed">1x</span>';

    var _mountain = document.createElement('div');
    _mountain.className = 'leoke-mountain';

    var _dust = document.createElement('div');
    _dust.className = 'leoke-dust';
    _dust.id = 'leokeDust';

    var _huiwenTopHtml = '<svg viewBox="0 0 210 16" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="leokeHw1" x="0" y="0" width="20" height="16" patternUnits="userSpaceOnUse"><path d="M0,4 h4 v-4 h8 v4 h4 v8 h-4 v4 h-8 v-4 h-4 z" fill="none" stroke="rgba(212,168,67,0.2)" stroke-width="0.6"/><path d="M4,8 h4 v-4" fill="none" stroke="rgba(194,58,43,0.15)" stroke-width="0.4"/></pattern></defs><rect width="210" height="16" fill="url(#leokeHw1)"/></svg>';

    var _huiwenBottomHtml = '<svg viewBox="0 0 210 10" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="leokeHw2" x="0" y="0" width="12" height="10" patternUnits="userSpaceOnUse"><path d="M0,2 h3 v-2 h6 v2 h3 v6 h-3 v2 h-6 v-2 h-3 z" fill="none" stroke="rgba(212,168,67,0.15)" stroke-width="0.5"/></pattern></defs><rect width="210" height="10" fill="url(#leokeHw2)"/></svg>';

    var _huiwenTop = document.createElement('div');
    _huiwenTop.className = 'huiwen-top';

    var _huiwenBottom = document.createElement('div');
    _huiwenBottom.className = 'huiwen-bottom';

    var _panelInner = document.createElement('div');
    _panelInner.className = 'panel-inner';

    var _panelTitle = document.createElement('div');
    _panelTitle.className = 'panel-title';
    _panelTitle.textContent = '\u6f0f \u523b';

    var _speedReadout = document.createElement('div');
    _speedReadout.className = 'speed-readout';
    _speedReadout.innerHTML = '<div class="num" id="leokeSpeedNum">1</div><div class="unit">\u500d \u901f</div>';

    var _漏刻Wrap = document.createElement('div');
    _漏刻Wrap.className = '漏刻-wrap';

    var _漏刻 = document.createElement('div');
    _漏刻.className = '漏刻';
    _漏刻.id = '漏刻';

    var _漏刻Vessel = document.createElement('div');
    _漏刻Vessel.className = '漏刻-vessel';

    var _漏刻Rim = document.createElement('div');
    _漏刻Rim.className = '漏刻-rim';

    var _漏刻Water = document.createElement('div');
    _漏刻Water.className = '漏刻-water';
    _漏刻Water.id = '漏刻-water';

    var _漏刻Drips = document.createElement('div');
    _漏刻Drips.className = '漏刻-drips';
    _漏刻Drips.innerHTML = '<div class="drip"></div><div class="drip"></div><div class="drip"></div>';

    var _漏刻Marks = document.createElement('div');
    _漏刻Marks.className = '漏刻-marks';
    _漏刻Marks.id = '漏刻-marks';

    var _漏刻Thumb = document.createElement('div');
    _漏刻Thumb.className = '漏刻-thumb';
    _漏刻Thumb.id = '漏刻-thumb';

    var _漏刻Tooltip = document.createElement('div');
    _漏刻Tooltip.className = '漏刻-tooltip';
    _漏刻Tooltip.id = '漏刻-tooltip';
    _漏刻Tooltip.textContent = '1x';

    var _presetRow = document.createElement('div');
    _presetRow.className = 'preset-row';
    _presetRow.id = 'leokePresetRow';

    var _panelBottom = document.createElement('div');
    _panelBottom.className = 'panel-bottom';

    var _btnPersist = document.createElement('button');
    _btnPersist.className = 'ctrl-btn';
    _btnPersist.id = 'leokeBtnPersist';
    _btnPersist.textContent = '\u6301 \u4e45';

    var _btnReset = document.createElement('button');
    _btnReset.className = 'ctrl-btn';
    _btnReset.id = 'leokeBtnReset';
    _btnReset.textContent = '\u5f52 \u4e00';

    var _panelClose = document.createElement('button');
    _panelClose.className = 'panel-close';
    _panelClose.id = 'leokePanelClose';
    _panelClose.textContent = '\u00d7';
    _panelClose.setAttribute('title', '\u5173\u95ed');

    var _panelBody = document.createElement('div');
    _panelBody.className = 'panel-body';

    var _panel = document.createElement('div');
    _panel.id = 'leoke-panel';
    _panel.setAttribute('role', 'dialog');
    _panel.setAttribute('aria-label', '\u52a0\u901f\u63a7\u5236\u9762\u677f');

    // Build hierarchy
    _漏刻Vessel.appendChild(_漏刻Rim);
    _漏刻Vessel.appendChild(_漏刻Water);
    _漏刻Vessel.appendChild(_漏刻Drips);
    _漏刻Vessel.appendChild(_漏刻Marks);
    _漏刻.appendChild(_漏刻Vessel);
    _漏刻.appendChild(_漏刻Thumb);
    _漏刻.appendChild(_漏刻Tooltip);
    _漏刻Wrap.appendChild(_漏刻);

    _panelBottom.appendChild(_btnPersist);
    _panelBottom.appendChild(_btnReset);

    _panelInner.appendChild(_panelTitle);
    _panelInner.appendChild(_speedReadout);
    _panelInner.appendChild(_漏刻Wrap);
    _panelInner.appendChild(_presetRow);
    _panelInner.appendChild(_panelBottom);

    _huiwenTop.innerHTML = _huiwenTopHtml;
    _huiwenBottom.innerHTML = _huiwenBottomHtml;

    _panelBody.appendChild(_panelClose);
    _panelBody.appendChild(_huiwenTop);
    _panelBody.appendChild(_panelInner);
    _panelBody.appendChild(_huiwenBottom);

    _panel.appendChild(_panelBody);

    // Build preset buttons
    for (var _pi = 0; _pi < PRESETS.length; _pi++) {
        var pb = document.createElement('button');
        pb.className = 'preset-btn';
        pb.textContent = PRESETS[_pi] + 'x';
        pb.setAttribute('data-speed', String(PRESETS[_pi]));
        _presetRow.appendChild(pb);
    }

    function _mountUI() {
        if (window.__leokeRendered) return;
        window.__leokeRendered = true;

        // Set initial stamp position
        _stamp.style.left = _ballLeft + 'px';
        _stamp.style.top = _ballTop + 'px';

        document.head.appendChild(_styleNode);
        var _frag = document.createDocumentFragment();
        _frag.appendChild(_stamp);
        _frag.appendChild(_mountain);
        _frag.appendChild(_dust);
        _frag.appendChild(_panel);
        document.body.appendChild(_frag);

        // Dust particles
        (function () {
            var dc = document.getElementById('leokeDust');
            for (var i = 0; i < 15; i++) {
                var p = document.createElement('div');
                p.className = 'leoke-dust-p';
                p.style.left = Math.random() * 100 + '%';
                p.style.bottom = 5 + Math.random() * 25 + '%';
                p.style.animationDuration = (10 + Math.random() * 15) + 's';
                p.style.animationDelay = Math.random() * 12 + 's';
                p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
                dc.appendChild(p);
            }
        })();

        var _stampSpeedEl = document.getElementById('leokeStampSpeed');
        var _speedNumEl = document.getElementById('leokeSpeedNum');
        var _tooltipEl = document.getElementById('漏刻-tooltip');
        var _waterFillEl = document.getElementById('漏刻-water');
        var _thumbEl = document.getElementById('漏刻-thumb');
        var _vesselEl = document.getElementById('漏刻');
        var _marksEl = document.getElementById('漏刻-marks');
        var _presetBtns = _presetRow.querySelectorAll('.preset-btn');
        for (var _pbIdx = 0; _pbIdx < _presetBtns.length; _pbIdx++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    _setSpeedUI(parseFloat(btn.getAttribute('data-speed')));
                });
            })(_presetBtns[_pbIdx]);
        }

        // Build scale marks
        (function () {
            for (var i = 0; i < _scaleItems.length; i++) {
                var item = _scaleItems[i];
                var pos = speedToPos(item.speed);
                var pct = pos * 100;
                var row = document.createElement('div');
                row.className = '漏刻-mark';
                row.style.bottom = 'calc(' + pct + '% + 8px)';
                row.innerHTML = '<div class="漏刻-mark-line"></div><div class="漏刻-mark-label">' + item.label + '</div>';
                _marksEl.appendChild(row);
            }
        })();

        function _setSpeedUI(v) {
            _jsq_value = v;
            var label = fmtSpeed(v);
            _stampSpeedEl.textContent = label + 'x';
            _speedNumEl.textContent = label;
            _tooltipEl.textContent = label + 'x';

            var pos = speedToPos(v);
            var pct = pos * 100;
            _waterFillEl.style.height = pct + '%';
            _thumbEl.style.bottom = 'calc(' + pct + '%)';

            updateDrips(v);

            for (var _j = 0; _j < _presetBtns.length; _j++) {
                var btn = _presetBtns[_j];
                var btnVal = parseFloat(btn.getAttribute('data-speed'));
                if (Math.abs(btnVal - v) < 0.01) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }

            _btnPersist.classList.toggle('on', _isPersistent);
            _btnPersist.textContent = _isPersistent ? '\u5df2\u6301' : '\u6301 \u4e45';

            try {
                _applySpeed(v);
            } catch (error) {
                // silent
            }

            if (_isPersistent) {
                try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { }
            }
        }

        var _panelRafId = 0;
        var _closeTimerId = 0;

        function _openPanel() {
            if (_closeTimerId) { _origClearTimeout.call(window, _closeTimerId); _closeTimerId = 0; }
            if (_panelRafId) { cancelAnimationFrame(_panelRafId); _panelRafId = 0; }

            var stampRect = _stamp.getBoundingClientRect();
            var vpW = window.innerWidth;
            var vpH = window.innerHeight;
            var panelW = 210;

            var pLeft = stampRect.left;
            if (pLeft + panelW > vpW - 10) pLeft = vpW - panelW - 10;
            if (pLeft < 10) pLeft = 10;

            var pTop = stampRect.bottom + 8;
            _panel.style.left = pLeft + 'px';
            _panel.style.top = pTop + 'px';
            _panel.classList.add('open');

            var panelH = _panel.offsetHeight;
            if (pTop + panelH > vpH - 10) {
                pTop = stampRect.top - panelH - 8;
                if (pTop < 10) pTop = 10;
            }
            _panel.style.top = pTop + 'px';

            _panelRafId = requestAnimationFrame(function () {
                _panelRafId = 0;
            });

            _origSetTimeout.call(window, function () {
                var firstBtn = _presetRow.querySelector('.preset-btn');
                if (firstBtn) firstBtn.focus();
            }, 50);
        }

        function _closePanel() {
            if (_panelRafId) { cancelAnimationFrame(_panelRafId); _panelRafId = 0; }
            _panel.classList.remove('open');
            _closeTimerId = _origSetTimeout.call(window, function () {
                _closeTimerId = 0;
                _stamp.focus();
            }, 300);
        }

        function _togglePersist() {
            _isPersistent = !_isPersistent;
            if (_isPersistent) {
                try {
                    localStorage.setItem(PERSIST_KEY, 'true');
                    localStorage.setItem(STORAGE_KEY, _jsq_value);
                } catch (e) { }
            } else {
                try {
                    localStorage.setItem(PERSIST_KEY, 'false');
                    localStorage.removeItem(STORAGE_KEY);
                } catch (e) { }
            }
            _btnPersist.classList.toggle('on', _isPersistent);
            _btnPersist.textContent = _isPersistent ? '\u5df2\u6301' : '\u6301 \u4e45';
        }

        // --- Stamp drag + click/dblclick ---
        (function (el) {
            var dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0, moved = false;
            var _clickTimer = 0;

            function _onDown(e) {
                dragging = true; moved = false;
                var t = e.touches ? e.touches[0] : e;
                startX = t.clientX; startY = t.clientY;
                var r = el.getBoundingClientRect();
                origLeft = r.left; origTop = r.top;
                el.classList.add('dragging');
            }

            function _onMove(e) {
                if (!dragging) return;
                var t = e.touches ? e.touches[0] : e;
                var dx = t.clientX - startX, dy = t.clientY - startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
                var nLeft = Math.max(0, Math.min(window.innerWidth - 54, origLeft + dx));
                var nTop = Math.max(0, Math.min(window.innerHeight - 80, origTop + dy));
                el.style.left = nLeft + 'px';
                el.style.top = nTop + 'px';
                _ballLeft = nLeft;
                _ballTop = nTop;
                if (_panel.classList.contains('open')) {
                    _panel.style.left = nLeft + 'px';
                    _panel.style.top = (nTop + 64) + 'px';
                }
            }

            function _onUp() {
                if (!dragging) return;
                dragging = false;
                el.classList.remove('dragging');
                el._dragged = moved;
            }

            el.addEventListener('touchstart', _onDown, { passive: false });
            el.addEventListener('touchmove', _onMove, { passive: false });
            el.addEventListener('touchend', _onUp, { passive: false });
            el.addEventListener('mousedown', _onDown);
            document.addEventListener('mousemove', _onMove);
            document.addEventListener('mouseup', _onUp);
            el.addEventListener('mouseleave', function () {
                if (dragging) _onUp();
            });

            el.addEventListener('click', function (e) {
                if (el._dragged) { el._dragged = false; return; }
                if (_clickTimer) {
                    _origClearTimeout.call(window, _clickTimer);
                    _clickTimer = 0;
                    _setSpeedUI(1);
                    return;
                }
                _clickTimer = _origSetTimeout.call(window, function () {
                    _clickTimer = 0;
                    if (!_panel.classList.contains('open')) _openPanel();
                    else _closePanel();
                }, 250);
            }, false);
        })(_stamp);

        // --- Slider drag ---
        (function () {
            var dragging = false;
            function getPos(e) {
                var rect = _vesselEl.getBoundingClientRect();
                var ev = e.touches ? e.touches[0] : e;
                var y = rect.bottom - ev.clientY;
                return Math.max(0, Math.min(1, y / rect.height));
            }
            function onDown(e) {
                dragging = true;
                _setSpeedUI(snapToPreset(posToSpeed(getPos(e))));
                if (!e.touches) e.preventDefault();
            }
            function onMove(e) {
                if (!dragging) return;
                _setSpeedUI(snapToPreset(posToSpeed(getPos(e))));
                if (!e.touches) e.preventDefault();
            }
            function onUp() { dragging = false; }
            _thumbEl.addEventListener('mousedown', onDown);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            _thumbEl.addEventListener('touchstart', onDown, { passive: false });
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
            _vesselEl.addEventListener('mousedown', onDown);
            _vesselEl.addEventListener('touchstart', onDown, { passive: false });
        })();

        // --- Close button ---
        _panelClose.addEventListener('click', _closePanel);

        // --- Persist button ---
        _btnPersist.addEventListener('click', _togglePersist);

        // --- Reset button ---
        _btnReset.addEventListener('click', function () { _setSpeedUI(1); });

        // --- Click outside to close ---
        document.addEventListener('mousedown', function (e) {
            if (_panel.classList.contains('open') && !_panel.contains(e.target) && !_stamp.contains(e.target)) _closePanel();
        });

        // --- Stamp keyboard ---
        _stamp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!_panel.classList.contains('open')) _openPanel();
                else _closePanel();
            }
        });

        // --- Panel keyboard trap ---
        _panel.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { _closePanel(); return; }
            if (e.key !== 'Tab') return;
            var focusable = _panel.querySelectorAll('.preset-btn, #leokePanelClose, #leokeBtnPersist, #leokeBtnReset');
            if (focusable.length === 0) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        // --- Restore persistence ---
        try {
            var _persistent = localStorage.getItem(PERSIST_KEY);
            var _saved = localStorage.getItem(STORAGE_KEY);
            if (_persistent === 'true' && _saved) {
                var _spd = parseFloat(_saved);
                if (!isNaN(_spd) && _spd > 0 && _spd !== 1) {
                    _isPersistent = true;
                    _btnPersist.classList.add('on');
                    _btnPersist.textContent = '\u5df2\u6301';
                    _origSetTimeout.call(window, function () { _setSpeedUI(_spd); }, 800);
                }
            }
        } catch (e) { }

        // --- Initial UI ---
        if (!_isPersistent) { _setSpeedUI(1); }

        // --- Keyboard shortcuts ---
        window.addEventListener('keydown', function (e) {
            var currentSpeed = _invPercentage;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === '9' && (e.ctrlKey || e.altKey)) {
                var t = prompt('\u8f93\u5165\u6b32\u6539\u53d8\u7684\u500d\u7387\uff08\u5f53\u524d\uff1a' + currentSpeed.toFixed(2) + '\uff09');
                if (t == null) return;
                if (isNaN(parseFloat(t))) return;
                if (parseFloat(t) <= 0) return;
                _setSpeedUI(parseFloat(t));
            } else if ((e.key === '=' || e.key === '.') && e.ctrlKey) {
                _setSpeedUI(Math.min(MAX, currentSpeed + 2));
            } else if ((e.key === '=' || e.key === '.') && e.altKey) {
                _setSpeedUI(Math.min(MAX, currentSpeed * 2));
            } else if ((e.key === '-' || e.key === ',') && e.ctrlKey) {
                _setSpeedUI(Math.max(MIN, currentSpeed - 2));
            } else if ((e.key === '-' || e.key === ',') && e.altKey) {
                _setSpeedUI(Math.max(MIN, currentSpeed / 2));
            } else if (e.key === '0' && (e.ctrlKey || e.altKey)) {
                _setSpeedUI(1);
            } else if (e.key === '[' || e.key === '\u3010') {
                var idx = -1;
                for (var k = 0; k < PRESETS.length; k++) { if (Math.abs(PRESETS[k] - currentSpeed) < 0.01) { idx = k; break; } }
                if (idx < 0) { for (var k2 = 0; k2 < PRESETS.length; k2++) { if (PRESETS[k2] === 1) { idx = k2; break; } } }
                if (idx > 0) _setSpeedUI(PRESETS[idx - 1]);
            } else if (e.key === ']' || e.key === '\u3011') {
                var idx2 = -1;
                for (var k3 = 0; k3 < PRESETS.length; k3++) { if (Math.abs(PRESETS[k3] - currentSpeed) < 0.01) { idx2 = k3; break; } }
                if (idx2 < 0) { for (var k4 = 0; k4 < PRESETS.length; k4++) { if (PRESETS[k4] === 1) { idx2 = k4; break; } } }
                if (idx2 < PRESETS.length - 1) _setSpeedUI(PRESETS[idx2 + 1]);
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                _togglePersist();
            } else if (e.key === 'Escape') {
                _closePanel();
            }
        });
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        _mountUI();
    } else {
        document.addEventListener('readystatechange', function () {
            if ((document.readyState === 'interactive' || document.readyState === 'complete') && !window.__leokeRendered) {
                _mountUI();
            }
        });
    }
})();
