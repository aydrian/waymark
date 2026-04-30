"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrip = getTrip;
exports.putTrip = putTrip;
exports.tripExists = tripExists;
exports.deleteTrip = deleteTrip;
exports.listTrips = listTrips;
exports.getGlobalPOI = getGlobalPOI;
exports.putGlobalPOI = putGlobalPOI;
exports.globalPOIExists = globalPOIExists;
exports.deleteGlobalPOI = deleteGlobalPOI;
exports.listGlobalPOIs = listGlobalPOIs;
exports.hashPin = hashPin;
exports.verifyPin = verifyPin;
exports.generateSalt = generateSalt;
var index_js_1 = require("../types/index.js");
var key = function (id) { return "trip:".concat(id); };
function getTrip(kv, id) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, parsed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kv.get(key(id), 'text')];
                case 1:
                    raw = _a.sent();
                    if (!raw)
                        return [2 /*return*/, null];
                    parsed = index_js_1.ItinerarySchema.safeParse(JSON.parse(raw));
                    if (!parsed.success) {
                        console.error("[kv] Schema parse failed for trip:".concat(id), parsed.error.issues);
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, parsed.data];
            }
        });
    });
}
function putTrip(kv, trip) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kv.put(key(trip.id), JSON.stringify(trip))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function tripExists(kv, id) {
    return __awaiter(this, void 0, void 0, function () {
        var val;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kv.get(key(id), 'text')];
                case 1:
                    val = _a.sent();
                    return [2 /*return*/, val !== null];
            }
        });
    });
}
function deleteTrip(kv, id) {
    return __awaiter(this, void 0, void 0, function () {
        var exists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tripExists(kv, id)];
                case 1:
                    exists = _a.sent();
                    if (!exists)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, kv.delete(key(id))];
                case 2:
                    _a.sent();
                    return [2 /*return*/, true];
            }
        });
    });
}
function listTrips(kv) {
    return __awaiter(this, void 0, void 0, function () {
        var keys, trips;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kv.list({ prefix: 'trip:' })];
                case 1:
                    keys = (_a.sent()).keys;
                    return [4 /*yield*/, Promise.all(keys.map(function (_a) {
                            var name = _a.name;
                            return getTrip(kv, name.slice('trip:'.length));
                        }))];
                case 2:
                    trips = _a.sent();
                    return [2 /*return*/, trips
                            .filter(function (t) { return t !== null; })
                            .map(function (t) {
                            var _a;
                            return ({
                                id: t.id,
                                title: t.title,
                                startDate: t.startDate,
                                endDate: t.endDate,
                                destinations: t.destinations,
                                travelers: (_a = t.travelers) !== null && _a !== void 0 ? _a : [],
                                updatedAt: t.updatedAt,
                            });
                        })];
            }
        });
    });
}
// Global POI functions
var poiKey = function (id) { return "poi:".concat(id); };
function getGlobalPOI(kv, id) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, parsed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kv.get(poiKey(id), 'text')];
                case 1:
                    raw = _a.sent();
                    if (!raw)
                        return [2 /*return*/, null];
                    parsed = index_js_1.GlobalPOISchema.safeParse(JSON.parse(raw));
                    if (!parsed.success) {
                        console.error("[kv] Schema parse failed for poi:".concat(id), parsed.error.issues);
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, parsed.data];
            }
        });
    });
}
function putGlobalPOI(kv, poi) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kv.put(poiKey(poi.id), JSON.stringify(poi))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function globalPOIExists(kv, id) {
    return __awaiter(this, void 0, void 0, function () {
        var val;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kv.get(poiKey(id), 'text')];
                case 1:
                    val = _a.sent();
                    return [2 /*return*/, val !== null];
            }
        });
    });
}
function deleteGlobalPOI(kv, id) {
    return __awaiter(this, void 0, void 0, function () {
        var exists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, globalPOIExists(kv, id)];
                case 1:
                    exists = _a.sent();
                    if (!exists)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, kv.delete(poiKey(id))];
                case 2:
                    _a.sent();
                    return [2 /*return*/, true];
            }
        });
    });
}
function listGlobalPOIs(kv) {
    return __awaiter(this, void 0, void 0, function () {
        var keys, pois;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, kv.list({ prefix: 'poi:' })];
                case 1:
                    keys = (_a.sent()).keys;
                    return [4 /*yield*/, Promise.all(keys.map(function (_a) {
                            var name = _a.name;
                            return getGlobalPOI(kv, name.slice('poi:'.length));
                        }))];
                case 2:
                    pois = _a.sent();
                    return [2 /*return*/, pois.filter(function (p) { return p !== null; })];
            }
        });
    });
}
// PIN hashing utilities (used for trip access and admin auth)
var enc = new TextEncoder();
/** Derive a hex hash of pin+salt using PBKDF2 */
function hashPin(pin, salt) {
    return __awaiter(this, void 0, void 0, function () {
        var keyMaterial, bits;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])];
                case 1:
                    keyMaterial = _a.sent();
                    return [4 /*yield*/, crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, keyMaterial, 256)];
                case 2:
                    bits = _a.sent();
                    return [2 /*return*/, Array.from(new Uint8Array(bits))
                            .map(function (b) { return b.toString(16).padStart(2, '0'); })
                            .join('')];
            }
        });
    });
}
/** Constant-time comparison of two hex strings */
function safeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
/** Verify a plain PIN against stored salt+hash */
function verifyPin(pin, salt, storedHash) {
    return __awaiter(this, void 0, void 0, function () {
        var candidate;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, hashPin(pin, salt)];
                case 1:
                    candidate = _a.sent();
                    return [2 /*return*/, safeEqual(candidate, storedHash)];
            }
        });
    });
}
/** Generate a random hex salt */
function generateSalt() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(function (b) { return b.toString(16).padStart(2, '0'); })
        .join('');
}
