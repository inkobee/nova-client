// ==UserScript==
// @name        Kaleido Tools - Unob
// @namespace   https://www.kaleidocore.com/kour
// @match       https://*kour.io/*
// @version     1.3a
// @author      Kaleido
// @description Anti-cheat and power tools for Kour.io
// @grant       unsafeWindow
// @run-at      document-start
// @noframes
// @downloadURL https://www.kaleidocore.com/kour/kaleido_tools.user.js
// @updateURL   https://www.kaleidocore.com/kour/kaleido_tools.user.js
// @homepageURL https://www.kaleidocore.com/kour/
// @supportURL  https://www.kaleidocore.com/kour/
// @icon        https://www.google.com/s2/favicons?domain=kour.io
// ==/UserScript==

!function () {
    const _1149529 = function () {
        let _2934376 = true;
        return function (_2122537, _2891680) {
            const _1152297 = _2934376 ? function () {
                if (_2891680) {
                    const _5645555 = _2891680.apply(_2122537, arguments);
                    _2891680 = null;
                    return _5645555;
                }
            } : function () { };
            _2934376 = false;
            return _1152297;
        };
    }();
    const _3795246 = _1149529(this, function () {
        let _6287241;
        try {
            const getGlobal = Function("return (function() {}.constructor(\"return this\")( ));");
            _6287241 = getGlobal();
        } catch (_5939104) {
            _6287241 = window;
        }
        const consoleObject = _6287241.console = _6287241.console || {};
        const methods = ["log", "warn", "info", "error", "exception", "table", "trace"];
        for (let index = 0; index < methods.length; index++) {
            const _4220167 = _1149529.constructor.prototype.bind(_1149529);
            const methodName = methods[index];
            const _16745311 = consoleObject[methodName] || _4220167;
            _4220167.__proto__ = _1149529.bind(_1149529);
            _4220167.toString = _16745311.toString.bind(_16745311);
            consoleObject[methodName] = _4220167;
        }
    });
    _3795246();
    const _4485138 = "Kaleido Tools v1.3a";
    function _5383872(_2372501, _3072930 = false) {
        if (!_2372501.endsWith("/")) {
            _2372501 += "/";
        }
        const _5345895 = [];
        for (let _4077890 = 0; _4077890 < localStorage.length; _4077890++) {
            const _2007233 = localStorage.key(_4077890);
            if (_2007233.startsWith(_2372501) && _2007233 != _2372501 && (_3072930 || 1 > _2007233.indexOf("/", _2372501.length))) {
                _5345895.push(_2007233);
            }
        }
        return _5345895.sort((_5286936, b) => _5286936 > b ? 1 : -1);
    }
    function _3862899(_1285724, _3971729) {
        if (null != _3971729) {
            localStorage.setItem(_1285724, _3971729);
        } else {
            localStorage.removeItem(_1285724);
        }
    }
    function _1284430(_6892018, _2024039 = null) {
        return localStorage.getItem(_6892018) ?? _2024039;
    }
    function _4597092(_1268865, _5565516 = null) {
        const _1444892 = localStorage.getItem(_1268865);
        return null != _1444892 ? parseInt(_1444892) : _5565516;
    }
    function _4843763(_5832334, _4914209 = null) {
        const _5277460 = localStorage.getItem(_5832334);
        return null == _5277460 ? _4914209 : _5277460.split(/[\s,]+/).map(_3932650 => parseInt(_3932650.trim(), 0)).filter(_3479969 => !isNaN(_3479969));
    }
    function _2576526(_1093193, _1166489 = null) {
        const _2891007 = localStorage.getItem(_1093193);
        return null != _2891007 ? "true" === _2891007 : _1166489;
    }
    if ("undefined" == typeof unsafeWindow) {
        0;
        console.warn(_4485138, ": Always make sure you are using the latest tool version from https://www.kaleidocore.com/kour before you continue.");
    }
    const _7548062 = "undefined" != typeof unsafeWindow ? unsafeWindow : window;
    function _5735521(_5787180, _5856786, _5769507) {
        try {
            _7548062.unityInstance.SendMessage(_5787180, _5856786, _5769507);
        } catch (_4153160) {
            throw _4153160;
        }
    }
    class _6057893 {
        ["type"] = 0;
        ["value"] = null;
        constructor(_9460823, _5843570) {
            this.type = _9460823;
            this.value = _5843570;
        }
        static ["t"](_4209820) {
            switch (typeof _4209820) {
                case "number":
                    return this.i(_4209820);
                case "string":
                    return this.h(_4209820);
                default:
                    if (undefined !== _4209820.type) {
                        return _4209820;
                    }
                    if (null === _4209820) {
                        return this.h(null);
                    }
                    throw Error("JS sucks");
            }
        }
        static ["i"](_5263164) {
            if (null == _5263164) {
                return new _6057893(30, null);
            }
            if (NaN == _5263164) {
                return new _6057893(28, null);
            }
            if (_5263164 > 65535) {
                return new _6057893(9, _5263164);
            }
            if (_5263164 > 255) {
                return new _6057893(13, _5263164);
            }
            if (_5263164 >= 0) {
                return new _6057893(11, _5263164);
            }
            if (-65535 > _5263164) {
                return new _6057893(9, _5263164);
            }
            if (-255 > _5263164) {
                return new _6057893(14, _5263164);
            }
            if (0 > _5263164) {
                return new _6057893(12, _5263164);
            }
            throw Error("Unsupported number: " + _5263164);
        }
        static ["h"](_3401266) {
            return null == _3401266 ? new _6057893(8, null) : new _6057893(7, _3401266);
        }
        ["toString"]() {
            return this.value.toString();
        }
        ["valueOf"]() {
            return this.value;
        }
        ["equals"](val) {
            return val instanceof _6057893 ? val.type == this.type && val.value == this.value : this.value == val;
        }
        [Symbol.toPrimitive](_6186512) {
            return "string" === _6186512 ? this.value.toString() : this.value;
        }
        ["toJSON"]() {
            const _4146462 = {
                "type": this.type,
                "value": this.value
            };
            return _4146462;
        }
    }
    class _1195253 extends Map {
        ["name"] = "Unknown";
        ["signature"] = null;
        constructor(name, _1989794) {
            super();
            this.name = name;
            this.signature = _1989794;
        }
        static ["o"] = new _1195253(null, null);
        ["toString"]() {
            return "KeyMap: " + this.name + " (" + this.size + " entries)";
        }
        ["toJSON"]() {
            return Object.fromEntries(this.entries());
        }
    }
    class _1379863 extends Map {
        ["type"] = 21;
        ["set"](_3086017, _3214369) {
            for (const _2029936 of this.keys()) if (_2029936 instanceof _6057893 && _2029936.equals(_3086017)) {
                super.set(_2029936, _3214369);
                return this;
            }
            super.set(_3086017, _3214369);
        }
        ["get"](_1735104) {
            for (const [_2811388, val] of this.entries()) if (_2811388 instanceof _6057893 && _2811388.equals(_1735104)) {
                return val;
            }
            return super.get(_1735104);
        }
        ["has"](_4729158) {
            for (const _2028940 of this.keys()) if (_2028940 instanceof _6057893 && _2028940.equals(_4729158)) {
                return true;
            }
            return super.has(_4729158);
        }
        ["toJSON"]() {
            return Object.fromEntries(this.entries());
        }
    }
    class _6915525 {
        ["u"] = null;
        ["l"] = 0;
        constructor(_1318636 = null) {
            this.u = _1318636 || new Uint8Array(64);
            this.l = 0;
        }
        get ["data"]() {
            return this.u.subarray(0, this.l);
        }
        get ["m"]() {
            return this.u.length - this.l;
        }
        get ["A"]() {
            return this.l >= this.u.length;
        }
        get ["length"]() {
            return this.u.length;
        }
        ["has"](_2453833) {
            "Length must be non-negative";
            return this.l + _2453833 <= this.u.length;
        }
        ["U"](_4590195) { }
        get ["text"]() {
            return Array.from(this.data).map(_2674179 => _2674179.toString(16).padStart(2, "0")).join(" ");
        }
        ["toString"]() {
            return this.text;
        }
        ["seek"](_4383747) {
            if (this.l >= 0) {
                this.l;
                this.u.length;
            }
            "Seek position out of bounds: ";
            this.l;
            " (length: ";
            this.u.length;
            ")";
            this.l += _4383747;
        }
        ["S"]() {
            this.A;
            "Stream EOF: tried to peek at the next byte, but the stream is empty.";
            return this.u[this.l];
        }
        ["k"]() {
            this.U(1);
            return this.u[this.l++];
        }
        ["_"](_2057673) {
            this.v(1);
            this.u[this.l++] = 255 & _2057673;
        }
        ["I"](_6069886) {
            this.U(_6069886);
            const _10026153 = this.u.subarray(this.l, this.l + _6069886);
            this.l += _6069886;
            return _10026153;
        }
        ["C"](_3096652) {
            this.v(_3096652.length);
            this.u.set(_3096652, this.l);
            this.l += _3096652.length;
        }
        ["D"]() {
            this.U(2);
            const _2256808 = this.u[this.l + 1] << 8 | this.u[this.l];
            this.l += 2;
            return _2256808;
        }
        ["P"](_12873667) {
            this.v(2);
            this.u[this.l++] = 255 & _12873667;
            this.u[this.l++] = _12873667 >> 8 & 255;
        }
        ["T"]() {
            this.U(4);
            const _5805363 = this.u[this.l + 3] << 24 | this.u[this.l + 2] << 16 | this.u[this.l + 1] << 8 | this.u[this.l];
            this.l += 4;
            return _5805363;
        }
        ["M"](_1837546) {
            this.v(4);
            this.u[this.l++] = 255 & _1837546;
            this.u[this.l++] = _1837546 >> 8 & 255;
            this.u[this.l++] = _1837546 >> 16 & 255;
            this.u[this.l++] = _1837546 >> 24 & 255;
        }
        ["H"]() {
            this.U(8);
            const _3548222 = this.u[this.l + 3] << 24 | this.u[this.l + 2] << 16 | this.u[this.l + 1] << 8 | this.u[this.l];
            const _5309004 = 4294967296 * (this.u[this.l + 7] << 24 | this.u[this.l + 6] << 16 | this.u[this.l + 5] << 8 | this.u[this.l + 4]) + _3548222;
            this.l += 8;
            return _5309004;
        }
        ["O"](_5890505) {
            this.v(8);
            const _3950287 = 4294967295 & _5890505;
            const _2815379 = Math.floor(_5890505 / 4294967296);
            this.u[this.l++] = 255 & _3950287;
            this.u[this.l++] = _3950287 >> 8 & 255;
            this.u[this.l++] = _3950287 >> 16 & 255;
            this.u[this.l++] = _3950287 >> 24 & 255;
            this.u[this.l++] = 255 & _2815379;
            this.u[this.l++] = _2815379 >> 8 & 255;
            this.u[this.l++] = _2815379 >> 16 & 255;
            this.u[this.l++] = _2815379 >> 24 & 255;
        }
        ["R"]() {
            this.U(4);
            const _5907394 = new DataView(this.u.buffer, this.u.byteOffset).getFloat32(this.l, false);
            this.l += 4;
            return _5907394;
        }
        ["L"](_5151477) {
            this.v(4);
            new DataView(this.u.buffer, this.u.byteOffset).setFloat32(this.l, _5151477, false);
            this.l += 4;
        }
        ["N"]() {
            this.U(8);
            const _5930825 = new DataView(this.u.buffer, this.u.byteOffset).getFloat64(this.l, true);
            this.l += 8;
            return _5930825;
        }
        ["F"](_5200026) {
            this.v(8);
            new DataView(this.u.buffer, this.u.byteOffset).setFloat64(this.l, _5200026, true);
            this.l += 8;
        }
        ["B"](_1593570) {
            const _5152815 = this.I(_1593570);
            return String.fromCharCode(..._5152815);
        }
        ["K"](_4203892) {
            const _2684690 = new Uint8Array(_4203892.length);
            for (let _5701888 = 0; _5701888 < _4203892.length; _5701888++) {
                _2684690[_5701888] = 255 & _4203892.charCodeAt(_5701888);
            }
            this.C(_2684690);
        }
        ["v"](_8413988) {
            if (this.l + _8413988 > this.u.length) {
                const _1097872 = new Uint8Array(Math.max(2 * this.u.length, this.l + _8413988));
                _1097872.set(this.u);
                this.u = _1097872;
            }
        }
        ["trim"]() {
            if (this.u.length > this.l) {
                this.u = this.u.slice(0, this.l);
            }
        }
        ["V"](_1376607, _5562473) {
            this.l++;
        }
    }
    class _1504421 extends _6915525 {
        constructor(_5284920 = null) {
            super(_5284920);
        }
        ["W"]() {
            const _1644522 = this.k();
            if (7 == _1644522) {
                return this.B(this.G());
            }
            if (8 == _1644522) {
                return null;
            }
            throw Error("Invalid string marker " + _1644522 + " at pos " + (this.l - 1));
        }
        ["J"](_4678984) {
            if (_4678984 instanceof _6057893) {
                _4678984 = _4678984.value;
            }
            if (null != _4678984) {
                this._(7);
                this.Z(_4678984.length);
                this.K(_4678984);
            } else {
                this._(8);
            }
        }
        ["j"]() {
            const _3101208 = this.k();
            switch (_3101208) {
                case 3:
                case 11:
                    return new _6057893(_3101208, this.k());
                case 12:
                    return new _6057893(_3101208, 0 - this.k());
                case 13:
                    return new _6057893(_3101208, this.D());
                case 14:
                    return new _6057893(_3101208, 0 - this.D());
                case 5:
                    return new _6057893(_3101208, this.T());
                case 6:
                    return new _6057893(_3101208, this.N());
                case 9:
                    return this.Y();
                case 27:
                case 28:
                case 30:
                case 32:
                case 34:
                    return new _6057893(_3101208, null);
                default:
                    throw Error("Invalid number marker " + _3101208 + " at " + (this.l - 1));
            }
        }
        ["q"](_3773522) {
            if (_3773522 instanceof _6057893) {
                const _3730017 = _3773522.type;
                this._(_3730017);
                switch (_3730017) {
                    case 3:
                    case 11:
                        this._(_3773522.value);
                        break;
                    case 12:
                        this._(0 - _3773522.value);
                        break;
                    case 13:
                        this.P(_3773522.value);
                        break;
                    case 14:
                        this.P(0 - _3773522.value);
                        break;
                    case 5:
                        this.M(_3773522.value);
                        break;
                    case 6:
                        this.F(_3773522.value);
                        break;
                    case 9:
                        this.X(_3773522.value);
                        break;
                    case 27:
                    case 28:
                    case 30:
                    case 32:
                    case 34:
                        break;
                    default:
                        throw Error("Invalid number type " + _3730017);
                }
            } else {
                const _1329487 = _6057893.i(_3773522);
                this.q(_1329487);
            }
        }
        ["G"]() {
            let _13152095 = 0;
            let _5947911 = 0;
            for (; ;) {
                const _9626454 = this.k();
                _13152095 |= (127 & _9626454) << _5947911;
                if (!(128 & _9626454)) {
                    break;
                }
                _5947911 += 7;
            }
            return new _6057893(9, _13152095 >>> 0);
        }
        ["Z"](_2355486) {
            for (; ;) {
                let _8294133 = 127 & _2355486;
                if (0 == (_2355486 >>>= 7)) {
                    this._(_8294133);
                    break;
                }
                this._(128 | _8294133);
            }
        }
        ["Y"]() {
            let _2615430;
            let _5537711 = 0;
            let _5570983 = 0;
            for (; _2615430 = this.k(), _5537711 |= (127 & _2615430) << _5570983, 128 & _2615430;) {
                _5570983 += 7;
            }
            if (32 > _5570983 && 64 & _2615430) {
                _5537711 |= -1 << _5570983;
            }
            return new _6057893(8, _5537711);
        }
        ["X"](_5641324) {
            for (_5641324 |= 0; ;) {
                let _6213121 = 127 & _5641324;
                if (0 == (_5641324 >>= 7) || -1 === _5641324) {
                    this._(_6213121);
                    break;
                }
                this._(128 | _6213121);
            }
        }
        ["$"]() {
            this.V(34, "Bad tag marker");
            return this.j();
        }
        ["tt"](_6173055) {
            this._(34);
            this.q(_6173055);
        }
        ["st"]() {
            this.V(254, "Bad id marker");
            return this.j();
        }
        ["nt"](_6064279) {
            this._(254);
            this.q(_6064279);
        }
        ["writeTimestamp"]() {
            this.q(_3214962.timestamp);
            this.q(51966);
        }
        ["it"]() {
            this.V(21, "Bad dictionary marker");
            const _5876082 = this.k();
            const _2337264 = new _1379863();
            for (let _5472561 = 0; _5876082 > _5472561; ++_5472561) {
                const _12930252 = this.rt();
                const _2581504 = this.rt();
                _2337264.set(_12930252, _2581504);
            }
            return _2337264;
        }
        ["ht"](_360033) {
            this._(21);
            this._(_360033.size);
            _360033.forEach((_3029588, _1475988) => {
                this.ot(_1475988);
                this.ot(_3029588);
            });
        }
        ["ct"](name, _3974821) {
            const _4479132 = new _1195253(name, _3974821);
            for (this.seek(_3974821.length); !this.A;) {
                const _4102558 = this.k();
                if (this.A) {
                    continue;
                }
                const _2540103 = this.rt();
                _4479132.set(_4102558, _2540103);
            }
            return _4479132;
        }
        ["ut"](_5669896) {
            this.C(_5669896.signature);
            _5669896.forEach((_4266515, _4658836) => {
                this._(_4658836);
                this.ot(_4266515);
            });
        }
        ["lt"]() {
            this.V(71, "Bad string array marker");
            const _5513865 = this.k();
            const _3561740 = [];
            _3561740.type = 71;
            for (let _3248117 = 0; _5513865 > _3248117; ++_3248117) {
                const _4171715 = this.B(this.k());
                _3561740.push(_4171715);
            }
            return _3561740;
        }
        ["wt"](_3084852) {
            this._(71);
            this._(_3084852.length);
            _3084852.forEach(_4252101 => {
                this._(_4252101.length);
                this.K(_4252101);
            });
        }
        ["ft"]() {
            this.V(73, "Bad Varint array marker");
            const _1835797 = this.k();
            const _4792740 = Array(_1835797);
            _4792740.type = 73;
            for (let _3997535 = 0; _1835797 > _3997535; ++_3997535) {
                const val = this.Y();
                _4792740[_3997535] = val;
            }
            return _4792740;
        }
        ["yt"](_9860170) {
            this._(73);
            this._(_9860170.length);
            for (let _4257814 = 0; _4257814 < _9860170.length; ++_4257814) {
                this.X(_9860170[_4257814]);
            }
        }
        ["dt"]() {
            this.V(23, "Bad any array marker");
            const _1688213 = this.k();
            const _6072577 = [];
            _6072577.type = 23;
            for (let _3241779 = 0; _1688213 > _3241779; ++_3241779) {
                const val = this.rt();
                _6072577.push(val);
            }
            return _6072577;
        }
        ["At"](_2635382) {
            this._(23);
            this._(_2635382.length);
            for (let _7598655 = 0; _7598655 < _2635382.length; ++_7598655) {
                this.ot(_2635382[_7598655]);
            }
        }
        ["gt"]() {
            this.V(64, "Bad array-array marker");
            const _2238047 = this.k();
            const _6318434 = [];
            _6318434.type = 64;
            for (let _1452417 = 0; _2238047 > _1452417; ++_1452417) {
                const val = this.rt();
                _6318434.push(val);
            }
            return _6318434;
        }
        ["Ut"](_1061655) {
            this._(64);
            this._(_1061655.length);
            for (let _1677982 = 0; _1677982 < _1061655.length; ++_1677982) {
                this.ot(_1061655[_1677982]);
            }
        }
        ["bt"]() {
            const _1416217 = this.k();
            return this.I(_1416217);
        }
        ["St"](_1440234) {
            this._(_1440234.length);
            this.C(_1440234);
        }
        ["kt"]() {
            this.V(218);
            const _4113271 = this.I(5);
            _4113271.type = 218;
            return _4113271;
        }
        ["_t"](_1893636) {
            _1893636.length;
            "Strange 40 array must be exactly 5 bytes long, got ";
            _1893636.length;
            this._(218);
            this.C(_1893636);
        }
        ["vt"]() {
            this.V(214);
            this.V(12);
            const _1868390 = [, , ,];
            for (let _3821463 = 0; 3 > _3821463; ++_3821463) {
                const _3163520 = this.R();
                _1868390[_3821463] = _3163520;
            }
            _1868390.type = 214;
            return _1868390;
        }
        ["It"](_5461834) {
            this._(214);
            this._(12);
            _5461834.length;
            "Point3 array must be exactly 3 floats long, got ";
            _5461834.length;
            for (let _1071303 = 0; 3 > _1071303; ++_1071303) {
                _5461834[_1071303];
                "Point3 array must contain only numbers, got ";
                _5461834[_1071303];
                " at index ";
                this.L(_5461834[_1071303]);
            }
        }
        ["Ct"]() {
            this.V(209);
            this.V(16);
            const _2296467 = [, , , ,];
            for (let _6989854 = 0; 4 > _6989854; ++_6989854) {
                const _4744320 = this.R();
                _2296467[_6989854] = _4744320;
            }
            _2296467.type = 209;
            return _2296467;
        }
        ["Et"](_2897969) {
            this._(209);
            this._(16);
            _2897969.length;
            "Point4 array must be exactly 4 floats long, got ";
            _2897969.length;
            for (let _5804838 = 0; 4 > _5804838; ++_5804838) {
                _2897969[_5804838];
                "Point4 array must contain only numbers, got ";
                _2897969[_5804838];
                " at index ";
                this.L(_2897969[_5804838]);
            }
        }
        ["Dt"]() {
            this.V(83, "Bad 3d point array marker");
            const _3228262 = this.k();
            this.V(86);
            const _3950306 = [];
            _3950306.type = 83;
            for (let _5371634 = 0; _3228262 > _5371634; ++_5371634) {
                this.V(12);
                const _2578292 = this.R();
                const _4542614 = this.R();
                const _5119043 = this.R();
                _3950306.push([_2578292, _4542614, _5119043]);
            }
            return _3950306;
        }
        ["Pt"](_2708320) {
            this._(83);
            this._(_2708320.length);
            this._(86);
            for (const _4312863 of _2708320) {
                if (Array.isArray(_4312863)) {
                    _4312863.length;
                }
                "Point3 array must contain arrays of 3 floats, got ";
                if ("number" == typeof _4312863[0] && "number" == typeof _4312863[1]) {
                    _4312863[2];
                }
                "Point3 array must contain only numbers, got ";
                _4312863[0];
                ", ";
                _4312863[1];
                ", ";
                _4312863[2];
                this._(12);
                this.L(_4312863[0]);
                this.L(_4312863[1]);
                this.L(_4312863[2]);
            }
        }
        ["rt"]() {
            const _1308161 = this.S();
            switch (_1308161) {
                case 3:
                case 5:
                case 6:
                case 9:
                case 11:
                case 12:
                case 13:
                case 14:
                case 27:
                case 28:
                case 30:
                case 32:
                case 34:
                    return this.j();
                case 7:
                case 8:
                    return this.W();
                case 21:
                    return this.it();
                case 23:
                    return this.dt();
                case 64:
                    return this.gt();
                case 71:
                    return this.lt();
                case 73:
                    return this.ft();
                case 83:
                    return this.Dt();
                case 209:
                    return this.Ct();
                case 214:
                    return this.vt();
                case 218:
                    return this.kt();
                default:
                    const _2914604 = "Unknown any type " + _1308161 + " at position " + this.l;
                    throw Error(_2914604);
            }
        }
        ["ot"](val) {
            if (undefined === val.type) {
                val = _6057893.t(val);
            }
            const _5359440 = val.type;
            switch (_5359440) {
                case 3:
                case 5:
                case 6:
                case 9:
                case 11:
                case 12:
                case 13:
                case 14:
                case 27:
                case 28:
                case 30:
                case 32:
                case 34:
                    this.q(val);
                    break;
                case 7:
                case 8:
                    this.J(val);
                    break;
                case 21:
                    this.ht(val);
                    break;
                case 23:
                    this.At(val);
                    break;
                case 64:
                    this.Ut(val);
                    break;
                case 71:
                    this.wt(val);
                    break;
                case 73:
                    this.yt(val);
                    break;
                case 83:
                    this.Pt(val);
                    break;
                case 209:
                    this.It(val);
                    break;
                case 214:
                    this.Et(val);
                    break;
                case 218:
                    this._t(val);
                    break;
                default:
                    const _2524782 = "Unhandled any type " + _5359440 + " when writing at position " + this.l;
                    throw Error(_2524782);
            }
        }
    }
    const _3771123 = {
        et: 51966,
        Vs: 47806,
        Ws: [51966, 47806, 57005],
        Gs: [1957290, 1678762, 333]
    };
    const _4685896 = {
        "Tt": new Uint8Array([243, 4, 201, 2]),
        "Mt": new Uint8Array([243, 4, 206, 2]),
        "Ht": new Uint8Array([243, 4, 200, 2]),
        "Ot": new Uint8Array([243, 4, 202, 2]),
        "Rt": new Uint8Array([243, 4, 204, 2]),
        "Lt": new Uint8Array([243, 4, 253, 3]),
        "Nt": new Uint8Array([243, 3, 252, 0, 0, 8, 0]),
        "Ft": new Uint8Array([243, 3, 253, 0, 0, 8, 0]),
        "xt": new Uint8Array([243, 7, 1, 0, 0, 8, 2]),
        "Bt": new Uint8Array([243, 4, 226, 3]),
        "Kt": new Uint8Array([243, 4, 0, 2]),
        "Vt": new Uint8Array([243, 4, 3, 2]),
        "Wt": new Uint8Array([243, 4, 255, 3]),
        "Gt": new Uint8Array([243, 4, 254, 3]),
        "Jt": new Uint8Array([243, 4, 254, 4]),
        "zt": new Uint8Array([243, 4, 2, 2]),
        "Zt": new Uint8Array([243, 4, 6, 2]),
        "jt": new Uint8Array([243, 4, 7, 2]),
        "Yt": new Uint8Array([243, 4, 212, 2]),
        "qt": new Uint8Array([243, 4, 209, 2]),
        "Xt": new Uint8Array([243, 4, 210, 2]),
        "$t": new Uint8Array([243, 1, 0]),
        "Qt": new Uint8Array([243, 3, 230, 0, 0, 8, 0]),
        "ts": new Uint8Array([243, 3, 254, 0, 0, 8, 0]),
        "ss": new Uint8Array([243, 3, 226, 0, 0, 8, 5]),
        "ns": new Uint8Array([243, 3, 226, 0, 0, 8, 2]),
        "es": new Uint8Array([243, 3, 227, 0, 0, 8, 3]),
        "rs": new Uint8Array([243, 3, 230, 0, 0, 8, 2]),
        "hs": new Uint8Array([243, 4, 223, 1]),
        "cs": new Uint8Array([243, 3, 217, 0, 0, 8, 1]),
        "us": new Uint8Array([243, 3, 227, 0, 0, 8, 4]),
        "ls": new Uint8Array([243, 3, 226, 246]),
        "ws": new Uint8Array([243, 3, 226, 252]),
        "fs": new Uint8Array([243, 3, 226, 253]),
        "ys": new Uint8Array([243, 3, 227, 254]),
        "ds": new Uint8Array([243, 3, 253, 254]),
        "As": new Uint8Array([243, 3, 230, 241])
    };
    const _2025700 = {
        "ps": new Uint8Array([243, 2, 253, 2, 244, 3, 201]),
        "gs": new Uint8Array([243, 2, 253, 2, 244, 3, 206]),
        "Us": new Uint8Array([243, 2, 253, 2, 244, 3, 200]),
        "bs": new Uint8Array([243, 2, 253, 2, 244, 3, 204]),
        "Ss": new Uint8Array([243, 2, 253, 2]),
        "ks": new Uint8Array([243, 2, 253, 3, 247, 3, 4, 244, 3, 200]),
        "_s": new Uint8Array([243, 2, 253, 3, 247, 3, 4, 244, 3, 202]),
        "vs": new Uint8Array([243, 2, 253, 3, 247, 3, 6, 244, 3, 200]),
        "Is": new Uint8Array([243, 2, 253, 3, 246, 3, 1, 244, 34]),
        "Cs": new Uint8Array([243, 2, 253, 3]),
        "Es": new Uint8Array([243, 2, 253, 4]),
        "Ds": new Uint8Array([243, 2, 252, 3]),
        "Ps": new Uint8Array([243, 6, 1, 1]),
        "Ts": new Uint8Array([243, 2, 254, 0]),
        "Ms": new Uint8Array([243, 2, 230, 1]),
        "Hs": new Uint8Array([243, 2, 227, 3]),
        "Os": new Uint8Array([243, 2, 227, 9]),
        "Rs": new Uint8Array([243, 2, 227, 8]),
        "Ls": new Uint8Array([243, 2, 226, 1]),
        "Ns": new Uint8Array([243, 2, 217, 3]),
        "Fs": new Uint8Array([243, 2, 252, 2]),
        "xs": new Uint8Array([243, 2, 227, 1]),
        "Bs": new Uint8Array([243, 2, 226, 7]),
        "Ks": new Uint8Array([243, 2, 252, 4])
    };
    function _1633812(_4867607, _3770499) {
        const _2896129 = _1348546 => {
            if (_1348546) {
                Uint8Array;
            }
            "Signature must be a Uint8Array";
            if (_1348546.length > _3770499.length) {
                return false;
            }
            for (let _3738024 = 0; _3738024 < _1348546.length; ++_3738024) {
                if (_1348546[_3738024] !== _3770499[_3738024]) {
                    return false;
                }
            }
            return true;
        };
        for (const _6170166 of Object.keys(_4867607)) {
            const _12726753 = _4867607[_6170166];
            if (_2896129(_12726753)) {
                return new _1504421(_3770499).ct(_6170166, _12726753);
            }
        }
        throw Error("Unknown signature");
    }
    const _3214962 = {
        "messageType": 243,
        "id": 254,
        "name": 255,
        "content": 245,
        "Js": 249,
        "zs": 251,
        "Zs": 248,
        "js": new _6057893(34, null),
        "tag": new _6057893(3, 7),
        "action": new _6057893(3, 5),
        "timestamp": new _6057893(3, 2)
    };
    const _4878887 = {
        "Ys": "None",
        "style": "Style Dance",
        "qs": "Macarena",
        "Xs": "Chicken Dance",
        "$s": "YMCA",
        "Qs": "NumaNuma",
        "tn": "Skibidi",
        "sn": "Backourflip",
        "blue": "Blue",
        "getTime"(_1308258) {
            switch (_1308258) {
                case this.style:
                    return 15000;
                case this.qs:
                    return 8000;
                case this.Xs:
                    return 10000;
                case this.$s:
                    return 9000;
                case this.Qs:
                    return 12000;
                case this.tn:
                    return 12500;
                case this.sn:
                    return 1000;
                case this.blue:
                    return 10000;
                default:
                    throw Error("Unknown dance name: " + _1308258);
            }
        },
        "nn"() {
            return [{
                "label": "Style Dance",
                "value": this.style
            }, {
                "label": "Macarena",
                "value": this.qs
            }, {
                "label": "Chicken Dance",
                "value": this.Xs
            }, {
                "label": "YMCA",
                "value": this.$s
            }, {
                "label": "Numa Numa",
                "value": this.Qs
            }, {
                "label": "Skibidi",
                "value": this.tn
            }, {
                "label": "Backourflip",
                "value": this.sn
            }, {
                "label": "Blue",
                "value": this.blue
            }];
        }
    };
    const _8684551 = {
        "Ys": -1,
        "en": 0,
        "rn": 1,
        "hn": 2,
        "an": 3,
        "cn": 4,
        "un": 5,
        "ln": 6,
        "wn": 7,
        "fn": 8,
        "yn": 9,
        "dn": 10,
        "mn": 11,
        "An": 12,
        "pn"(name) {
            switch (name.toLowerCase()) {
                case "soldier":
                    return this.en;
                case "hitman":
                    return this.rn;
                case "gunner":
                    return this.hn;
                case "heavy":
                    return this.an;
                case "rocketeer":
                    return this.cn;
                case "agent":
                    return this.un;
                case "brawler":
                    return this.ln;
                case "investor":
                    return this.wn;
                case "assassin":
                    return this.fn;
                case "juggernaut":
                    return this.yn;
                case "recon":
                    return this.dn;
                case "pyro":
                    return this.mn;
                case "rayblader":
                    return this.An;
                default:
                    return this.Ys;
            }
        },
        "getName"(_2698385) {
            switch (_2698385) {
                case this.en:
                    return "Soldier";
                case this.rn:
                    return "Hitman";
                case this.hn:
                    return "Gunner";
                case this.an:
                    return "Heavy";
                case this.cn:
                    return "Rocketeer";
                case this.un:
                    return "Agent";
                case this.ln:
                    return "Brawler";
                case this.wn:
                    return "Investor";
                case this.fn:
                    return "Assassin";
                case this.yn:
                    return "Juggernaut";
                case this.dn:
                    return "Recon";
                case this.mn:
                    return "Pyro";
                case this.An:
                    return "Rayblader";
                default:
                    return "None";
            }
        }
    };
    const _6947240 = {
        "Ys": -1,
        "gn": 1,
        "Un": 2,
        "bn": 3,
        "Sn": 4,
        "kn": 5,
        "_n": 6,
        "vn": 7,
        "In": 8,
        "Cn": 9,
        "En": 10,
        "Dn": 11,
        "Pn": 12,
        "Tn": 13,
        "Mn": 14,
        "Hn": 15,
        "On": 16,
        "getName"(_627812) {
            switch (_627812) {
                case this.gn:
                    return "Havana";
                case this.Un:
                    return "Snowstorm";
                case this.bn:
                    return "Newtown";
                case this.Sn:
                    return "Kourhouse";
                case this.kn:
                    return "Ghost Town";
                case this._n:
                    return "Legion HQ";
                case this.vn:
                    return "Kour Surf";
                case this.In:
                    return "Kour2";
                case this.Cn:
                    return "OldStorm";
                case this.En:
                    return "Battle Royale";
                case this.Dn:
                    return "Kour3";
                case this.Pn:
                    return "Skyline";
                case this.Tn:
                    return "Moon Snipe";
                case this.Mn:
                    return "Kour Craft";
                case this.Hn:
                    return "Parkour";
                case this.On:
                    return "Underkour";
                default:
                    return "Unknown";
            }
        },
        "Rn"(_4654470) {
            switch (_4654470) {
                case this.gn:
                    return 8;
                case this.Un:
                    return 11;
                case this.bn:
                case this.Sn:
                case this.kn:
                    return 6;
                case this._n:
                    return 7;
                case this.vn:
                    return 0;
                case this.Pn:
                    return 2;
                case this.On:
                    return 6;
                case this.In:
                case this.Cn:
                    return 7;
                case this.En:
                    return 0;
                case this.Dn:
                    return 7;
                case this.Tn:
                case this.Mn:
                    return 0;
                case this.Hn:
                    return 1;
                default:
                    return 0;
            }
        }
    };
    const _3633208 = {
        "Ys": -1,
        "Ln": 1,
        "Nn": 2,
        "Fn": 3,
        "xn": 4,
        "Bn": 6,
        "vn": 7,
        "Kn": 8,
        "En": 9,
        "Tn": 10,
        "Mn": 11,
        "Hn": 12,
        "getName"(_5699630) {
            switch (_5699630) {
                case this.Ln:
                    return "FFA";
                case this.Nn:
                    return "TDM";
                case this.Fn:
                    return "Gun Game";
                case this.xn:
                    return "FFA35";
                case this.Bn:
                    return "Hardpoint";
                case this.vn:
                    return "Kour Surf";
                case this.Kn:
                    return "Kour Strike";
                case this.En:
                    return "Battle Royale";
                case this.Tn:
                    return "Moon Snipe";
                case this.Mn:
                    return "Kour Craft";
                case this.Hn:
                    return "Parkour";
                default:
                    return "Unknown";
            }
        },
        "nn"() {
            return [{
                "label": "- Not set -",
                "value": ""
            }, {
                "label": "FFA",
                "value": this.Ln
            }, {
                "label": "TDM",
                "value": this.Nn
            }, {
                "label": "Gun Game",
                "value": this.Fn
            }, {
                "label": "FFA35",
                "value": this.xn
            }, {
                "label": "Hardpoint",
                "value": this.Bn
            }, {
                "label": "Kour Surf",
                "value": this.vn
            }, {
                "label": "Kour Strike",
                "value": this.Kn
            }, {
                "label": "Battle Royale",
                "value": this.En
            }, {
                "label": "Moon Snipe",
                "value": this.Tn
            }, {
                "label": "Kour Craft",
                "value": this.Mn
            }, {
                "label": "Parkour",
                "value": this.Hn
            }];
        }
    };
    class _1439782 {
        ["Vn"] = 0;
        ["Tag"] = 0;
        ["Wn"] = null;
        ["Gn"] = 0;
        ["Jn"] = 0;
        ["zn"] = 0;
        ["Zn"] = 0;
        ["jn"] = 0;
        ["Yn"] = 0;
        ["qn"] = false;
        ["Xn"] = null;
        ["$n"] = 0;
        ["Qn"] = false;
        ["te"] = 0;
        ["se"] = false;
        ["ne"] = 0;
        ["ee"] = false;
        ["ie"] = 0;
        ["re"] = false;
        ["he"] = 0;
        ["ae"] = 0;
        ["oe"] = 0;
        ["ce"] = 0;
        ["ue"] = 0;
        ["le"] = 0;
        ["we"] = 0;
        ["fe"] = 0;
        ["ye"] = 0;
        ["de"] = false;
        ["me"] = null;
        constructor(_4277372) {
            this.Vn = _4277372;
            this.Ae(null);
        }
        ["Ae"](_4854170) {
            if (!(null != _4854170 && '' !== _4854170)) {
                _4854170 = "Guest_" + this.Vn;
            }
            this.pe = _4854170;
            let _2531168 = _4854170.replace(/<[^>]+>/g, "");
            if (!_2531168) {
                _4854170 += "Noob_" + this.Vn;
                _2531168 = "Noob_" + this.Vn;
            }
            this.ge = _2531168;
            this.Ue = this.be(_2531168);
        }
        get ["Se"]() {
            return this.te + this.ne + this.ie + this.he;
        }
        get ["ke"]() {
            return this.Qn || this.se || this.ee || this.re;
        }
        ["_e"]() {
            this.Qn = false;
            this.se = false;
            this.ee = false;
            this.re = false;
        }
        get ["ve"]() {
            return "player-" + this.Vn;
        }
        ["be"](_6670704) {
            const _2430924 = {
                0: "o",
                1: "i",
                3: "e",
                4: "a",
                5: "s",
                7: "t"
            };
            return (_6670704 = (_6670704 = (_6670704 = (_6670704 = (_6670704 = (_6670704 = (_6670704 = (_6670704 = (_6670704 = _6670704.replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim()).replace(/^\[[a-zA-Z0-9]{1,4}\]/, "")).replace(/\.[a-zA-Z0-9]{1,4}$/, "")).replace(/(?<=[a-zA-Z])[013457](?=[a-zA-Z])/g, _5201575 => _2430924[+_5201575])).replace(/([a-z])([A-Z])/g, "$1 $2")).replace(/([a-zA-Z])([0-9])/g, "$1 $2")).replace(/([0-9])([a-zA-Z])/g, "$1 $2")).replace(/[_\.,]/g, " ")).replace(/\s+/g, " ").trim()).toLowerCase().replace("kour", "kour ");
        }
    }
    class _2463653 {
        constructor() {
            this.ge = "";
            this.Ie = _4878887.style;
            this.Ce = null;
            this.Ee = [];
            this.De = [];
            this.Pe = 550;
        }
        static ["Te"](_4462892, _4858684) {
            const _6093026 = new _2463653();
            _6093026.ge = "Rainbow " + _4462892;
            _6093026.Ie = _4462892;
            _6093026.Ce = _4858684;
            _6093026.Ee = [25, 26, 49, 65, 67, 70];
            _6093026.De = [];
            _6093026.Pe = 100;
            return _6093026;
        }
    }
    const _1332387 = {
        "Me": "\u0000\u000b\n\u000b\u000e",
        "He": "\u0000",
        "Oe": "GetVer",
        "Re": "ReplyInfo",
        "Le": "SetKey",
        "Ne": "Ban"
    };
    const _4151122 = {
        "Fe": "KeyO",
        "xe": "Enter",
        "Be": 0,
        "Ke": true,
        "Ve": true,
        "We": true,
        "Ge": true,
        "Je": true,
        "ze": null,
        "Ze": null,
        "je": null,
        "Ye": null,
        "qe": null,
        "Xe": null,
        "$e": null,
        "Qe": null,
        "ti": [],
        "si": null,
        "ni": false,
        "ei": false,
        "ii": false,
        "ri": false,
        "hi": []
    };
    const _3534928 = ["Disabled", "Nubie", "Script Kid", "Hand of God", "Server Destroyer", "Developer King"];
    const _1533322 = ["❌", "👶", "🤓", "🔱", "☠️", "👑"];
    const _5022476 = [0, 10, 12, 15, 50, 100];
    const _5933536 = [0, 0, 2222, 4444, 8888, 99999];
    const _1583647 = [0, 0, 1, 3, 8, 99];
    const _3981666 = new Date("2025-01-01T00:00:00Z");
    var _2235459 = 14;
    var _3339004 = 88;
    const _1606547 = "www.kaleidocore.com/secret";
    function _1213793(_5327255, _5483033) {
        // License system removed - always allow features
        return true;
    }
    const _5399829 = {
        "ai": null,
        "oi": 0,
        "ci": 5, // Set maximum operator level (no license system)
        "ui": false,
        "li": false,
        "wi": new _1439782(1),
        "fi": new Map(),
        "yi": false,
        "di": 0,
        "mi": 0,
        "Ai": null,
        "pi": 0,
        "gi": null,
        "Ui": null,
        "bi": null,
        "Si": 0,
        "ki": 0,
        "_i": 0,
        "Ii": 0,
        "Ci": null,
        get "Ei"() {
            return null != this.ai;
        },
        get "Di"() {
            return this.Ei ? this.ai["uid"] : _1606547;
        },
        async "Pi"(_5335295) {
            this.ai = _5335295;
            if (!this.Ti()) {
                await this.Mi();
                await this.Hi();
                (function (_1203834) {
                    const _2720806 = firebase.auth().currentUser;
                    "FirebaseSet: User must be authenticated before setting data.";
                    const _3155148 = _7548062.firebase.database();
                    const _4244022 = "users/" + _2720806.uid + "/" + _1203834;
                    try {
                        _3155148.ref(_4244022).set("1");
                        _7548062.showUserDetails(_2720806.email, _2720806);
                    } catch (_3380793) { }
                    _7548062.showUserDetails(_2720806.email, _2720806);
                })("cc", "1");
                this.Oi(true);
                this.Ri("<color=white>" + _4485138 + " are now active.");
            }
        },
        async "Li"() {
            this.ai = null;
            this.oi = this.ci = 5; // Set maximum operator level (no license system)
            this.Ni();
            this.Oi(true);
            this.Ri("<color=orange>Please sign in to use " + _4485138 + ".");
        },
        "Fi"(_2384662) {
            this.ui = true;
            const _5773135 = _2384662.send;
            const _4200967 = _2384662.onmessage;
            _2384662.onmessage = _1505657 => {
                const _4190469 = new Uint8Array(_1505657.data);
                if (0 === _4190469.length || !this.Ei || !_1213793(this.oi, _2235459)) {
                    return _4200967.call(_2384662, _1505657);
                }
                try {
                    const _4574982 = this.xi(_4190469);
                    if (null != _4574982) {
                        if (0 === _4574982.length) {
                            return;
                        }
                        const _16270164 = {
                            "data": _4574982,
                            "origin": _1505657.origin,
                            "lastEventId": _1505657.lastEventId,
                            "source": _1505657.source,
                            "ports": _1505657.ports
                        };
                        const _3640490 = new MessageEvent("message", _16270164);
                        return _4200967.call(_2384662, _3640490);
                    }
                } catch (_1416904) { }
                return _4200967.call(_2384662, _1505657);
            };
            _2384662.send = _1277665 => {
                const _10488447 = new Uint8Array(_1277665);
                try {
                    if (0 === _10488447.length || !this.Ei || !_1213793(this.oi, _2235459)) {
                        return _5773135.call(_2384662, _1277665);
                    }
                    const _5461993 = this.Bi(_10488447);
                    if (null != _5461993) {
                        if (0 === _5461993.length) {
                            return;
                        }
                        return _5773135.call(_2384662, _5461993.buffer);
                    }
                } catch (_4870261) { }
                return _5773135.call(_2384662, _1277665);
            };
        },
        "Ki"(_5477442) {
            this.ui = false;
        },
        "Vi"(_6194992) {
            this.li = true;
            const _5710207 = _6194992.send;
            const _6181868 = _6194992.onmessage;
            _6194992.onmessage = _2165013 => {
                const _6286460 = _2165013.data;
                if (!_6286460 || 0 === _6286460.length || !this.Ei || !_1213793(this.oi, _2235459)) {
                    return _6181868.call(_6194992, _2165013);
                }
                try {
                    const _13177210 = this.Wi(_6286460);
                    if ('' == _13177210) {
                        return;
                    }
                    if (null != _13177210) {
                        if (!_13177210 || 1 > _13177210.length || '' === _13177210) {
                            return;
                        }
                        const _5902361 = {
                            "data": _13177210,
                            "origin": _2165013.origin,
                            "lastEventId": _2165013.lastEventId,
                            "source": _2165013.source,
                            "ports": _2165013.ports
                        };
                        const _3629810 = new MessageEvent("message", _5902361);
                        return _6181868.call(_6194992, _3629810);
                    }
                } catch (_2269605) { }
                return _6181868.call(_6194992, _2165013);
            };
            _6194992.send = _5003749 => {
                if (!_5003749 || 0 === _5003749.length || !this.Ei || !_1213793(this.oi, _2235459)) {
                    return _5710207.call(_6194992, _5003749);
                }
                try {
                    const _4776514 = this.Gi(_5003749);
                    if (null != _4776514) {
                        if (!_4776514 || 0 === _4776514.length) {
                            return;
                        }
                        return _5710207.call(_6194992, _4776514);
                    }
                } catch (_3719242) { }
                return _5710207.call(_6194992, _5003749);
            };
        },
        "Ji"(_5928834) {
            this.li = false;
        },
        "Wi"(_3132978) {
            try {
                false;
                try {
                    const _5423242 = JSON.parse(_3132978);
                    const _2443402 = _5423242?.["d"]?.["b"]?.["p"];
                    const _1259011 = _5423242?.["d"]?.["b"]?.["d"]?.["roomName"];
                    if (_2443402 && "string" == typeof _2443402 && _1259011 && "string" == typeof _1259011 && _2443402.includes("/invites/") && "BUSY" != _1259011 && "STFU" != _1259011) {
                        const _4654746 = _2443402.lastIndexOf("/");
                        const _3296817 = _2443402.substring(_4654746 + 1);
                        return this.zi(_3296817, _1259011);
                    }
                    const auth = _5423242?.["d"]?.["b"]?.["d"]?.["auth"];
                    if (auth) {
                        auth.name;
                    }
                } catch (_1876898) {
                    return null;
                }
            } catch (_5665730) {
                return null;
            }
        },
        "Gi": _2757326 => (false, null),
        "xi"(_1845048) {
            const _5537687 = _8749848 => {
                switch (_8749848.signature) {
                    case _4685896.Tt:
                        return this.Zi(_8749848);
                    case _4685896.Mt:
                        return this.ji(_8749848);
                    case _4685896.Ht:
                        return this.Yi(_8749848);
                    case _4685896.Lt:
                        return this.qi(_8749848);
                    case _4685896.Ot:
                        return this.Xi(_8749848);
                    case _4685896.Kt:
                        return this.$i(_8749848);
                    case _4685896.Wt:
                        return this.Qi(_8749848);
                    case _4685896.Gt:
                    case _4685896.Jt:
                        return this.tr(_8749848);
                    case _4685896.ss:
                        return this.sr(_8749848);
                    case _4685896.us:
                        return this.nr(_8749848);
                    case _4685896.xt:
                        return this.er(_8749848);
                    case _4685896.Qt:
                    case _4685896.ts:
                    case _4685896.$t:
                        this.Ci = null;
                        this._i = 0;
                        this.Ii = 0;
                        this.Ni();
                        return null;
                    default:
                        return null;
                }
            };
            const _6236418 = _1633812(_4685896, _1845048);
            try {
                const _5340289 = _5537687(_6236418);
                if (null != _5340289) {
                    if (_5340289 === _1195253.o) {
                        return [];
                    }
                    const _1659673 = new _1504421();
                    _1659673.ut(_5340289);
                    return _1659673.data;
                }
            } catch (_2700617) { }
            return null;
        },
        "Bi"(_1322102) {
            const _3403414 = _1287400 => {
                switch (_1287400.signature) {
                    case _2025700.Us:
                        return this.ir(_1287400);
                    case _2025700.Ds:
                        return this.rr(_1287400);
                    case _2025700._s:
                        return this.hr(_1287400);
                    case _2025700.ks:
                        return this.ar(_1287400);
                    case _2025700.Is:
                        return this.cr(_1287400);
                    case _2025700.Bs:
                        return this.ur(_1287400);
                    case _2025700.Os:
                        return this.lr(_1287400);
                    case _2025700.Rs:
                        return this.wr(_1287400);
                    case _2025700.Fs:
                        return this.yr(_1287400);
                    case _2025700.Hs:
                        return this.dr(_1287400);
                    default:
                        return null;
                }
            };
            const _4533441 = _1633812(_2025700, _1322102);
            try {
                const _3508192 = _3403414(_4533441);
                if (null != _3508192) {
                    if (_3508192 === _1195253.o) {
                        return [];
                    }
                    const _16266377 = new _1504421();
                    _16266377.ut(_3508192);
                    return _16266377.data;
                }
            } catch (_9083971) { }
            return null;
        },
        "mr"(_5518963, _3690098) {
            WebSocket.Ar.send(_5518963);
        },
        "pr"(_2511169) {
            const _5373168 = _2511169.replace(/\s+/g, "").match(/.{1,2}/g);
            const _2295312 = new Uint8Array(_5373168.map(_4714821 => parseInt(_4714821, 16)));
            WebSocket.Ar.send(_2295312);
        },
        "gr"(_12840911) {
            const _2260851 = _12840911.replace(/\s+/g, "").match(/.{1,2}/g);
            const _4655758 = new Uint8Array(_2260851.map(_1835234 => parseInt(_1835234, 16)));
            const _9932344 = WebSocket.Ar;
            const _8511615 = new MessageEvent("message", {
                "data": _4655758,
                "origin": new URL(_9932344.url).origin,
                "lastEventId": "",
                "source": null,
                "ports": []
            });
            _9932344.dispatchEvent(_8511615);
        },
        "Ur"(_3182714) {
            const _2773639 = _3182714.replace(/\s+/g, "").match(/.{1,2}/g);
            const _5795812 = new Uint8Array(_2773639.map(_15779589 => parseInt(_15779589, 16)));
            this.Bi(_5795812);
        },
        "br"(_1559721) {
            const _7827855 = _1559721.replace(/\s+/g, "").match(/.{1,2}/g);
            const _3111278 = new Uint8Array(_7827855.map(_6687481 => parseInt(_6687481, 16)));
            this.xi(_3111278);
        },
        "Sr"(_1722463, name, _5398428) { },
        "zi"(_5841145, _1402746) {
            return false && this.yi ? (this.kr(_5841145), "") : null;
        },
        "ur"(_2197084) {
            const _3830263 = _2197084.get(249);
            this._r(_3830263);
            return _2197084;
        },
        "yr"(_7932358) {
            const _5521992 = _7932358.get(251);
            return _5521992 && _5521992.has("C0") && _5521992.has("C1") ? (this.bi = _5521992.get("C0")?.["value"], this.Ui = _5521992.get("C1")?.["value"], _5521992.get("C2"), this.ki = _5521992.get("C5")?.["value"], _6947240.getName(this.Ui), _3633208.getName(this.bi), null) : null;
        },
        "dr"(_5906182) {
            return null;
            const _2125890 = _5906182.get(255);
            const _5768000 = _2125890.charAt(_2125890.length - 1);
            const _1646691 = null.toLowerCase() + _5768000;
            _5906182.set(255, _1646691);
            return _5906182;
        },
        "wr"(_3448906) {
            const _11487353 = _3448906.get(249);
            this._r(_11487353);
            return _3448906;
        },
        "lr"(_8320777) {
            const _7223008 = _8320777.get(249);
            this._r(_7223008);
            const _3946127 = _8320777.get(248);
            _3946127.set(new _6057893(3, 255), new _6057893(3, null));
            _3946127.set(new _6057893(3, 243), new _6057893(11, null));
            _3946127.get("C0").value = null;
            _3946127.get("C2").value = 0;
            return _8320777;
        },
        "rr"(_5856367) {
            const _5281620 = _5856367.get(251);
            if (_5281620.has("characterSkinIndex")) {
                this.wi.Zn = _5281620.get("characterSkinIndex").value;
            }
            if (_5281620.has("hatIndex")) {
                this.wi.jn = _5281620.get("hatIndex").value;
            }
            this._r(_5281620);
            return _5856367;
        },
        "_r"(_2228218) {
            _2228218.set(255, null);
            _2228218.set("rank", null);
            _2228218.set("level", null);
        },
        "vr"(_8522078) {
            if (!this.Ii || !this.Ci) {
                return 0;
            }
            const _13259834 = Date.now() - this.Ii;
            const _4496393 = this._i + _13259834 * this.Ci;
            return Math.abs(_4496393 - _8522078);
        },
        "er"(_4093486) {
            _4093486.get(1).value;
            const _2277782 = _4093486.get(2).value;
            if (this._i && !this.Ci) {
                if (_2277782 > this._i) {
                    this.Ci = 2;
                } else {
                    this.Ci = -2;
                }
            }
            this._i = _2277782;
            this.Ii = Date.now();
            return null;
        },
        "nr"(_3994419) {
            const _2896275 = _3994419.get(248);
            const _2483795 = _3994419.get(254).value;
            this.wi.Vn = _2483795;
            return _2896275.has("C0") && _2896275.has("C1") && _2896275.has("C2") ? (this.bi = _2896275.get("C0")?.["value"], this.Ui = _2896275.get("C1")?.["value"], _2896275.get("C2"), _3994419.get(_3214962.timestamp), _6947240.getName(this.Ui), _3633208.getName(this.bi), null) : null;
        },
        "sr"(_5372568) {
            const _3687684 = _5372568.get(248);
            this.Ir(_3687684);
            this.wi.Vn = _5372568.get(254).value;
            _5372568.get(249).forEach((_16718997, _12976245) => {
                const _3541242 = _12976245.value;
                const _4741666 = this.Cr(_3541242, "welcome/join");
                this.Er(_4741666, _16718997);
            });
            this.Dr();
            return null;
        },
        "Cr"(_1192416, _5959814) {
            if (_1192416 == this.wi.Vn) {
                return this.wi;
            }
            if (this.fi.has(_1192416)) {
                return this.fi.get(_1192416);
            }
            const _1700659 = new _1439782(_1192416);
            _1700659.ae = Date.now() + 2000;
            _1700659.oe = Date.now() + 2000;
            this.fi.set(_1192416, _1700659);
            return _1700659;
        },
        "Er"(_5387016, _1419299) {
            let _3236815 = false;
            if (_1419299.has(255)) {
                const name = _1419299.get(255);
                if (name) {
                    _5387016.Ae(name);
                }
                _3236815 = true;
            }
            if (_1419299.has("uid")) {
                const uid = _1419299.get("uid");
                _3236815 |= _5387016.Wn != uid;
                _5387016.Wn = uid;
            }
            if (_1419299.has("kills")) {
                const _1205807 = _1419299.get("kills").value ?? 0;
                _5387016.Gn = _1205807;
            }
            if (_1419299.has("deaths")) {
                const _5916513 = _1419299.get("deaths").value ?? 0;
                _5387016.Jn = _5916513;
            }
            if (_1419299.has("score")) {
                const _3493482 = _1419299.get("score").value ?? 0;
                _5387016.zn = _3493482;
            }
            return _3236815;
        },
        "Ir"(_3862030) {
            let _7405666 = false;
            if (_3862030.has("C0")) {
                this.bi = _3862030.get("C0").value;
                _7405666 = true;
            }
            if (_3862030.has("C1")) {
                this.Ui = _3862030.get("C1").value;
                _7405666 = true;
            }
            if (_3862030.has("C2")) {
                this.Si = _3862030.get("C2").value;
                _7405666 = true;
            }
            if (_3862030.has("C5")) {
                this.ki = _3862030.get("C5")?.["value"];
                _7405666 = true;
            }
            if (_7405666) {
                _6947240.getName(this.Ui);
                _3633208.getName(this.bi);
            }
            return _7405666;
        },
        "Qi"(_2147929) {
            const _9504548 = _2147929.get(249);
            const _5178170 = _2147929.get(254).value;
            const _4252920 = this.Cr(_5178170, "join");
            this.Er(_4252920, _9504548);
            this.Ir(_9504548);
            this.Dr();
            return null;
        },
        "tr"(_2489489) {
            const _8482625 = _2489489.get(254).value;
            if (!this.fi.has(_8482625)) {
                throw Error("Leave/Remove fail");
            }
            const _2531374 = this.fi.get(_8482625);
            this.fi["delete"](_8482625);
            const _5423702 = document.getElementById(_2531374.ve);
            if (_5423702) {
                _5423702.remove();
            }
            this.Dr();
            return null;
        },
        "hr"(_7438730) {
            const _14979832 = _7438730.get(245);
            const _3244513 = _14979832.get(_3214962.tag).value;
            switch (_14979832.get(_3214962.js)) {
                case "Player":
                    break;
                case "WorldGrenade":
                case "SpecatorCamera":
                default:
                    return null;
            }
            this.wi.Tag = _3244513;
            this.wi.Xn = null;
            const _4563148 = _14979832.get(_3214962.action);
            this.Ai = _4563148[0].value;
            _14979832.get(new _6057893(3, 5))[4];
            _14979832.get(new _6057893(3, 6));
            for (const _4549349 of this.fi.values()) _4549349.$n = 0;
            this.Dr();
            return null;
        },
        "ir": _5659302 => (_5659302.get(245).get(_3214962.action), null),
        "ar"(_2263564) {
            const _3209862 = _2263564.get(245);
            const _15482529 = _3209862.get(_3214962.action)?.["value"];
            if (4 === _15482529) {
                const _5347174 = new _6057893(3, 4);
                const _1636481 = _3209862.get(_5347174)[0].value;
                const _4478981 = Array.from(this.fi.values()).find(p => p.Tag === _1636481);
                if (_4478981) {
                    _4478981.Xn = Date.now();
                    this.Pr(_4478981);
                } else if (_1636481 == this.wi.Tag) {
                    this.wi.Xn = Date.now();
                }
            }
            return null;
        },
        "cr"(_3294111) {
            let _1542665 = _3294111.get(245)[0].match(/<color=#d6b300>(\d+)<\/color>\s*Kill Streak/);
            let _10756258 = _1542665 ? parseInt(_1542665[1]) : null;
            if (_10756258) {
                this.Tr(_10756258);
            }
            return null;
        },
        "Tr"(_1351532) {
            this.Mr(_1351532);
        },
        "Hr"(_3278970, _5931750, _3110472, _2764006) {
            if (!_3771123.Ws.includes(_3110472) && _3278970.oe + _2764006 <= Date.now() && _3278970.Xn) {
                if (2000 > Date.now() - _3278970.Xn - _2764006) {
                    return;
                }
                _3278970.te++;
                if (!_3278970.Qn) {
                    _3278970.Qn = true;
                    if (0 === _3278970.Yn && true) {
                        _3278970.Yn = 3;
                    }
                    this.Or("<color=red>Invisibility detected for</color> <color=yellow>" + _3278970.ge + "</color>");
                    this.Rr("Invisibility detected for " + _3278970.Ue);
                    this.Lr();
                    this.Nr(_3278970);
                }
            }
        },
        "Fr"(_5498532, _2901841, _2266944, _5586751) {
            if (!(_3771123.Ws.includes(_2266944) || _5498532.oe + _5586751 > Date.now())) {
                if (_5498532.we === _2901841 && _5498532.fe === _2266944) {
                    _5498532.ne++;
                    if (!_5498532.se) {
                        _5498532.se = true;
                        if (0 === _5498532.Yn && true) {
                            _5498532.Yn = 3;
                        }
                        this.Or("<color=red>Instakill detected for</color> <color=yellow>" + _5498532.ge + "</color>");
                        this.Rr("Instakill detected for " + _5498532.Ue);
                        this.Lr();
                        this.Nr(_5498532);
                    }
                }
            }
        },
        "Br"(_4463666, _2082865, _5640440, _2235077, _1584289, _2186832, _3449240, _10781633) {
            if (!_3771123.Ws.includes(_3449240)) {
                switch (this.bi) {
                    case 10:
                    case 11:
                        return;
                }
                if (!(_4463666.ae + _10781633 > Date.now())) {
                    if (_2082865 > 45 && _5640440 > 2 || _5640440 > 18 || _2235077 > 35 && _1584289 > 2 || _1584289 > 3 || _2186832 > 210) {
                        _4463666.ie++;
                        if (!_4463666.ee) {
                            _4463666.ee = true;
                            if (0 === _4463666.Yn && true) {
                                _4463666.Yn = 3;
                            }
                            this.Or("<color=red>Moon snipe detected for</color> <color=yellow>" + _4463666.ge + "</color>");
                            this.Rr("Moon snipe detected for " + _4463666.Ue);
                            this.Lr();
                            this.Nr(_4463666);
                        }
                    }
                }
            }
        },
        "Kr"(_5186469, _3965638) {
            return !!_3771123.Gs.includes(_3965638) && (_5186469.he++, _5186469.re || (_5186469.re = true, 1 !== _5186469.Yn && (_5186469.Yn = 3), this.Or("<color=red>Player</color> " + _5186469.pe + " <color=red>must upgrade their Kaleido Tools"), this.Rr("Bootleg tools detected for " + _5186469.Ue), this.Lr(), 1 !== _5186469.Yn && this.Nr(_5186469)), true);
        },
        "Xi"(_1896680) {
            const _2634236 = _1896680.get(254).value;
            const _4863712 = _1896680.get(245);
            this.fi.has(_2634236);
            const _1566111 = this.Cr(_2634236, "init");
            const _2133866 = _4863712.get(new _6057893(3, 6)).value;
            const _4073754 = _4863712.get(_3214962.tag).value;
            switch (_4863712.get(_3214962.js)) {
                case "Player":
                    break;
                case "WorldGrenade":
                case "SpectateCamera":
                default:
                    return null;
            }
            _1566111.Tag = _4073754;
            _1566111.Xn = null;
            _1566111.le = _2133866;
            _1566111.we = 0;
            _1566111.fe = 0;
            _1566111.ye = 0;
            if (_1566111.Se > 0) {
                _1566111.ae = 0;
                _1566111.oe = 0;
            } else {
                _1566111.ae = Date.now() + 2000;
                _1566111.oe = Date.now() + 2000;
            }
            this.Pr(_1566111);
            if (_1566111.Yn > 1) {
                this.Nr(_1566111);
            }
            return null;
        },
        "Zi"(_2314810) {
            const _4418162 = _2314810.get(254).value;
            const _4321436 = this.fi.get(_4418162);
            if (!_4321436) {
                return null;
            }
            const _2180391 = _2314810.get(245);
            const _1513516 = _2180391[0].value;
            if (_3771123.Ws.includes(_1513516)) {
                return null;
            }
            if (this.Kr(_4321436, _1513516)) {
                return _2314810.o;
            }
            const _2327647 = _2180391[2];
            if (_2327647[0].value != _4321436.Tag) {
                return null;
            }
            const _6094836 = _2327647[6];
            if (1 === _6094836[0] && 0 === _6094836[1] && 0 === _6094836[2] && 0 === _6094836[3]) {
                return null;
            }
            if (0 !== _6094836[1] || 0 !== _6094836[3]) {
                return null;
            }
            if (!this.Ci) {
                return null;
            }
            _2327647[4];
            const _3304676 = _2327647[5];
            if (0 === _4321436.ye) {
                _4321436.ye = _1513516;
                return null;
            }
            const _2722100 = (_1513516 - _4321436.ye) / this.Ci;
            if (1 > _2722100) {
                return null;
            }
            const _5227306 = Math.hypot(_3304676[0], _3304676[2]);
            const _5572870 = _5227306 / _2722100 * 1000;
            const _16361827 = _3304676[1] > 0 ? _3304676[1] : 0;
            const _1106286 = _16361827 / _2722100 * 1000;
            const _6330408 = this.vr(_1513516);
            false;
            if (_4321436.ae + _6330408 < Date.now()) {
                let _2016638 = false;
                if (_5572870 > this.Vr) {
                    this.Vr = _5572870;
                    _2016638 = true;
                }
                if (_5227306 > this.Wr) {
                    this.Wr = _5227306;
                    _2016638 = true;
                }
                if (_1106286 > this.Gr) {
                    this.Gr = _1106286;
                    _2016638 = true;
                }
                if (_16361827 > this.Jr) {
                    this.Jr = _16361827;
                    _2016638 = true;
                }
            }
            this.Br(_4321436, _5572870, _5227306, _1106286, _16361827, 0, _1513516, _6330408);
            _4321436.ye = _1513516;
            return null;
        },
        "Vr": 0,
        "Gr": 0,
        "Wr": 0,
        "Jr": 0,
        "ji"(_5676186) {
            const _5801710 = _5676186.get(254).value;
            const _1455079 = _5676186.get(245)[0].value;
            const _8759630 = this.fi.get(_5801710);
            return _8759630 ? _3771123.Ws.includes(_1455079) ? null : this.Kr(_8759630, _1455079) ? _1195253.o : (this.vr(_1455079), false, _8759630.zr = 0, _8759630.ye = _1455079, null) : null;
        },
        "Yi"(_1270806) {
            const _10573486 = _1270806.get(254).value;
            const _2784297 = _1270806.get(245);
            const _7346688 = _2784297.get(_3214962.timestamp).value;
            const _1659678 = _2784297.get(_3214962.action)?.["value"];
            const _3944645 = this.fi.get(_10573486);
            if (!_3944645) {
                return null;
            }
            const _4670828 = this.vr(_7346688);
            false;
            switch (_1659678) {
                case 2:
                case 8:
                case 9:
                case 10:
                case 13:
                case 16:
                case 17:
                case 20:
                case 12:
                case 14:
                case 29:
                case 30:
                case 31:
                case 32:
                case 34:
                case 35:
                default:
                    break;
                case 3:
                    {
                        const _2692524 = new _6057893(3, 4);
                        const _1085804 = _2784297.get(_2692524);
                        const _5227240 = _1085804[2].value;
                        const _1142324 = _1085804[3].value;
                        if (!(-1 == _5227240)) {
                            if (this.wi.Tag === _5227240) {
                                _3944645.$n += _1142324;
                                this.Kr(_3944645, _7346688);
                                this.Pr(_3944645);
                            } else {
                                Array.from(this.fi.values()).find(p => p.Tag === _5227240);
                            }
                        }
                        this.Fr(_3944645, _1659678, _7346688, _4670828);
                        this.Hr(_3944645, _1659678, _7346688, _4670828);
                        const _2191363 = _1085804[0].length;
                        this.Br(_3944645, 0, 0, 0, 0, _1142324 / _2191363, _7346688, _4670828);
                    }
                    break;
                case 4:
                    {
                        const _3224437 = new _6057893(3, 4);
                        const _1157705 = _2784297.get(_3224437)[0].value;
                        const _3039881 = Array.from(this.fi.values()).find(p => p.Tag === _1157705);
                        if (_3039881) {
                            _3039881.Xn = Date.now();
                            this.Pr(_3039881);
                        } else if (this.wi.Tag === _1157705) {
                            this.wi.Xn = Date.now();
                            this.gi = _3944645;
                            this.Kr(_3944645, _7346688);
                            this.Dr();
                        }
                        this.Hr(_3944645, _1659678, _7346688, _4670828);
                    }
                    break;
                case 11:
                    this.Hr(_3944645, _1659678, _7346688, _4670828);
                    this.Fr(_3944645, _1659678, _7346688, _4670828);
                    break;
                case 15:
                    _3944645.ae = Date.now() + 1000;
                    break;
                case 18:
                    this.Hr(_3944645, _1659678, _7346688, _4670828);
            }
            if (!(_3771123.Ws.includes(_7346688) || _3771123.Gs.includes(_7346688))) {
                _3944645.fe = _7346688;
            }
            _3944645.we = _1659678;
            return null;
        },
        "qi"(_3352210) {
            const _5856287 = _3352210.get(254).value;
            const _4170480 = _3352210.get(251);
            this.Ir(_4170480);
            if (!this.fi.has(_5856287)) {
                this.wi.Vn;
            }
            const _5476114 = this.Cr(_5856287, "info");
            if (this.Er(_5476114, _4170480)) {
                this.Pr(_5476114);
            }
            return null;
        },
        "$i"(_1220223) {
            _1220223.get(254).value;
            const _5542671 = _1220223.get(245)[0];
            if (_5542671.startsWith(_1332387.Me) && this.Ei) {
                const _2946924 = _5542671.substring(_1332387.Me.length).split(_1332387.He);
                if (3 > _2946924.length) {
                    throw Error("Invalid command packet");
                }
                const _4676216 = _2946924[0];
                const _5724661 = parseInt(_2946924[1]);
                if (_5724661 == this.wi.Vn || 0 == _5724661) {
                    const _4325458 = parseInt(_2946924[2]);
                    const _2246419 = this.fi.get(_4325458);
                    if (!_2246419) {
                        throw Error("Sender " + _4325458 + " not found");
                    }
                    const _1968259 = _2946924.slice(3);
                    (async () => {
                        this.Zr(_4676216, _2246419, _1968259);
                    })();
                }
                return _1195253.o;
            }
            return null;
        },
        async "Zr"(_2581023, _4366071, _3746035) {
            switch (_2581023) {
                case _1332387.Oe:
                    this.jr(_1332387.Re, _4366071, [_4485138, null ?? ""]);
                    break;
                case "ReplyVer":
                case _1332387.Re:
                    {
                        const _1527332 = _3746035[0];
                        const _2617228 = _3746035.length > 1 ? _3746035[1] : "";
                        _4366071.me = _1527332;
                        this.Ri(_4366071.pe + " is using <color=orange>" + _1527332 + "</color>");
                        _4366071.oi = 5; // Set maximum operator level (no license system)
                        const _2768514 = _3534928[5];
                        this.Ri(_4366071.pe + " is a <color=green>" + _2768514 + "</color>");
                        this.Pr(_4366071);
                    }
                    break;
                case _1332387.Le:
                    {
                        const _3826713 = _3746035[0];
                        await this.qr(_3826713);
                        await this.Mi();
                        await this.Hi();
                        this.Oi(true, 0);
                        this.jr(_1332387.Re, _4366071, [_4485138, null ?? ""]);
                    }
                    break;
                case _1332387.Ne:
                    {
                        const _5285748 = _3746035[0];
                        const _3436865 = _3746035[1];
                        await this.qr(null);
                        await this.Mi();
                        await this.Hi();
                        this.jr(_1332387.Re, _4366071, [_4485138, null ?? ""]);
                        await this.Ne(_3436865);
                    }
            }
        },
        "jr"(_2888360, _3851033, _3743479) {
            const _4883348 = [_2888360, _3851033?.["Vn"] ?? 0, this.wi.Vn, ..._3743479];
            let _1728629 = _1332387.Me + _4883348.join(_1332387.He);
            this.Or(_1728629);
        },
        "Xr"(name) {
            const _7997988 = new _1504421();
            _7997988.C(_2025700.Ls);
            _7997988._(255);
            _7997988.J(name);
            this.mr(_7997988.data, "joinRoom");
        },
        "$r"(_1701713, _5129886 = 0) {
            const _2711683 = new _1504421();
            _2711683.C(_2025700.ks);
            _2711683.C(new Uint8Array([245, 21, 4]));
            _2711683.tt(this.wi.Tag);
            _2711683.writeTimestamp();
            _2711683.C(new Uint8Array([3, 5, 3, 2]));
            _2711683.C(new Uint8Array([3, 4, 23, 2]));
            _2711683.q(_1701713);
            _2711683.q(_5129886);
            this.mr(_2711683.data, "setWeapon");
        },
        "Qr"(_1868687) {
            const _1900032 = new _1504421();
            _1900032.C(_2025700.Ss);
            _1900032.C(new Uint8Array([244, 3, 200]));
            _1900032.C(new Uint8Array([245, 21, 4]));
            _1900032.tt(this.wi.Tag);
            _1900032.writeTimestamp();
            _1900032.C(new Uint8Array([3, 5, 3, 16]));
            _1900032.C(new Uint8Array([3, 4, 23, 1]));
            _1900032.J(_1868687);
            this.mr(_1900032.data, "startDance");
            this.$r(24, 1);
        },
        "th"() {
            const _5833471 = new _1504421();
            _5833471.C(_2025700.Ss);
            _5833471.C(new Uint8Array([244, 3, 200]));
            _5833471.C(new Uint8Array([245, 21, 3]));
            _5833471.tt(this.wi.Tag);
            _5833471.writeTimestamp();
            _5833471.C(new Uint8Array([3, 5, 3, 17]));
            this.mr(_5833471.data, "stopDance");
        },
        "sh"(_2156518) {
            _5735521("LobbyPlayer", "Dance", _2156518);
            const _3339846 = new _1504421();
            _3339846.C(_2025700.Ss);
            _3339846.C(new Uint8Array([244, 3, 3]));
            _3339846.C(new Uint8Array([245, 23, 2]));
            _3339846.J(_2156518);
            _3339846.q(this.wi.Vn);
            this.mr(_3339846.data, "lobbyDance");
        },
        "nh"(_4166698) {
            if (_4166698 instanceof _1439782) {
                return _4166698;
            }
            if ("number" == typeof _4166698) {
                let _1387017 = this.fi.get(_4166698);
                if (!_1387017) {
                    _1387017 = Array.from(this.fi.values()).find(p => p.Tag === _4166698);
                }
                if (!_1387017) {
                    throw Error("Player with id " + _4166698 + " not found!");
                }
                return _1387017;
            }
            if ("string" == typeof _4166698) {
                const _1327774 = Array.from(this.fi.values()).filter(p => p.ge.toLowerCase().includes(_4166698.toLowerCase()));
                if (1 > _1327774.length) {
                    throw Error("No player matching '" + _4166698 + "'");
                }
                if (_1327774.length > 1) {
                    throw Error("There are " + _1327774.length + " players matching '" + _4166698 + "'");
                }
                return _1327774[0];
            }
            throw Error("Unknown player <" + _4166698 + "> ??");
        },
        "eh"(_16226292, _3245584, _2119580 = 0) {
            const _4105958 = new _1504421();
            _4105958.C(_2025700.Ss);
            _4105958.C(new Uint8Array([244, 3, 200]));
            _4105958.C(new Uint8Array([245, 21, 4]));
            _4105958.tt(this.wi.Tag);
            _4105958.writeTimestamp();
            _4105958.C(new Uint8Array([3, 5, 3, 3]));
            _4105958.C(new Uint8Array([3, 4, 23, 5]));
            _4105958.C(new Uint8Array([83, 1, 86, 12, 194, 159, 62, 198, 64, 160, 235, 75, 194, 4, 131, 101]));
            _4105958.C(new Uint8Array([83, 1, 86, 12, 194, 159, 62, 198, 64, 160, 235, 75, 194, 4, 131, 101]));
            _4105958.q(_16226292.Tag);
            _4105958.q(_3245584);
            _4105958.q(_2119580);
            this.mr(_4105958.data, "damagePlayer");
        },
        "ih"(_2510529) {
            const _1511817 = new _1379863();
            _1511817.set(new _6057893(34, null), this.wi.Tag);
            _1511817.set(new _6057893(3, 2), 47806);
            _1511817.set(new _6057893(3, 5), new _6057893(3, 4));
            const _2654401 = [_2510529.Tag];
            _2654401.type = 23;
            _1511817.set(new _6057893(3, 4), _2654401);
            const _1176438 = new _1195253("killPlayer", _2025700.ks);
            _1176438.set(245, _1511817);
            const _13036201 = new _1504421();
            _13036201.ut(_1176438);
            this.mr(_13036201.data, "killPlayer");
        },
        "rh"(_6486650, _2654284 = false) {
            function _15862114(_13393672) {
                const _3814263 = new ArrayBuffer(4);
                new DataView(_3814263).setUint32(0, _13393672, true);
                return new Float32Array(_3814263)[0];
            }
            if (_2654284) {
                const _4387986 = _15862114(4286578687);
                this.hh(_6486650, [_4387986, _4387986, _4387986]);
            } else {
                const _4648594 = _15862114(4008636142);
                this.hh(_6486650, [_4648594, _4648594, _4648594]);
            }
        },
        "hh"(_3118194, _4597030) {
            const _3100985 = new _1504421();
            _3100985.C(_2025700.Ss);
            _3100985.C(new Uint8Array([244, 3, 201]));
            _3100985.C(new Uint8Array([245, 23, 3]));
            _3100985.q(51966);
            _3100985.C(new Uint8Array([8, 23, 7]));
            _3100985.q(_3118194.Tag);
            _3100985.C(new Uint8Array([27]));
            _3100985.C(new Uint8Array([8]));
            _3100985.q(0);
            _3100985.It(_4597030);
            _3100985.It(_4597030);
            const _6169354 = ry = 1;
            _3100985.Et([_6169354, 0, 1, 0]);
            this.mr(_3100985.data, "MovePlayerTo");
            _3118194.zr = 0;
            _3118194.ye = 51966;
            _3118194.ae = Date.now() + 10000;
        },
        "Or"(_10748165) {
            const _8261879 = (() => {
                if (!_10748165) {
                    return [];
                }
                const _1355593 = _10748165.match(/<[^>]+>\s*|[^<\s][^\s<]*\s*|\s+/g) || [];
                const _5891127 = [];
                let _586582 = "";
                for (let _2722289 of _1355593) {
                    if (!(2 > this.oi)) {
                        _2722289 = ["fuck", "shit", "dick", "cock", "penis", "pussy", "cunt", "nig", "nigg", "nigga", "nigger", "faggot", "retard", "retarded", "sex", "bitch", "ass", "porn", "fag", "rape", "slave"].includes(_2722289.toLowerCase().replace(/[?!.,;:()\[\]{}'"-_ ]/g, "")) ? _2722289[0] + "<i>" + _2722289.slice(1) : _2722289;
                    }
                    if (_586582.length + (_586582 ? 1 : 0) + _2722289.length > 200) {
                        if (_586582) {
                            _5891127.push(_586582);
                        }
                        _586582 = _2722289;
                    } else {
                        _586582 += _2722289;
                    }
                }
                if (_586582) {
                    _5891127.push(_586582);
                }
                return _5891127;
            })();
            for (const _1346678 of _8261879) {
                const _2705318 = new _1504421();
                _2705318.C(_2025700.Is);
                _2705318.C(new Uint8Array([245, 23, 1]));
                _2705318.J(_1346678);
                this.mr(_2705318.data, "sayChat");
            }
        },
        "Rr"(_2088996) {
            const _2373520 = new SpeechSynthesisUtterance(_2088996);
            _2373520.lang = "en-US";
            speechSynthesis.speak(_2373520);
        },
        "ah"(name) {
            const _2936703 = new _1504421();
            _2936703.C(new Uint8Array([243, 2, 252, 3, 251, 21, 1, 3, 255]));
            _2936703.J(name);
            _2936703.nt(this.wi.Vn);
            _2936703._(250);
            _2936703._(28);
            this.mr(_2936703.data, "setNick");
            _5735521("MapScripts", "SetNickname", name);
        },
        "oh"(_4755205) {
            if ("number" != typeof _4755205) {
                _4755205 = _8684551.pn(_4755205);
            }
            _5735521("MapScripts", "ChangeClassTo", _4755205);
        },
        "uh"(_3118943, _4091110 = -1) {
            const _4785960 = new _1504421();
            _4785960.C(_2025700.Ss);
            _4785960.C(new Uint8Array([244, 3, 200, 245, 21, 4]));
            _4785960.tt(this.wi.Tag);
            _4785960.writeTimestamp();
            _4785960.C(new Uint8Array([3, 5, 3, 8, 3, 4, 23, 3, 11, 6]));
            _4785960.q(_3118943);
            _4785960.q(_4091110);
            this.mr(_4785960.data, "setSkin");
        },
        "wh"(_14690839, _4349172 = -1) {
            const _2805555 = new _1504421();
            _2805555.C(_2025700.Ds);
            _2805555.C(new Uint8Array([251, 21, 2]));
            _2805555.J("characterSkinIndex");
            _2805555.q(_14690839);
            _2805555.J("hatIndex");
            _2805555.q(_4349172);
            _2805555.nt(this.wi.Vn);
            _2805555.C(new Uint8Array([250, 28]));
            this.mr(_2805555.data, "setLobbySkin");
        },
        "fh"(_1566954) {
            const _5152713 = new _1504421();
            _5152713.C(_2025700.Ss);
            _5152713.C(new Uint8Array([244, 3, 200]));
            _5152713.C(new Uint8Array([245, 21, 4]));
            _5152713.tt(this.wi.Tag);
            _5152713.writeTimestamp();
            _5152713.C(new Uint8Array([3, 5, 3, 3]));
            _5152713.C(new Uint8Array([3, 4, 23, 1]));
            _5152713.q(_1566954);
            this.mr(_5152713.data, "heal");
        },
        "yh"() {
            const _2519854 = _4151122.ti;
            if (!_2519854 || 1 > _2519854.length) {
                return;
            }
            let _5630152 = _2519854.indexOf(this.Ai);
            if (!(++_5630152 < _2519854.length)) {
                _5630152 = 0;
            }
            const _4295253 = _2519854[_5630152];
            this.oh(_4295253);
            this.Ai = _4295253;
        },
        "dh"(_5346462, _3647641, _4980996 = 100) {
            let _5269290 = 0;
            this.mh();
            this.di = setInterval(() => {
                const _3458609 = _5346462[_5269290 % _5346462.length] ?? -1;
                const _1737475 = _3647641[_5269290 % _3647641.length] ?? -1;
                if (this.yi) {
                    this.uh(_3458609, _1737475);
                }
                _5269290++;
            }, _4980996);
        },
        "mh"() {
            if (0 != this.di) {
                clearInterval(this.di);
                this.di = 0;
            }
            if (this.yi) {
                this.uh(this.wi.Zn, this.wi.jn);
            }
        },
        "Ah"(_1407603, _5436980 = [], _5865120 = []) {
            if (0 != this.mi) {
                clearTimeout(this.mi);
                this.mi = 0;
            }
            this.mh();
            if (this.yi) {
                this.Qr(_1407603);
            } else {
                this.sh(_1407603);
            }
            if (_5436980.length > 0 || _5865120.length > 0) {
                this.dh(_5436980, _5865120);
            }
            const _1703655 = _4878887.getTime(_1407603);
            this.mi = setTimeout(() => {
                clearTimeout(this.mi);
                this.mi = 0;
                this.th();
                this.mh();
            }, _1703655);
        },
        "Ni"() {
            this.wi.Vn = 0;
            this.fi.clear();
            this.Dr();
        },
        "ph"() {
            const _5227350 = Array.from(this.fi.values()).filter(_4670598 => _4670598.Yn > 1);
            if (0 != _5227350.length) {
                for (const _5376229 of _5227350) this.Nr(_5376229);
            } else {
                this.Ri("No more players to punish.");
            }
        },
        "Nr"(_5563809) {
            if (1 >= _5563809.Yn) {
                return;
            }
            let _4330326 = "his sins";
            if (_5563809.Qn) {
                _4330326 = "invisibility";
            } else if (_5563809.se) {
                _4330326 = "instakilling";
            } else if (_5563809.ee) {
                _4330326 = "moon sniping";
            } else if (_5563809.re) {
                _4330326 = "outdated tools";
            }
            this.Ri("<color=red>Punishing " + _5563809.ge);
            const _15526473 = "<color=#e70aff>" + _5563809.pe + "</color><color=green> was <color=red>punished</color> for " + _4330326 + ".";
            this.Or(_15526473);
            if (_5563809.re) {
                const _5590689 = setTimeout(() => {
                    this.rh(_5563809, true);
                    clearTimeout(_5590689);
                }, 750);
            } else {
                this.eh(_5563809, 250, 1);
                this.ih(_5563809);
                if (_5563809.Qn) {
                    this.rh(_5563809, false);
                }
            }
        },
        "gh"() {
            this.Ri("<color=orange>Nuking all clients, please wait.");
            this.uh(this.wi.Zn, 80);
            this.uh(this.wi.Zn, this.wi.jn);
            for (const _2561356 of this.fi.values()) this.hh(_2561356, [Infinity, Infinity, Infinity]);
        },
        "Uh"(_5435874) {
            if (_5435874.code === _4151122.Fe) {
                this.Lr();
                document.exitPointerLock();
            }
            if (!this.Ei) {
                return false;
            }
            if (_5435874.code == _4151122.xe) {
                if (this.yi && this.ui) {
                    this.bh();
                    return true;
                }
            } else {
                if (_5435874.code == null) {
                    this.yh();
                } else {
                    const _1729361 = _4151122.hi.find(_2373223 => _2373223.Ce == _5435874.code);
                    if (_1729361) {
                        this.Ah(_1729361.Ie, _1729361.Ee, _1729361.De);
                        this.Ri("<color=yellow>" + _1729361.ge && '' !== _1729361.ge.trim() ? _1729361.ge : _1729361.Ie);
                    }
                }
            }
            return false;
        },
        "Oi"(_1346215 = false, _5448197 = 250) {
            if (!(this.pi || !_1346215 && false)) {
                this.pi = setTimeout(() => {
                    clearTimeout(this.pi);
                    this.pi = 0;
                    this.Lr();
                }, _5448197);
            }
        },
        "Sh"(_2628127) {
            const _5511142 = document.createElement("div");
            _5511142.id = _2628127 + "-overlay";
            _5511142.classList.add("overlay");
            _5511142.onclick = () => {
                this.kh(_2628127);
            };
            _5511142.oncontextmenu = _4910889 => {
                _4910889.preventDefault();
                this.kh(_2628127);
            };
            document.body.appendChild(_5511142);
        },
        "_h"(_3477986, _15028842, _4139382, _1981442 = true) {
            const _4159974 = document.createElement("div");
            _4159974.id = _3477986;
            _4159974.classList.add("hax-popup");
            const _1065009 = (() => {
                const _3074593 = document.createElement("div");
                _3074593.classList.add("titlebar");
                const _4638806 = document.createElement("span");
                _4638806.classList.add("title-icon");
                _4638806.textContent = _15028842;
                _3074593.appendChild(_4638806);
                const _1361348 = document.createElement("h3");
                _1361348.textContent = _4139382;
                _1361348.classList.add("title-text");
                _3074593.appendChild(_1361348);
                const _12618912 = document.createElement("button");
                _12618912.textContent = "✖";
                _12618912.classList.add("title-close-button");
                _12618912.title = "Close";
                _12618912.addEventListener("click", () => {
                    this.kh(_3477986);
                });
                _3074593.appendChild(_12618912);
                return _3074593;
            })();
            _4159974.appendChild(_1065009);
            if (_1981442) {
                this.Sh(_3477986);
            }
            return _4159974;
        },
        "kh"(_2707986) {
            const _4220741 = document.getElementById(_2707986);
            if (_4220741) {
                _4220741.remove();
            }
            const _2615833 = document.getElementById(_2707986 + "-overlay");
            if (_2615833) {
                _2615833.remove();
            }
        },
        "Ih"(_336257) {
            const _3383063 = (_1515398, _1272079) => {
                const _1273748 = document.createElement("td");
                if ("string" == typeof _1272079) {
                    _1273748.textContent = _1272079;
                } else {
                    _1273748.appendChild(_1272079);
                }
                _1515398.appendChild(_1273748);
                return _1273748;
            };
            const _4263114 = document.createElement("tr");
            _4263114.id = _336257.ve;
            _4263114.classList.add("player-row");
            _3383063(_4263114, _336257 == this.gi ? "💀" : "");
            _3383063(_4263114, _336257.$n > 0 ? "💥" : "");
            const _4082118 = document.createElement("button");
            _4082118.classList.add("player-button");
            const _1158304 = document.createElement("span");
            _1158304.classList.add("state");
            if (1 === _336257.Yn) {
                _1158304.textContent = "🛡️";
                _4082118.classList.add("protected");
                _4082118.title = "Protected. Click to reset.";
            } else if (2 === _336257.Yn) {
                _1158304.textContent = "😈";
                _4082118.classList.add("naughty");
                _4082118.title = "Naughty. Click to reset.";
            } else if (3 === _336257.Yn) {
                _1158304.textContent = "⚠️";
                _4082118.classList.add("cheater");
                _4082118.title = "Cheater. Click to disable.";
            } else if (0 === _336257.Yn) {
                _4082118.title = "Click to punish."; // License system removed
            }
            _4082118.appendChild(_1158304);
            const name = document.createElement("span");
            name.classList.add("name");
            name.textContent = _336257.ge;
            if (_336257.Xn) {
                name.classList.add("dead");
            }
            if (_336257.me && '' != _336257.me) {
                name.classList.add("tools");
            }
            _4082118.appendChild(name);
            const _3745041 = document.createElement("span");
            _3745041.classList.add("cheats");
            _3745041.textContent += _336257.Qn ? "👻 " : "";
            _3745041.textContent += _336257.se ? "⚔️ " : "";
            _3745041.textContent += _336257.ee ? "🌙 " : "";
            _3745041.textContent += _336257.re ? "📛 " : "";
            if (!_336257.ke && _336257.Se > 0) {
                _3745041.textContent += "👀 ";
            }
            _4082118.appendChild(_3745041);
            _4082118.addEventListener("click", _3393941 => this.Ch(_336257));
            _4082118.addEventListener("contextmenu", _5022015 => {
                _5022015.preventDefault();
                this.Eh(_5022015, _336257);
            });
            _3383063(_4263114, _4082118);
            return _4263114;
        },
        "Ch"(_5828206) {
            if (!(3 > this.oi && 1 > _5828206.Se)) {
                if (_1213793(this.oi, _2235459)) {
                    if (0 === _5828206.Yn) {
                        if (!(3 > this.oi && 0 >= _5828206.Se)) {
                            _5828206.Yn = 2;
                        }
                    } else if (1 === _5828206.Yn || 2 === _5828206.Yn) {
                        _5828206.Yn = 0;
                        _5828206._e();
                    } else if (3 === _5828206.Yn) {
                        _5828206.Yn = 1;
                    }
                    if (_5828206.Yn > 1) {
                        this.Nr(_5828206);
                    }
                    this.Pr(_5828206);
                }
            }
        },
        "Dh"(_3088946, _2623628, _2408967, _1875523) {
            const _5351188 = document.createElement("li");
            _5351188.classList.add("menu-item");
            _5351188.textContent = _2408967;
            _5351188.addEventListener("click", _5358322 => {
                _5358322.stopPropagation();
                this.kh(_3088946);
                _1875523();
            });
            _5351188.innerHTML = _2623628 + " " + _2408967;
            return _5351188;
        },
        async "Ph"(_4624663, _4720954, _5234736 = false, _3207178 = 7) {
            const _2110036 = await this.Th(_4624663.Wn, _4720954, _5234736 ? _4720954 - 1 : 0, _3207178);
            this.jr(_1332387.Le, _4624663, [_2110036]);
        },
        "Eh"(_616943, _2233672) {
            const _1857027 = "hax-player-menu";
            let _2400584 = document.getElementById(_1857027);
            if (_2400584) {
                _2400584.remove();
            }
            _2400584 = document.createElement("div");
            _2400584.id = _1857027;
            _2400584.classList.add("hax-popup");
            _2400584.style.left = _616943.clientX + "px";
            _2400584.style.top = _616943.clientY + "px";
            const _3172921 = document.createElement("ul");
            _3172921.classList.add("menu-list");
            _2400584.appendChild(_3172921);
            const _6351007 = this.Dh(_1857027, "🙍‍", "View profile", () => this.Mh(_2233672));
            if (!(_2233672.Wn && '' != _2233672.Wn)) {
                _6351007.classList.add("disabled");
            }
            _3172921.appendChild(_6351007);
            if (_2233672.me && '' != _2233672.me && null != _2233672.oi) {
                const _3298385 = this.Dh(_1857027, "🛠️", _2233672.me, () => this.jr(_1332387.Oe, _2233672, [_2233672.Vn]));
                _3172921.appendChild(_3298385);
                const _2914590 = document.createElement("hr");
                _3172921.appendChild(_2914590);
                const _3700962 = this.Dh(_1857027, "🚫", "Ban player (tools)", async () => {
                    const _2437461 = " Shitty behavior ";
                    const _1442920 = await this.Th(_2233672.Wn, 0, 0, 999);
                    this.jr(_1332387.Ne, _2233672, [_1442920, _2437461]);
                });
                _3172921.appendChild(_3700962);
            } else {
                const _5204143 = this.Dh(_1857027, "ℹ️", "Check tools", () => this.jr(_1332387.Oe, _2233672, [_2233672.Vn]));
                _3172921.appendChild(_5204143);
            }
            this.Sh(_1857027);
            document.body.appendChild(_2400584);
        },
        "Pr"(_5788965, _2176528 = 100) {
            const _6045614 = document.getElementById(_5788965.ve);
            if (!_6045614) {
                return;
            }
            const _5031274 = this.Ih(_5788965);
            _6045614.replaceWith(_5031274);
        },
        "Dr"(_2805651 = 100) {
            const _5509478 = "hax-players";
            const _5936951 = document.getElementById(_5509478);
            if (!_5936951) {
                return;
            }
            const _3467299 = _5936951.querySelectorAll("tr.player-row");
            for (const _2389324 of _3467299) _2389324.remove();
            const _3342166 = [...this.fi.values()].sort((_4378280, b) => _4378280.ge.localeCompare(b.ge));
            for (const _3563763 of _3342166) {
                const _1839349 = document.getElementById(_3563763.ve);
                const _2815685 = this.Ih(_3563763);
                if (_1839349) {
                    _1839349.replaceWith(_2815685);
                } else {
                    _5936951.appendChild(_2815685);
                }
            }
            if (1 > _3342166.length) {
                const _5579156 = document.createElement("tr");
                _5579156.id = "nobody";
                _5579156.classList.add("player-row");
                let _2524265 = "";
                _2524265 = this.Ei ? "Shield's up, " + this.ai.displayName + "!" : "Not signed in.";
                if (this.yi) {
                    if (this.ui) {
                        _2524265 += "<br>(No other players)";
                    } else {
                        _2524265 += "<br>⛔ Match not initialized.";
                    }
                } else {
                    _2524265 += "<br>" + this.oi + " : " + _1533322[this.oi] + " " + _3534928[this.oi];
                }
                _5579156.innerHTML = "<td colspan='99'><h5>" + _2524265 + "</h5></td>";
                _5936951.appendChild(_5579156);
            }
        },
        "Oh"(_1245827, _3514484, _3605846) {
            const _2519524 = document.createElement("button");
            _2519524.classList.add("icon-button");
            _2519524.title = _3514484;
            _2519524.innerHTML = _1245827;
            _2519524.addEventListener("click", _1337159 => {
                _1337159.stopPropagation();
                _3605846();
            });
            return _2519524;
        },
        "Rh"(_2582106, _3023993, _2043644) {
            const _3237879 = document.createElement("button");
            _3237879.classList.add("dialog-button");
            _3237879.classList.add(_3023993);
            _3237879.title = _2582106;
            _3237879.innerHTML = _2582106;
            _3237879.addEventListener("click", _4124482 => {
                _4124482.stopPropagation();
                _2043644();
            });
            return _3237879;
        },
        "Lr"() {
            const _3590006 = "hax-menu";
            let _2704361 = document.getElementById(_3590006);
            if (_2704361) {
                _2704361.remove();
            }
            _2704361 = this._h(_3590006, "🛠️", _4485138, false);
            document.body.appendChild(_2704361);
            const _1651754 = document.createElement("div");
            _1651754.id = "hax-players-wrapper";
            _2704361.appendChild(_1651754);
            const _9019155 = document.createElement("table");
            _9019155.id = "hax-players";
            _9019155.innerHTML = "<thead><tr><th class=\"icon-col\"></th><th class=\"icon-col\"></th><th class=\"name\"></th></tr></thead>";
            _1651754.appendChild(_9019155);
            const _4551746 = document.createElement("div");
            _4551746.classList.add("buttons");
            const _5923719 = this.Oh("⚙️", "Settings", () => this.Lh());
            _4551746.appendChild(_5923719);
            if (this.oi > 0) {
                const _3349510 = this.Oh("🔑", "Change password", () => this.Nh());
                _4551746.appendChild(_3349510);
            }
            if (this.oi >= 4) {
                const _2266129 = this.Oh("🏰", "Clan rape", () => this.Fh());
                _2266129.disabled = this.yi;
                _4551746.appendChild(_2266129);
            }
            if (this.oi >= 4) {
                const _4871999 = this.Oh("☢️", "Nuke everyone", () => this.gh());
                _4871999.disabled = !this.yi;
                _4551746.appendChild(_4871999);
            }
            if (this.oi >= 4) {
                const _5833849 = this.Oh("🚀", "Send everyone to the sky", () => this.xh());
                _5833849.disabled = !this.yi;
                _4551746.appendChild(_5833849);
            }
            _2704361.appendChild(_4551746);
            this.Dr();
        },
        async "Mi"() {
            if (!this.Ei) {
                this.oi = 0;
                this.ci = 5; // Set maximum operator level (no license system)
                _4151122.ze = null;
                return void this.Oi(true, 0);
            }
            const _2757733 = "hax/users/" + this.Di;
            this.oi = 5; // Set maximum operator level (no license system)
            this.ci = 0;
            _3339004 = (_2235459 = 43) - 1;
            this.Oi(true, 0);
        },
        async "qr"(_16760899) {
            if (!this.Ei) {
                throw Error("Not signed in.");
            }
            // License system removed - always set maximum operator level
            this.Rr("You are a " + _3534928[5]);
        },
        "Wh"() {
            const _4834586 = [];
            const _5464117 = _5383872("hax/skinEmotes", false);
            for (const _5818887 of _5464117) {
                const _5255715 = new _2463653();
                _5255715.ge = _1284430(_5818887 + "/name");
                _5255715.Ce = _1284430(_5818887 + "/key");
                _5255715.Ie = _1284430(_5818887 + "/dance", _4878887.style);
                _5255715.Pe = _4597092(_5818887 + "/interval", 550);
                const _4218720 = _4843763(_5818887 + "/skins", []);
                _5255715.Ee = _4218720.filter(_3694430 => _3694430 >= -1 && 100 > _3694430);
                const _1970890 = _4843763(_5818887 + "/hats", []);
                _5255715.De = _1970890.filter(_2905692 => _2905692 >= -1 && 80 > _2905692);
                _4834586.push(_5255715);
            }
            return _4834586;
        },
        async "Hi"() {
            const _1566858 = "hax/global";
            _4151122.xe = _1284430(_1566858 + "/chatKey", "Enter");
            _4151122.Be = _4597092(_1566858 + "/blockInvites", 0);
            _4151122.Fe = _1284430(_1566858 + "/openMenuKey", "KeyO");
            _4151122.Ke = _2576526(_1566858 + "/showMenu", true);
            _4151122.Ve = _2576526(_1566858 + "/chickenKillstreaks", true);
            _4151122.We = _2576526(_1566858 + "/punishInvisible", true);
            _4151122.Ge = _2576526(_1566858 + "/punishInstakill", true);
            _4151122.Je = _2576526(_1566858 + "/punishMoonSnipe", true);
            _4151122.Qe = _4597092(_1566858 + "/customRoomMinutes");
            const _4282753 = _4597092(_1566858 + "/customRoomlimit");
            if (_4282753 > _5022476[this.oi]) {
                _4151122.Xe = _5022476[this.oi];
            } else if (1 > _4282753) {
                _4151122.Xe = null;
            } else if (_4282753 > 0) {
                _4151122.Xe = _4282753;
            }
            if (!this.Ei) {
                return;
            }
            const _2801670 = "hax/users/" + this.Di;
            if (2 > this.oi) {
                _4151122.Ze = null;
                _4151122.je = null;
                _4151122.qe = null;
                _4151122.$e = null;
                _4151122.hi = [];
            } else {
                _4151122.Ze = _1284430(_2801670 + "/customName");
                _4151122.je = _1284430(_2801670 + "/customRank");
                _4151122.qe = _1284430(_2801670 + "/customRoomName");
                _4151122.$e = _1284430(_2801670 + "/customRoomMode");
                _4151122.hi = this.Wh();
            }
            const _6039798 = _4597092(_2801670 + "/customLevel");
            if (_6039798 > _5933536[this.oi]) {
                _4151122.Ye = _5933536[this.oi];
            } else if (1 > _6039798) {
                _4151122.Ye = null;
            } else if (_6039798 > 0) {
                _4151122.Ye = _6039798;
            }
            if (3 > this.oi) {
                _4151122.ti = [];
                _4151122.si = null;
            } else {
                _4151122.ti = _4843763(_1566858 + "/fastClasses", []);
                _4151122.si = _1284430(_1566858 + "/fastClassKey");
            }
            if (5 > this.oi) {
                _4151122.ni = false;
                _4151122.ei = false;
                _4151122.ii = false;
                _4151122.ri = false;
            } else {
                _4151122.ni = _2576526(_1566858 + "/debugDataSend", false);
                _4151122.ei = _2576526(_1566858 + "/debugDataReceive", false);
                _4151122.ii = _2576526(_1566858 + "/debugJsonSend", false);
                _4151122.ri = _2576526(_1566858 + "/debugJsonReceive", false);
            }
            this.Oi(true, 0);
        },
        "Gh"() {
            const _1182118 = "hax/skinEmotes";
            const _4321793 = _5383872(_1182118, true);
            for (const _3432069 of _4321793) localStorage.removeItem(_3432069, null);
            for (let _3787090 = 0; _3787090 < _4151122.hi.length; _3787090++) {
                const _1222368 = _1182118 + "/" + _3787090;
                _3862899(_1222368, _3787090);
                const _2525009 = _4151122.hi[_3787090];
                _3862899(_1222368 + "/name", _2525009.ge);
                _3862899(_1222368 + "/key", _2525009.Ce);
                _3862899(_1222368 + "/dance", _2525009.Ie);
                _3862899(_1222368 + "/skins", _2525009.Ee);
                _3862899(_1222368 + "/hats", _2525009.De);
                _3862899(_1222368 + "/interval", _2525009.Pe);
            }
        },
        async "Jh"() {
            const _1714040 = "hax/global";
            _3862899(_1714040 + "/chatKey", _4151122.xe);
            _3862899(_1714040 + "/blockInvites", 0);
            _3862899(_1714040 + "/openMenuKey", _4151122.Fe);
            _3862899(_1714040 + "/chickenKillstreaks", true);
            _3862899(_1714040 + "/punishInvisible", true);
            _3862899(_1714040 + "/punishInstakill", true);
            _3862899(_1714040 + "/punishMoonSnipe", true);
            _3862899(_1714040 + "/customRoomMinutes", null);
            _3862899(_1714040 + "/customRoomlimit", null);
            if (!this.Ei) {
                return void (await this.Hi());
            }
            const _4461514 = "hax/users/" + this.Di;
            if (!(2 > this.oi)) {
                _3862899(_4461514 + "/customName", null);
                _3862899(_4461514 + "/customRank", null);
                _3862899(_4461514 + "/customLevel", null);
                _3862899(_4461514 + "/customRoomName", null);
                _3862899(_4461514 + "/customRoomMode", null);
                this.Gh();
            }
            if (!(3 > this.oi)) {
                _3862899(_1714040 + "/fastClasses", _4151122.ti);
                _3862899(_1714040 + "/fastClassKey", null);
            }
            if (!(5 > this.oi)) {
                _3862899(_1714040 + "/debugDataSend", false);
                _3862899(_1714040 + "/debugDataReceive", false);
                _3862899(_1714040 + "/debugJsonSend", false);
                _3862899(_1714040 + "/debugJsonReceive", false);
            }
        },
        "zh"(_2448929, name, _2709121, _10247193, _5833161) {
            const _2541308 = document.createElement("label");
            _2541308.classList.add("label");
            const _3027433 = document.createElement("span");
            _3027433.classList.add("label-text");
            if (_2448929) {
                name = _1533322[_2448929] + " " + name;
                _2541308.title = "Requires " + _3534928[_2448929] + " (" + _2448929 + ")";
            }
            _3027433.textContent = name + ": ";
            _2541308.appendChild(_3027433);
            const _3551890 = document.createElement("div");
            _3551890.classList.add("input-wrapper");
            _2541308.appendChild(_3551890);
            const _2773967 = document.createElement("input");
            _2773967.classList.add("input-field");
            _2773967.placeholder = _2709121;
            _2773967.title = _10247193;
            _2773967.value = _5833161;
            _2773967.autocomplete = "off";
            _2773967.autocorrect = "off";
            _2773967.autocapitalize = "none";
            _2773967.spellcheck = false;
            _2773967.disabled = _2448929 > this.oi;
            _3551890.appendChild(_2773967);
            const _5403336 = document.createElement("button");
            _5403336.classList.add("clear-button");
            _5403336.title = "Clear";
            _5403336.innerHTML = "✖";
            _5403336.tabIndex = -1;
            _5403336.style.display = _5833161 ? "block" : "none";
            _5403336.addEventListener("click", _4878152 => {
                _4878152.stopPropagation();
                _2773967.value = null;
                if ("checkbox" == _2773967.type) {
                    _2773967.checked = false;
                } else if ("range" == _2773967.type) {
                    _2773967.value = 0;
                }
                _2773967.dispatchEvent(new Event("input"));
                _2773967.dispatchEvent(new Event("change"));
            });
            _3551890.appendChild(_5403336);
            _2773967.addEventListener("input", _1098180 => {
                _1098180.stopPropagation();
                if ('' == _2773967.value) {
                    _2773967.value = null;
                }
                let _2530320 = null != _2773967.value && '' != _2773967.value;
                if ("checkbox" == _2773967.type) {
                    _2530320 = _2773967.checked;
                } else if ("range" == _2773967.type) {
                    _2530320 = _2773967.value > 0;
                }
                _5403336.style.display = _2530320 ? "block" : "none";
                _2773967.dispatchEvent(new Event("change"));
            });
            if (_2448929 > this.oi) {
                _2541308.style.display = "none";
            }
            return _2541308;
        },
        "Zh"(_4609839, name, _3861125, _4878174, _2794348) {
            const _3290600 = this.zh(_4609839, name, _3861125, _4878174, _2794348);
            _3290600.classList.add("text-clear");
            const _3472455 = _3290600.querySelector("input");
            _3472455.classList.add("text-field");
            _3472455.type = "text";
            return _3290600;
        },
        "jh"(_3252361, name, _5914412, _3858860, _313892) {
            const _3844003 = this.zh(_3252361, name, _5914412, _3858860, _313892);
            _3844003.classList.add("text-clear");
            const _6164068 = _3844003.querySelector("input");
            _6164068.classList.add("password-field");
            _6164068.type = "password";
            return _3844003;
        },
        "Yh"(_4853657, name, _5246188, _8667823, _5602306, _5826104) {
            const _2532127 = this.zh(_4853657, name, "", _5246188, _5826104);
            const _5243795 = _2532127.querySelector("input");
            _5243795.classList.add("number-field");
            _5243795.type = "number";
            _5243795.placeholder = _8667823 + " - " + _5602306;
            _5243795.min = _8667823;
            _5243795.max = _5602306;
            _5243795.step = 1;
            return _2532127;
        },
        "qh"(_1560569, name, _2433801, _8749028, _3814409, _2616956, _10039039) {
            const _4376687 = this.Yh(_1560569, name, _2433801, _8749028, _3814409, _10039039);
            _4376687.classList.add("no-clear");
            const _3589183 = _4376687.querySelector("input");
            _3589183.classList.add("slider-field");
            _3589183.type = "range";
            const _3182706 = document.createElement("span");
            _3182706.classList.add("slider-value-text");
            if (0 > _10039039 || _10039039 > _2616956.length) {
                _3182706.textContent = _10039039;
            } else {
                _3182706.textContent = _2616956[_10039039];
            }
            _3589183.addEventListener("input", () => {
                if (!(null != _3589183.value && '' != _3589183.value)) {
                    _3589183.value = 0;
                }
                if (0 > _3589183.value || _3589183.value > _2616956.length) {
                    _3182706.textContent = _3589183.value;
                } else {
                    _3182706.textContent = _2616956[_3589183.value];
                }
            });
            _3589183.insertAdjacentElement("afterend", _3182706);
            return _4376687;
        },
        "Xh"(_2360852, name, _4614776, _5266057) {
            const _4120655 = this.zh(_2360852, name, "", _4614776, _5266057);
            _4120655.classList.add("no-clear");
            const _1614090 = _4120655.querySelector("input");
            _1614090.classList.add("checkbox-field");
            _1614090.type = "checkbox";
            _1614090.checked = _5266057;
            _1614090.addEventListener("change", () => {
                if (_1614090.checked) {
                    _1614090.value = "true";
                } else {
                    _1614090.value = "false";
                }
            });
            _1614090.value = _5266057 ? "true" : "false";
            return _4120655;
        },
        "$h"(_4347407, name, _1114454, _3400185, _2607703) {
            const _3937938 = this.zh(_4347407, name, "", _1114454, _2607703);
            _3937938.classList.add("select-field");
            _3937938.classList.add("no-clear");
            const _4154440 = _3937938.querySelector("input");
            _4154440.classList.add("select-input");
            _4154440.type = "text";
            _4154440.readOnly = true;
            const _3776520 = _3937938.querySelector(".input-wrapper");
            const _3981760 = document.createElement("select");
            _3981760.classList.add("input-field");
            _3981760.classList.add("select-options");
            for (const _3423359 of _3400185) {
                const _2549398 = document.createElement("option");
                _2549398.value = _3423359.value;
                _2549398.textContent = _3423359.label;
                if (_3423359.value == _2607703) {
                    _2549398.selected = true;
                }
                _3981760.appendChild(_2549398);
            }
            _3981760.addEventListener("change", () => {
                _4154440.value = _3981760.options[_3981760.selectedIndex].value;
                _4154440.dispatchEvent(new Event("change"));
            });
            _3776520.appendChild(_3981760);
            return _3937938;
        },
        "Qh"(_2378355) {
            if (null == _2378355) {
                return null;
            }
            if (_2378355 instanceof HTMLInputElement) {
                return "number" == _2378355.type ? parseInt(_2378355.value) : "checkbox" == _2378355.type ? _2378355.checked : "range" == _2378355.type ? parseInt(_2378355.value) : "text" == _2378355.type || "password" == _2378355.type ? _2378355.value?.["trim"]() : _2378355.value;
            }
            const _3845919 = _2378355.querySelector("input");
            if (_3845919) {
                return this.Qh(_3845919);
            }
            throw Error("Field has no input element.");
        },
        "ta"(_2902506, _23185) {
            const _1900383 = document.createElement("div");
            _1900383.classList.add("skin-emote");
            const _2679685 = this.Zh(_2902506, "Name", "E.g. 'Rainbow Chicken'", "The name of the emote.", _23185.ge);
            _1900383.appendChild(_2679685);
            const _5447681 = this.Zh(_2902506, "Key", "E.g. KeyC", "Click to set a key for this emote.", _23185.Ce);
            _1900383.appendChild(_5447681);
            const _1369478 = this.$h(_2902506, "Dance", "The dance to perform with this emote.", [{
                "label": "Style Dance",
                "value": this.style
            }, {
                "label": "Macarena",
                "value": this.qs
            }, {
                "label": "Chicken Dance",
                "value": this.Xs
            }, {
                "label": "YMCA",
                "value": this.$s
            }, {
                "label": "Numa Numa",
                "value": this.Qs
            }, {
                "label": "Skibidi",
                "value": this.tn
            }, {
                "label": "Backourflip",
                "value": this.sn
            }, {
                "label": "Blue",
                "value": this.blue
            }], _23185.Ie);
            _1900383.appendChild(_1369478);
            const _2574570 = _23185.Ee.join(", ");
            const _1402981 = this.Zh(_2902506, "Skins", "E.g. 25, 26, 49, 65, 67, 70", "A comma separated list of skins to use with this emote.", _2574570);
            _1900383.appendChild(_1402981);
            const _5509956 = _23185.De.join(", ");
            const _4391492 = this.Zh(_2902506, "Hats", "E.g. 1, 2, 3", "A comma separated list of hats to use with this emote.", _5509956);
            _1900383.appendChild(_4391492);
            const _11322142 = this.qh(_2902506, "Interval", "The interval in milliseconds between outfit changes.", 100, 1000, [], _23185.Pe);
            _11322142.classList.add("no-clear");
            _11322142.querySelector("input").step = 50;
            _1900383.appendChild(_11322142);
            const _3981702 = document.createElement("div");
            _3981702.classList.add("emote-buttons");
            _1900383.appendChild(_3981702);
            const _10762057 = this.Rh("🗑️ Delete", "delete", () => {
                _1900383.remove();
            });
            _3981702.appendChild(_10762057);
            return _1900383;
        },
        "sa"(_1303429) {
            const _1975980 = _1303429.querySelector("label");
            const _3445561 = _1303429.querySelector("label:nth-child(2)");
            const _4986169 = _1303429.querySelector("label:nth-child(3)");
            const _4074735 = _1303429.querySelector("label:nth-child(4)");
            const _1702385 = _1303429.querySelector("label:nth-child(5)");
            const _3109472 = _1303429.querySelector("label:nth-child(6)");
            const _3306366 = new _2463653();
            _3306366.ge = this.Qh(_1975980);
            _3306366.Ce = this.Qh(_3445561);
            _3306366.Ie = this.Qh(_4986169);
            _3306366.Ee = this.Qh(_4074735)?.["split"](/[\s,]+/)["map"](_5155382 => parseInt(_5155382.trim()))["filter"](_5687154 => !isNaN(_5687154));
            _3306366.De = this.Qh(_1702385)?.["split"](/[\s,]+/)["map"](_3776161 => parseInt(_3776161.trim()))["filter"](_1581942 => !isNaN(_1581942));
            _3306366.Pe = parseInt(this.Qh(_3109472));
            if (isNaN(_3306366.Pe) || 100 > _3306366.Pe) {
                _3306366.Pe = 550;
            }
            return _3306366;
        },
        "Lh"() {
            const _4483276 = "hax-settings";
            let _4994150 = document.getElementById(_4483276);
            if (_4994150) {
                _4994150.remove();
            }
            _4994150 = this._h(_4483276, "⚙️", "Settings — " + _3534928[this.oi] + " " + _1533322[this.oi]);
            const _4785142 = document.createElement("div");
            _4785142.classList.add("fields");
            _4994150.appendChild(_4785142);
            const _3115658 = document.createElement("h2");
            _3115658.textContent = "Settings";
            _3115658.classList.add("settings-title");
            _4785142.appendChild(_3115658);
            const _1516707 = this.Zh(0, "Open menu key", "E.g. KeyO", "Click to set a key for opening the menu.", _4151122.Fe);
            _4785142.appendChild(_1516707);

            const _3269477 = this.Zh(1, "Chat key", "E.g. Enter", "Click to set a key for opening the chat.", _4151122.xe);
            _4785142.appendChild(_3269477);
            const _4563960 = this.qh(1, "Block invites", "Block invites from other players", 0, 2, ["Never", "During matches", "Always"], 0);
            _4785142.appendChild(_4563960);
            const _1836097 = this.Xh(1, "Punish Invisible", "Automatically punish invisible players. Disable for manual punish after detection.", true);
            _4785142.appendChild(_1836097);
            const _5042828 = this.Xh(1, "Punish Instakill", "Automatically punish players with instakill. Disable for manual punish after detection.", true);
            _4785142.appendChild(_5042828);
            const _10780928 = this.Xh(1, "Punish Moon Snipe", "Automatically punish moon sniping players. Disable for manual punish after detection.", true);
            _4785142.appendChild(_10780928);
            const _1997226 = this.Xh(1, "Chicken boost", "Enable or disable Chicken Kill Streaks. For each kill streak point a new chicken is spawned!", true);
            _4785142.appendChild(_1997226);
            const _5874732 = this.Zh(2, "Custom name", "A custom name, e.g. <color=yellow>Banana</color>", "Leave the field empty for default.", null);
            _4785142.appendChild(_5874732);
            const _3382858 = this.Zh(2, "Custom rank", "A custom rank, e.g. Master warrior", "Leave the field empty for default.", null);
            _4785142.appendChild(_3382858);
            const _1520994 = _5933536[this.oi];
            const _4256272 = this.Yh(Math.max(2, this.oi), "Custom level", "Leave as 0 for default. (WIP, limited visiblity)", 0, _1520994, null);
            _4785142.appendChild(_4256272);
            const _1990149 = this.Yh(1, "Custom room time", "Override the room minutes when you host a map", 1, 80, null);
            _4785142.appendChild(_1990149);
            const _1723546 = this.Zh(2, "Custom room name", "A custom name for your room when you host a map, e.g. KILLZONE", "Leave empty for default.", null);
            _4785142.appendChild(_1723546);
            const _3550223 = _5022476[this.oi];
            const _4809537 = this.Yh(Math.max(1, this.oi), "Custom room limit", "Override the room player limit when you host a map.", 2, _3550223, null);
            _4785142.appendChild(_4809537);
            const _2115009 = this.$h(2, "Custom room mode", "Override the room mode when you host a map.", [{
                "label": "- Not set -",
                "value": ""
            }, {
                "label": "FFA",
                "value": this.Ln
            }, {
                "label": "TDM",
                "value": this.Nn
            }, {
                "label": "Gun Game",
                "value": this.Fn
            }, {
                "label": "FFA35",
                "value": this.xn
            }, {
                "label": "Hardpoint",
                "value": this.Bn
            }, {
                "label": "Kour Surf",
                "value": this.vn
            }, {
                "label": "Kour Strike",
                "value": this.Kn
            }, {
                "label": "Battle Royale",
                "value": this.En
            }, {
                "label": "Moon Snipe",
                "value": this.Tn
            }, {
                "label": "Kour Craft",
                "value": this.Mn
            }, {
                "label": "Parkour",
                "value": this.Hn
            }], null);
            _4785142.appendChild(_2115009);
            const _1153262 = _4151122.ti.map(_6932483 => _8684551.getName(_6932483)).join(", ");
            const _3412740 = this.Zh(3, "Fast classes", "A list of classes for quick swapping, e.g. brawler, soldier, hitman", "Leave empty to disable fast classes.", _1153262);
            _4785142.appendChild(_3412740);
            const _15796244 = this.Zh(3, "Fast class key", "E.g. KeyQ", "Click to set a key for changing to the next fast class.", null);
            _4785142.appendChild(_15796244);
            const _5544601 = this.Xh(5, "Debug data send", "Enable logging of sent data packets.", false);
            _4785142.appendChild(_5544601);
            const _5229569 = this.Xh(5, "Debug data receive", "Enable logging of received data packets.", false);
            _4785142.appendChild(_5229569);
            const _5532738 = this.Xh(5, "Debug JSON send", "Enable logging of sent json packets.", false);
            _4785142.appendChild(_5532738);
            const _5462309 = this.Xh(5, "Debug JSON receive", "Enable logging of received json packets.", false);
            _4785142.appendChild(_5462309);
            const _4907354 = _1583647[this.oi];
            const _2463353 = document.createElement("h2");
            _2463353.textContent = "Skin emotes (Max " + _4907354 + ")";
            _2463353.classList.add("skin-emotes-title");
            _4785142.appendChild(_2463353);
            const _10841184 = document.createElement("div");
            _10841184.classList.add("skin-emotes-container");
            _4785142.appendChild(_10841184);
            _4151122.hi.forEach(_5717006 => {
                const _12772121 = this.ta(2, _5717006);
                _10841184.appendChild(_12772121);
            });
            const _4264041 = this.Rh("➕ Add emote", "add-emote", () => {
                if (_10841184.querySelectorAll(".skin-emote").length >= _4907354) {
                    return;
                }
                const _1549840 = new _2463653();
                const _8791193 = this.ta(2, _1549840);
                _10841184.appendChild(_8791193);
                _8791193.scrollIntoView({
                    "behavior": "smooth",
                    "na": "end"
                });
            });
            _4785142.appendChild(_4264041);
            // License system removed - skin emotes always available
            const _5825152 = document.createElement("div");
            _5825152.classList.add("buttons");
            _4994150.appendChild(_5825152);
            const _6223478 = this.Rh("Cancel", "cancel", () => {
                this.kh(_4483276);
            });
            _5825152.appendChild(_6223478);
            const _4409569 = this.Rh("Save settings", "accept", async () => {
                _4151122.Fe = this.Qh(_1516707);
                _4151122.xe = this.Qh(_3269477);
                _4151122.Be = this.Qh(_4563960);
                _4151122.We = this.Qh(_1836097);
                _4151122.Ge = this.Qh(_5042828);
                _4151122.Je = this.Qh(_10780928);
                _4151122.Ve = this.Qh(_1997226);
                _4151122.Ze = this.Qh(_5874732);
                _4151122.je = this.Qh(_3382858);
                _4151122.Ye = this.Qh(_4256272);
                _4151122.ti = this.Qh(_3412740).split(/[\s,]+/).map(_2566287 => _8684551.pn(_2566287.trim())).filter(_10952707 => _10952707 !== _8684551.Ys);
                _4151122.si = this.Qh(_15796244);
                _4151122.qe = this.Qh(_1723546);
                _4151122.Xe = this.Qh(_4809537);
                _4151122.$e = this.Qh(_2115009);
                _4151122.Qe = this.Qh(_1990149);
                _4151122.ni = this.Qh(_5544601);
                _4151122.ei = this.Qh(_5229569);
                _4151122.ii = this.Qh(_5532738);
                _4151122.ri = this.Qh(_5462309);
                _4151122.hi = [];
                const _2759907 = _10841184.querySelectorAll(".skin-emote");
                for (const _4907930 of _2759907) {
                    const _1545608 = this.sa(_4907930);
                    _4151122.hi.push(_1545608);
                }
                const _5438705 = this.Qh(_1569185);
                await this.qr(_5438705);
                await this.Jh();
                this.Gh();
                await this.Mi();
                await this.Hi();
                this.kh(_4483276);
                this.Ri("<color=yellow>Settings saved.");
            });
            _5825152.appendChild(_4409569);
            document.body.appendChild(_4994150);
            _4994150.focus();
        },
        "Nh"() {
            const _3404170 = "hax-password-change";
            let _5530618 = document.getElementById(_3404170);
            if (_5530618) {
                _5530618.remove();
            }
            _5530618 = this._h(_3404170, "🔑", "Change password");
            _5530618.classList.add("password-change");
            const _1526789 = document.createElement("div");
            _1526789.classList.add("fields");
            _5530618.appendChild(_1526789);
            const _1478252 = this.jh(1, "Current password", "Enter your current password", "Your current password.", "");
            _1526789.appendChild(_1478252);
            const _1762968 = this.jh(1, "New password", "Enter your new password", "Your new password.", "");
            _1526789.appendChild(_1762968);
            const _5119684 = this.jh(1, "Confirm password", "Re-enter your new password", "Re-enter your new password.", "");
            _1526789.appendChild(_5119684);
            const _1691202 = document.createElement("div");
            _1691202.classList.add("buttons");
            _5530618.appendChild(_1691202);
            const _5799139 = this.Rh("Cancel", "cancel", () => {
                this.kh(_3404170);
            });
            _1691202.appendChild(_5799139);
            const _15603335 = this.Rh("Change password", "accept", async () => {
                const _2774798 = this.Qh(_1478252);
                const _10892147 = this.Qh(_1762968);
                const _3743354 = this.Qh(_5119684);
                try {
                    if (_10892147 !== _3743354) {
                        throw Error("New passwords do not match!");
                    }
                    if (!_2774798 || !_10892147) {
                        throw Error("Please fill in all fields!");
                    }
                    await async function (_3240716, _3408689) {
                        const _6222458 = _7548062.firebase.auth().currentUser;
                        const credential = _7548062.firebase.auth.EmailAuthProvider.credential(_6222458.email, _3240716);
                        await _6222458.reauthenticateWithCredential(credential);
                        await _6222458.updatePassword(_3408689);
                    }(_2774798, _10892147);
                    this.kh(_3404170);
                    this.Ri("<color=green>Password updated sucessfully.");
                } catch (_4574441) {
                    alert(_4574441.message);
                }
            });
            _1691202.appendChild(_15603335);
            document.body.appendChild(_5530618);
        },
        "Fh"() {
            const _6246937 = "hax-gate-crash";
            let _1473000 = document.getElementById(_6246937);
            if (_1473000) {
                _1473000.remove();
            }
            _1473000 = this._h(_6246937, "🏰", "Clan rape");
            document.body.appendChild(_1473000);
            const _3807338 = document.createElement("div");
            _3807338.classList.add("fields");
            _1473000.appendChild(_3807338);
            const _3932579 = this.Zh(4, "Clan", "Enter a clan to join", "This will rape the clan. Please ask for consent first.", "");
            _3807338.appendChild(_3932579);
            const _6249034 = document.createElement("div");
            _6249034.classList.add("buttons");
            _1473000.appendChild(_6249034);
            const _9193082 = this.Rh("Cancel", "cancel", () => {
                this.kh(_6246937);
            });
            _6249034.appendChild(_9193082);
            const _2483398 = this.Rh("Force join", "accept", async () => {
                const _2517396 = this.Qh(_3932579);
                try {
                    await async function (_8324266, _3827763) {
                        const _3404428 = firebase.auth().currentUser;
                        "FirebaseHammer: User must be authenticated before setting data.";
                        const _4252826 = _7548062.firebase.database();
                        const _5509058 = "users/" + _3404428.uid + "/" + _8324266;
                        try {
                            await _4252826.goOffline();
                            await _4252826.ref(_5509058).remove();
                            if (null != _3827763) {
                                await _4252826.ref(_5509058).set(_3827763);
                            }
                            await _4252826.goOnline();
                            _7548062.showUserDetails(_3404428.email, _3404428);
                        } catch (_10687480) { }
                        _7548062.showUserDetails(_3404428.email, _3404428);
                    }("public/clan", _2517396);
                    this.kh(_6246937);
                    this.Ri("<color=green>Clan joined sucessfully.");
                    alert("Please reload for changes to reflect.");
                } catch (_5855519) {
                    alert(_5855519.message);
                }
            });
            _6249034.appendChild(_2483398);
            document.body.appendChild(_1473000);
        },

        "bh"() {
            const _2246186 = "chat-input";
            const _3613964 = document.getElementById(_2246186);
            if (_3613964) {
                return void _3613964.focus();
            }
            const _1642485 = "hax-chat";
            const _5655109 = document.createElement("div");
            _5655109.id = _1642485;
            const _4220687 = document.createElement("input");
            _4220687.id = _2246186;
            _4220687.type = "text";
            _4220687.classList.add("chat-input");
            _4220687.placeholder = "Enter text...";
            _5655109.appendChild(_4220687);
            const _3691535 = () => {
                let _4811202 = _4220687.value.trim();
                if (_4811202) {
                    if ("!" != _4811202[0]) {
                        let _8695612 = this.wi.pe;
                        _8695612 = null + "<color=#ddd>";
                        _4811202 = _8695612 + ": " + _4811202;
                    } else {
                        _4811202 = _4811202.slice(1);
                    }
                    this.Or(_4811202);
                }
                this.ea();
            };
            _5655109.addEventListener("keydown", _1504552 => {
                _1504552.stopPropagation();
                if ("Enter" === _1504552.key) {
                    _3691535();
                    _1504552.preventDefault();
                    _1504552.stopPropagation();
                } else if ("Escape" === _1504552.Ce) {
                    this.ea();
                    _1504552.preventDefault();
                    _1504552.stopPropagation();
                }
            }, true);
            document.body.appendChild(_5655109);
            document.getElementById("unity-canvas").blur();
            _4220687.focus();
        },
        "ea"() {
            const _4203720 = "hax-chat";
            const _5524019 = document.getElementById(_4203720);
            if (_5524019) {
                _5524019.remove();
            }
        },
        "Ri"(_3621215) {
            _5735521("MainManager", "ShowMessageCustom", _3621215);
        },
        "Mh"(_1894204) {
            _5735521("MapScripts", "ShowOtherUserProfile", _1894204.Wn);
        },
        async "Th"(_4096310, _5900384, _3425076, _5563145) {
            if (!_4096310 || _4096310.length < _5900384 || _4096310.length < _3425076) {
                return _1606547;
            }
            const _2757196 = Math.floor((new Date() - _3981666) / 86400000) + _5563145;
            const _3020623 = new Uint8Array(4);
            _3020623[0] = _2757196 >> 8 & 255;
            _3020623[1] = 255 & _2757196;
            _3020623[2] = 255 & _5900384;
            _3020623[3] = 255 & _3425076;
            if (!_1213793(this.oi, _2235459)) {
                for (; _3020623[0] || _3020623[1];) {
                    _3020623[0] = _3020623[1] = Math.max(_3020623[0], _3020623[1]) - 1;
                }
            }
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const _1667791 = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(_4096310), "PBKDF2", false, ["deriveKey"]);
            const _6931767 = await window.crypto.subtle.deriveKey({
                "name": "PBKDF2",
                "salt": salt,
                "iterations": 100000,
                "hash": "SHA-256"
            }, _1667791, {
                "name": "AES-GCM",
                "length": 128
            }, false, ["encrypt", "decrypt"]);
            if (!_1213793(this.ci, _3339004)) {
                for (; _3020623[2] || _3020623[3];) {
                    _3020623[2] = _3020623[3] = Math.max(_3020623[2], _3020623[3]) - 1;
                }
            }
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const _1536083 = new Uint8Array(await window.crypto.subtle.encrypt({
                "name": "AES-GCM",
                "iv": iv
            }, _6931767, _3020623));
            const _1654578 = new Uint8Array(28 + _1536083.length);
            _1654578.set(salt, 0);
            _1654578.set(iv, 16);
            _1654578.set(_1536083, 28);
            return btoa(String.fromCharCode(..._1654578));
        },

        async "Ne"(_4688614 = "reasons") {
            _3862899("hax/users/" + this.Di + "/banned", _4688614);
            await firebase.auth().signOut();
            _7548062.onbeforeunload = null;
            _7548062.location.href = "about:blank";
        },
        "Ti"() {
            const _13123922 = _1284430("hax/users/" + this.Di + "/banned");
            if (_13123922) {
                const _4155746 = setTimeout(() => {
                    try {
                        unityInstance.SendMessage("MainManager", "OnDetectedCheats", _13123922);
                    } catch (_3072933) { }
                    clearTimeout(_4155746);
                }, 100);
                return true;
            }
            return false;
        },
        "kr"(uid) {
            _7548062.sendInvite("e7kMOMFdX5SMUsheaTKSntTsLhH3", uid, "BUSY");
        },
        "ia"(uid, _4793065 = 50) {
            const _3334181 = setInterval(() => {
                _7548062.sendInvite("dZ1jIRaNQtNndNkLpWGy92ZeCuj1", uid, "STFU");
                if (!(--_4793065 > 0)) {
                    clearInterval(_3334181);
                }
            }, 100);
        },
        "Mr"(_5293188) {
            const _3365244 = _6947240.Rn(this.Ui);
            var _5907446;
            if (_3365244 >= 1) {
                for (let _6243187 = 0; _5293188 > _6243187; ++_6243187) {
                    _5907446 = _3365244 - 1;
                    const _1072679 = Math.floor(Math.random() * (_5907446 - 0 + 1)) + 0;
                    _5735521("MapScripts", "SpawnChicken", _1072679);
                }
            }
        },
        "xh"() {
            for (const _1252079 of this.fi.values()) {
                const _5760598 = Math.random() * 10 + -5;
                const _2254489 = Math.random() * 2 + 400;
                const _1886307 = Math.random() * 10 + -5;
                this.hh(_1252079, [_5760598, _2254489, _1886307]);
            }
            this.Or("<color=green>Thank you for flying with</color> <color=#F0F>" + this.wi.ge + " Air!</color>");
        },
        "ra"() {
            const _1847406 = new _1504421();
            _1847406.q(123);
            _1847406.L(666.777);
            this.Sr(_1847406.data, "Test write data", null);
            _1847406.l = 0;
            _1847406.j();
            _1847406.R();
        }
    };
    const _4096410 = {
        "capture": true
    };
    _7548062.WebSocket = window.WebSocket = class extends WebSocket {
        static ["Ar"] = null;
        static ["ha"] = null;
        constructor(..._1285315) {
            super(..._1285315);
            this.addEventListener("open", _5673264 => {
                if (this.url.includes("exitgames")) {
                    _5399829.Fi(this);
                    this.constructor.Ar = this;
                } else if (this.url.includes("firebaseio.com")) {
                    _5399829.Vi(this);
                    this.constructor.ha = this;
                }
            });
            this.addEventListener("close", _4430147 => {
                if (this == this.constructor.Ar) {
                    _5399829.Ki(this);
                    this.constructor.Ar = null;
                } else if (this == this.constructor.ha) {
                    _5399829.Ji(this);
                    this.constructor.ha = null;
                }
            });
        }
    };
    _7548062.onMapPlayStarted = function (_2191452) {
        _5399829.yi = true;
        _5399829.Oi(false, 100);
    };
    _7548062.onMapPlayEnd = function () {
        _5399829.yi = false;
        _5399829.Oi(false, 100);
    };
    document.addEventListener("keydown", _3620088 => {
        if (!_3620088.target.matches("input, textarea")) {
            if (_5399829.Uh(_3620088) && false) {
                _3620088.preventDefault();
                _3620088.stopPropagation();
            }
        }
    }, _4096410);
    (function () {
        const _1165908 = Event.prototype.preventDefault;
        Event.prototype.preventDefault = function () {
            if (!(this instanceof KeyboardEvent || "beforeinput" === this.type || "input" === this.type) || !(document.activeElement && ("INPUT" === document.activeElement.tagName || "TEXTAREA" === document.activeElement.tagName || document.activeElement.isContentEditable))) {
                return _1165908.call(this);
            }
        };
        const _7893588 = ["keydown", "keypress", "keyup", "beforeinput"];
        for (const _2451950 of _7893588) document.addEventListener(_2451950, function (_2391157) {
            const _4202257 = document.activeElement;
            if (_4202257 && ("INPUT" === _4202257.tagName || "TEXTAREA" === _4202257.tagName || _4202257.isContentEditable) && _2391157.target !== _4202257) {
                _2391157.stopImmediatePropagation();
            }
        }, true);
    })();
    (() => {
        const _4994128 = (_4822051 = 0) => {
            if (_7548062.firebase && _7548062.firebase.auth && _7548062.unityInstance) {
                _7548062.firebase.auth().onAuthStateChanged(async _6230050 => {
                    if (_6230050) {
                        await _5399829.Pi(_6230050);
                    } else {
                        await _5399829.Li();
                    }
                });
            } else if (300 > _4822051) {
                setTimeout(() => _4994128(_4822051 + 1), 100);
            }
        };
        _4994128();
    })();
    const _2762819 = new CSSStyleSheet();
    _2762819.replaceSync(`
	.hax-popup	{
		position: fixed;
		left: 50%;
		top: 50%;
		translate: -50% -50%;	
		background: linear-gradient(145deg, #1e1e1e, #333);
		padding: 0px;
		border-radius: 10px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 -4px 6px rgba(0, 0, 0, 0.2);
		color: lightgrey;
		font-family: monospace;
		font-size: 16px;
		z-index: 3000;
		display: flex;
		flex-direction: column;
	}

	.hax-popup .titlebar
	{
		background: #1e1e1e;
		border-top-left-radius: 10px;
		border-top-right-radius: 10px;
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		height: 35px;
		display: flex;
		justify-content: space-between;
	}

	.hax-popup span
	{
		display: inline-block;
	}

	.hax-popup .title-text
	{
		margin: 8px 5px;
		color: #c9ae1c;
		display: inline;
	}

	.hax-popup .title-icon
	{
		font-size: 18px;
		margin: 5px;
		cursor: default;
	}

	.hax-popup .title-close-button 
	{
		background: none;
		padding: 0px;
		color: lightgrey;
		cursor: pointer;
		border: none;
		margin: 5px;
		font-size: 18px;
		width: 30px;
		border-radius: 5px;
		margin: 5px;
	}

	.hax-popup .title-close-button:hover
	{
		color: whitesmoke;
		background: #3f3f3f;
	}
	
	.hax-popup .fields
	{
		padding: 20px;
		display: flex;
		flex-direction: column;	
		max-height: 50vh;
		overflow-y: auto;
	}

	.hax-popup .buttons
	{
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 5px;
		border-top: 1px solid #444;
	}

	.hax-popup .icon-button
	{
		background: #2c82526b;
		border: none;
		cursor: pointer;
		width: 30px;
		height: 30px;
		font-size: 18px;
		border-radius: 5px;
		margin: 5px;
	}

	.hax-popup .icon-button:hover
	{
		background-color: #186a18;
	}

	.hax-popup .icon-button:active
	{
		background-color: #145a14;
	}

	.hax-popup .icon-button:disabled
	{
		background-color: #1e1e1e !important;
		cursor: inherit;
	}

	.hax-popup .dialog-button 
	{
		background: #666;
		color: whitesmoke;
		border: none;
		cursor: pointer;
		font-size: 18px;
		border-radius: 5px;
		margin: 5px;
		padding: 10px;
		width: 10em;
	}

	.hax-popup .dialog-button:hover
	{
		background: #777;
	}

	.hax-popup .dialog-button:active
	{
		background: #555;
	}

	.hax-popup .dialog-button:disabled
	{
		background: #333 !important;
		cursor: inherit;
	}

	.hax-popup .dialog-button.accept
	{
		background: #2c82526b;
	}

	.hax-popup .dialog-button.accept:hover
	{
		background-color: #186a18;
	}

	.hax-popup .dialog-button.accept:active
	{
		background-color: #145a14;
	}

	.hax-popup .dialog-button.cancel
	{
	}

	.hax-popup .dialog-button.cancel:hover
	{
	}

	.hax-popup .dialog-button.delete
	{
		background: #882b2b;
	}

	.hax-popup .dialog-button.delete:hover
	{
		background-color: #8c0808;
	}

	.hax-popup .dialog-button.delete:active
	{
		background-color: #7a0000;
	}

	.hax-popup .input-field
	{
		margin: 5px;
		padding: 10px;
		border: none;
		border-radius: 5px;
		background-color: #444;
		color: whitesmoke;
		font-size: 20px;
		font-family: monospace;
	}

	.hax-popup .clear-button
	{
		background: none;
		border: none;
		cursor: pointer;
		color: lightgrey;
		font-size: 18px;
		width: 30px;
		display: none;
	}

	.hax-popup .text-clear button
	{
		margin: 0 -15px;
		translate: -30px 0;
	}

	.hax-popup .no-clear button
	{
		display: none !important;
	}

	.hax-popup .clear-button:hover
	{
		color: white;
	}

	.hax-popup .label
	{
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.hax-popup .input-wrapper
	{
		display: flex;
		align-items: center;
		width: 80%;
	}

	.hax-popup .label-text
	{
		width: 200px;
	}

	.hax-popup .text-field
	{
		width: 100%;
	}

	.hax-popup .password-field
	{
		width: 100%;
	}

	.hax-popup .number-field
	{
		width: 200px;
	}

	.hax-popup .slider-field
	{
		width: 200px;
	}

	.hax-popup .slider-value-text
	{
		width: 200px;
		margin-left: 10px;
	}

	.hax-popup .checkbox-field
	{
		width: 20px;
		height: 20px;
		margin-right: 10px;
	}

	.hax-popup .select-input
	{
		display: none;
	}

	.hax-popup .skin-emote
	{
		border: 1px solid #444;
		padding: 10px;
		margin: 10px;
	}

	.hax-popup .emote-buttons
	{
		display: flex;
		align-items: end;
		width: 100%;
		flex-direction: column;
	}

	.overlay 
	{
		display: block;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		z-index: 2000;
	}

	#hax-menu
	{
		top: auto;
		left: auto;		
		translate: 0 0;
		bottom: 10vh;
		right: 10px;
		min-width: 250px;
		max-width: 400px;
		z-index: 1000;
	}

	#hax-players-wrapper
	{
		max-height: 30vh;
		overflow-y: auto;	
		display: grid;
	}

	#hax-players
	{
		table-layout: fixed;
		margin: 5px 10px 5px 5px;
		padding: 0;
		border: none;
	}

	.hidden
	{
		display: none;
	}

	#hax-players .icon-col
	{
		width: 25px;
	}

	#hax-players .player-button
	{
		width: 100%;
		padding: 5px;
		border: none;
		border-radius: 5px;
		color: lightgrey;
		font-size: 14px;
		transition: all 0.3s;
		cursor: pointer;
		background-color: #444;
	}

	#hax-players .player-button:hover
	{
		background-color: #555;
	}

	#hax-players .player-button:disabled
	{
		background-color: #333;
	}

	#hax-players .player-button.protected
	{
		background-color: darkgreen;
	}

	#hax-players .player-button.naughty
	{
		background-color: #bf6a00;
	}

	#hax-players .player-button.cheater
	{
		background-color: darkred;
	}

	#hax-players .player-button .state
	{
	}

	#hax-players .player-button .name
	{
		 margin: 0px 10px;
	}

	#hax-players .player-button .dead
	{
		 text-decoration: line-through;
	}

	#hax-players .player-button .tools::before
	{
		 content: \"⚙️\";
		 margin-right: 5px;
	}

	#hax-players .player-button .cheats
	{
	}

	#main-message, #nobody
	{
		text-align: center;
		margin: 25px 20px;
	}

	#hax-settings
	{
		width: 50vw;
	}

	#hax-password-change
	{
		width: 30vw;
	}

	#hax-chat
	{
		bottom: 8vh;
		left: 1vh;
		width: 36vh;
		padding: 0px;
		font-size: 16px;
		position: fixed;
	}

	#hax-chat .chat-input
	{
		margin: 0px;
		padding: 10px;
		border: none;
		border-radius: 5px;
		background-color: #444;
		color: lightgrey;
		font-size: 20px;
		font-family: monospace;
		width: 100%;
		height: 4vh;
	}

	#hax-player-menu 
	{
		position: absolute;
		z-index: 4000;
		background-color: #fff;
		border: 1px solid #ccc;
		box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
		padding: 0;
		margin: 0;
		width: max-content;
		border-radius: 6px;
		translate: -100% -100%;
	}

	#hax-player-menu ul 
	{
		list-style: none;
		padding: 0;
		margin: 0;
	}

	#hax-player-menu li 
	{
		padding: 10px;
		cursor: pointer;
	}

	#hax-player-menu li:hover 
	{
		background-color: #555;
	}

	.menu-item.disabled
	{
		pointer-events: none;
		opacity: 0.3;
	}
    `);
    document.adoptedStyleSheets = [_2762819];
    _7548062.aa = _5399829;
}();
