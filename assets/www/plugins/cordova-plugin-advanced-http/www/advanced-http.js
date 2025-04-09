cordova.define("cordova-plugin-advanced-http.advanced-http", function(require, exports, module) {
/*
 * A native HTTP Plugin for Cordova / PhoneGap.
 */

var pluginId = module.id.slice(0, module.id.lastIndexOf('.'));

var exec = require('cordova/exec');
var base64 = require('cordova/base64');
var messages = require(pluginId + '.messages');
var errorCodes = require(pluginId + '.error-codes');
var globalConfigs = require(pluginId + '.global-configs');
var jsUtil = require(pluginId + '.js-util');
var ToughCookie = require(pluginId + '.tough-cookie');
var lodash = require(pluginId + '.lodash');
var WebStorageCookieStore = (function init(ToughCookie, _) {
    function WebStorageCookieStore(storage, storeKey) {
        ToughCookie.Store.call(this);
        this._storage = storage;
        this._storeKey = storeKey || '__cookieStore__';
        this.synchronous = true;
    }

    WebStorageCookieStore.prototype = Object.create(ToughCookie.Store);

    WebStorageCookieStore.prototype.findCookie = function (domain, path, key, callback) {
        var store = this._readStore();
        var cookie = _.get(store, [domain, path, key], null);

        callback(null, ToughCookie.Cookie.fromJSON(cookie));
    };

    WebStorageCookieStore.prototype.findCookies = function (domain, path, callback) {
        if (!domain) {
            callback(null, []);
            return;
        }

        var that = this;
        var cookies = [];
        var store = this._readStore();
        var domains = ToughCookie.permuteDomain(domain) || [domain];

        domains.forEach(function (domain) {
            if (!store[domain]) {
                return;
            }

            var matchingPaths = Object.keys(store[domain]);

            if (path != null) {
                matchingPaths = matchingPaths.filter(function (cookiePath) {
                    return that._isOnPath(cookiePath, path);
                });
            }

            matchingPaths.forEach(function (path) {
                Array.prototype.push.apply(cookies, _.values(store[domain][path]));
            });
        });

        cookies = cookies.map(function (cookie) {
            return ToughCookie.Cookie.fromJSON(cookie);
        });

        callback(null, cookies);
    };

    /**
     * Returns whether `cookiePath` is on the given `urlPath`
     */
    WebStorageCookieStore.prototype._isOnPath = function (cookiePath, urlPath) {
        if (!cookiePath) {
            return false;
        }

        if (cookiePath === urlPath) {
            return true;
        }

        if (urlPath.indexOf(cookiePath) !== 0) {
            return false;
        }

        if (cookiePath[cookiePath.length - 1] !== '/' && urlPath[cookiePath.length] !== '/') {
            return false;
        }

        return true;
    };

    WebStorageCookieStore.prototype.putCookie = function (cookie, callback) {
        var store = this._readStore();

        _.set(store, [cookie.domain, cookie.path, cookie.key], cookie);
        this._writeStore(store);
        callback(null);
    };

    WebStorageCookieStore.prototype.updateCookie = function (oldCookie, newCookie, callback) {
        this.putCookie(newCookie, callback);
    };


    WebStorageCookieStore.prototype.removeCookie = function (domain, path, key, callback) {
        var store = this._readStore();

        _.unset(store, [domain, path, key]);
        this._writeStore(store);
        callback(null);
    };

    WebStorageCookieStore.prototype.removeCookies = function (domain, path, callback) {
        var store = this._readStore();

        if (path == null) {
            _.unset(store, [domain]);
        } else {
            _.unset(store, [domain, path]);
        }

        this._writeStore(store);
        callback(null);
    };

    WebStorageCookieStore.prototype.getAllCookies = function (callback) {
        var cookies = [];
        var store = this._readStore();

        Object.keys(store).forEach(function (domain) {
            Object.keys(store[domain]).forEach(function (path) {
                Array.prototype.push.apply(cookies, _.values(store[domain][path]));
            });
        });

        cookies = cookies.map(function (cookie) {
            return ToughCookie.Cookie.fromJSON(cookie);
        });

        cookies.sort(function (c1, c2) {
            return (c1.creationIndex || 0) - (c2.creationIndex || 0);
        });

        callback(null, cookies);
    };

    WebStorageCookieStore.prototype._readStore = function () {
        var json = this._storage.getItem(this._storeKey);

        if (json !== null) {
            try {
                return JSON.parse(json);
            } catch (e) { }
        }

        return {};
    };

    WebStorageCookieStore.prototype._writeStore = function (store) {
        this._storage.setItem(this._storeKey, JSON.stringify(store));
    };

    return WebStorageCookieStore;
})(ToughCookie, lodash);
var cookieHandler = (function init(storage, ToughCookie, WebStorageCookieStore) {
    var storeKey = '__advancedHttpCookieStore__';

    var store = new WebStorageCookieStore(storage, storeKey);
    var cookieJar = new ToughCookie.CookieJar(store);

    return {
        setCookieFromString: setCookieFromString,
        setCookie: setCookie,
        getCookieString: getCookieString,
        clearCookies: clearCookies,
        removeCookies: removeCookies
    };

    function splitCookieString(cookieStr) {
        var cookieParts = cookieStr.split(',');
        var splitCookies = [];
        var processedCookie = null;

        for (var i = 0; i < cookieParts.length; ++i) {
            if (cookieParts[i].substr(-11, 8).toLowerCase() === 'expires=') {
                processedCookie = cookieParts[i] + ',' + cookieParts[i + 1];
                i++;
            } else {
                processedCookie = cookieParts[i];
            }

            processedCookie = processedCookie.trim();
            splitCookies.push(processedCookie);
        }

        return splitCookies;
    }

    function setCookieFromString(url, cookieStr) {
        if (!cookieStr) return;

        var cookies = splitCookieString(cookieStr);

        for (var i = 0; i < cookies.length; ++i) {
            cookieJar.setCookieSync(cookies[i], url, { ignoreError: true });
        }
    }

    function setCookie(url, cookie, options) {
        options = options || {};
        options.ignoreError = false;
        cookieJar.setCookieSync(cookie, url, options);
    }

    function getCookieString(url) {
        return cookieJar.getCookieStringSync(url);
    }

    function clearCookies() {
        window.localStorage.removeItem(storeKey);
    }

    function removeCookies(url, cb) {
        cookieJar.getCookies(url, function (error, cookies) {
            if (!cookies || cookies.length === 0) {
                return cb(null, []);
            }

            var domain = cookies[0].domain;

            cookieJar.store.removeCookies(domain, null, cb);
        });
    }
})(window.localStorage, ToughCookie, WebStorageCookieStore);
var dependencyValidator = (function init(global, console, messages) {
    var interface = {
        checkBlobApi: checkBlobApi,
        checkFileReaderApi: checkFileReaderApi,
        checkFormDataInstance: checkFormDataInstance,
        checkTextEncoderApi: checkTextEncoderApi,
        logWarnings: logWarnings,
    };

    return interface;

    function logWarnings() {
        if (!global.FormData) {
            console.warn(messages.MISSING_FORMDATA_API);
        } else if (!global.FormData.prototype || !global.FormData.prototype.entries) {
            console.warn(messages.MISSING_FORMDATA_ENTRIES_API);
        }
    }

    function checkBlobApi() {
        if (!global.Blob || !global.Blob.prototype) {
            throw new Error(messages.MISSING_BLOB_API);
        }
    }

    function checkFileReaderApi() {
        if (!global.FileReader || !global.FileReader.prototype) {
            throw new Error(messages.MISSING_FILE_READER_API);
        }
    }

    function checkFormDataInstance(instance) {
        if (!instance || !instance.entries) {
            throw new Error(messages.MISSING_FORMDATA_ENTRIES_API);
        }
    }

    function checkTextEncoderApi() {
        if (!global.TextEncoder || !global.TextEncoder.prototype) {
            throw new Error(messages.MISSING_TEXT_ENCODER_API);
        }
    }
})(window, window.console, messages);
var ponyfills = (function init(global) {
    var interface = { FormData: FormData };

    // expose all constructor functions for testing purposes
    if (init.debug) {
        interface.Iterator = Iterator;
    }

    function FormData() {
        this.__items = [];
    }

    FormData.prototype.append = function(name, value, filename) {
        if (global.File && value instanceof global.File) {
            // nothing to do
        } else if (global.Blob && value instanceof global.Blob) {
            // mimic File instance by adding missing properties
            value.lastModifiedDate = new Date();
            value.name = filename !== undefined ? filename : 'blob';
        } else {
            value = String(value);
        }

        this.__items.push([ name, value ]);
    };

    FormData.prototype.entries = function() {
        return new Iterator(this.__items);
    };

    function Iterator(items) {
        this.__items = items;
        this.__position = -1;
    }

    Iterator.prototype.next = function() {
        this.__position += 1;

        if (this.__position < this.__items.length) {
            return { done: false, value: this.__items[this.__position] };
        }

        return { done: true, value: undefined };
    }

    return interface;
})(window);
var helpers = (function init(global, jsUtil, cookieHandler, messages, base64, errorCodes, dependencyValidator, ponyfills) {
    var validSerializers = ['urlencoded', 'json', 'utf8', 'raw', 'multipart'];
    var validCertModes = ['default', 'nocheck', 'pinned', 'legacy'];
    var validClientAuthModes = ['none', 'systemstore', 'buffer'];
    var validHttpMethods = ['get', 'put', 'post', 'patch', 'head', 'delete', 'options', 'upload', 'download'];
    var validResponseTypes = ['text', 'json', 'arraybuffer', 'blob'];

    var nextRequestId = (function(){
        var currReqId = 0;
        return function nextRequestId() {
            return ++currReqId;
        }
    })();

    var interface = {
        b64EncodeUnicode: b64EncodeUnicode,
        checkClientAuthMode: checkClientAuthMode,
        checkClientAuthOptions: checkClientAuthOptions,
        checkDownloadFilePath: checkDownloadFilePath,
        checkFollowRedirectValue: checkFollowRedirectValue,
        checkForBlacklistedHeaderKey: checkForBlacklistedHeaderKey,
        checkForInvalidHeaderValue: checkForInvalidHeaderValue,
        checkSerializer: checkSerializer,
        checkSSLCertMode: checkSSLCertMode,
        checkTimeoutValue: checkTimeoutValue,
        checkUploadFileOptions: checkUploadFileOptions,
        getMergedHeaders: getMergedHeaders,
        processData: processData,
        handleMissingCallbacks: handleMissingCallbacks,
        handleMissingOptions: handleMissingOptions,
        injectCookieHandler: injectCookieHandler,
        injectFileEntryHandler: injectFileEntryHandler,
        injectRawResponseHandler: injectRawResponseHandler,
        nextRequestId: nextRequestId,
    };

    // expose all functions for testing purposes
    if (init.debug) {
        interface.mergeHeaders = mergeHeaders;
        interface.checkForValidStringValue = checkForValidStringValue;
        interface.checkKeyValuePairObject = checkKeyValuePairObject;
        interface.checkHttpMethod = checkHttpMethod;
        interface.checkResponseType = checkResponseType;
        interface.checkHeadersObject = checkHeadersObject;
        interface.checkParamsObject = checkParamsObject;
        interface.resolveCookieString = resolveCookieString;
        interface.createFileEntry = createFileEntry;
        interface.getCookieHeader = getCookieHeader;
        interface.getMatchingHostHeaders = getMatchingHostHeaders;
        interface.getAllowedDataTypes = getAllowedDataTypes;
    }

    return interface;

    // Thanks Mozilla: https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_.22Unicode_Problem.22
    function b64EncodeUnicode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
    }

    function mergeHeaders(globalHeaders, localHeaders) {
        var globalKeys = Object.keys(globalHeaders);
        var key;

        for (var i = 0; i < globalKeys.length; i++) {
            key = globalKeys[i];

            if (!localHeaders.hasOwnProperty(key)) {
                localHeaders[key] = globalHeaders[key];
            }
        }

        return localHeaders;
    }

    function checkForValidStringValue(list, value, onInvalidValueMessage) {
        if (jsUtil.getTypeOf(value) !== 'String') {
            throw new Error(onInvalidValueMessage + ' ' + list.join(', '));
        }

        value = value.trim().toLowerCase();

        if (list.indexOf(value) === -1) {
            throw new Error(onInvalidValueMessage + ' ' + list.join(', '));
        }

        return value;
    }

    function checkKeyValuePairObject(obj, allowedChildren, onInvalidValueMessage) {
        if (jsUtil.getTypeOf(obj) !== 'Object') {
            throw new Error(onInvalidValueMessage);
        }

        var keys = Object.keys(obj);

        for (var i = 0; i < keys.length; i++) {
            if (allowedChildren.indexOf(jsUtil.getTypeOf(obj[keys[i]])) === -1) {
                throw new Error(onInvalidValueMessage);
            }
        }

        return obj;
    }

    function checkArray(array, allowedDataTypes, onInvalidValueMessage) {
        if (jsUtil.getTypeOf(array) !== 'Array') {
            throw new Error(onInvalidValueMessage);
        }

        for (var i = 0; i < array.length; ++i) {
            if (allowedDataTypes.indexOf(jsUtil.getTypeOf(array[i])) === -1) {
                throw new Error(onInvalidValueMessage);
            }
        }

        return array;
    }

    function checkHttpMethod(method) {
        return checkForValidStringValue(validHttpMethods, method, messages.INVALID_HTTP_METHOD);
    }

    function checkResponseType(type) {
        return checkForValidStringValue(validResponseTypes, type, messages.INVALID_RESPONSE_TYPE);
    }

    function checkSerializer(serializer) {
        return checkForValidStringValue(validSerializers, serializer, messages.INVALID_DATA_SERIALIZER);
    }

    function checkSSLCertMode(mode) {
        return checkForValidStringValue(validCertModes, mode, messages.INVALID_SSL_CERT_MODE);
    }

    function checkClientAuthMode(mode) {
        return checkForValidStringValue(validClientAuthModes, mode, messages.INVALID_CLIENT_AUTH_MODE);
    }

    function checkClientAuthOptions(mode, options) {
        options = options || {};

        // none
        if (mode === validClientAuthModes[0]) {
            return {
                alias: null,
                rawPkcs: null,
                pkcsPassword: ''
            };
        }

        if (jsUtil.getTypeOf(options) !== 'Object') {
            throw new Error(messages.INVALID_CLIENT_AUTH_OPTIONS);
        }

        // systemstore
        if (mode === validClientAuthModes[1]) {
            if (jsUtil.getTypeOf(options.alias) !== 'String'
                && jsUtil.getTypeOf(options.alias) !== 'Undefined') {
                throw new Error(messages.INVALID_CLIENT_AUTH_ALIAS);
            }

            return {
                alias: jsUtil.getTypeOf(options.alias) === 'Undefined' ? null : options.alias,
                rawPkcs: null,
                pkcsPassword: ''
            };
        }

        // buffer
        if (mode === validClientAuthModes[2]) {
            if (jsUtil.getTypeOf(options.rawPkcs) !== 'ArrayBuffer') {
                throw new Error(messages.INVALID_CLIENT_AUTH_RAW_PKCS);
            }

            if (jsUtil.getTypeOf(options.pkcsPassword) !== 'String') {
                throw new Error(messages.INVALID_CLIENT_AUTH_PKCS_PASSWORD);
            }

            return {
                alias: null,
                rawPkcs: options.rawPkcs,
                pkcsPassword: options.pkcsPassword
            }
        }
    }

    function checkForBlacklistedHeaderKey(key) {
        if (key.toLowerCase() === 'cookie') {
            throw new Error(messages.ADDING_COOKIES_NOT_SUPPORTED);
        }

        return key;
    }

    function checkForInvalidHeaderValue(value) {
        var type = jsUtil.getTypeOf(value);

        if (type !== 'String' && type !== 'Null') {
            throw new Error(messages.INVALID_HEADER_VALUE);
        }

        return value;
    }

    function checkTimeoutValue(timeout) {
        if (jsUtil.getTypeOf(timeout) !== 'Number' || timeout < 0) {
            throw new Error(messages.INVALID_TIMEOUT_VALUE);
        }

        return timeout;
    }

    function checkFollowRedirectValue(follow) {
        if (jsUtil.getTypeOf(follow) !== 'Boolean') {
            throw new Error(messages.INVALID_FOLLOW_REDIRECT_VALUE);
        }

        return follow;
    }

    function checkHeadersObject(headers) {
        return checkKeyValuePairObject(headers, ['String'], messages.TYPE_MISMATCH_HEADERS);
    }

    function checkParamsObject(params) {
        return checkKeyValuePairObject(params, ['String', 'Array'], messages.TYPE_MISMATCH_PARAMS);
    }

    function checkDownloadFilePath(filePath) {
        if (!filePath || jsUtil.getTypeOf(filePath) !== 'String') {
            throw new Error(messages.INVALID_DOWNLOAD_FILE_PATH);
        }

        return filePath;
    }

    function checkUploadFileOptions(filePaths, names) {
        if (jsUtil.getTypeOf(filePaths) === 'String') {
            filePaths = [filePaths];
        }

        if (jsUtil.getTypeOf(names) === 'String') {
            names = [names];
        }

        var opts = {
            filePaths: checkArray(filePaths, ['String'], messages.TYPE_MISMATCH_FILE_PATHS),
            names: checkArray(names, ['String'], messages.TYPE_MISMATCH_NAMES)
        };

        if (!opts.filePaths.length) {
            throw new Error(messages.EMPTY_FILE_PATHS);
        }

        if (!opts.names.length) {
            throw new Error(messages.EMPTY_NAMES);
        }

        return opts;
    }

    function resolveCookieString(headers) {
        var keys = Object.keys(headers || {});

        for (var i = 0; i < keys.length; ++i) {
            if (keys[i].match(/^set-cookie$/i)) {
                return headers[keys[i]];
            }
        }

        return null;
    }

    function createFileEntry(rawEntry) {
        var entry = new (require('cordova-plugin-file.FileEntry'))();

        entry.isDirectory = rawEntry.isDirectory;
        entry.isFile = rawEntry.isFile;
        entry.name = rawEntry.name;
        entry.fullPath = rawEntry.fullPath;
        entry.filesystem = new FileSystem(rawEntry.filesystemName || (rawEntry.filesystem == global.PERSISTENT ? 'persistent' : 'temporary'));
        entry.nativeURL = rawEntry.nativeURL;

        return entry;
    }

    function injectCookieHandler(url, cb) {
        return function (response) {
            cookieHandler.setCookieFromString(url, resolveCookieString(response.headers));
            cb(response);
        }
    }

    function injectRawResponseHandler(responseType, success, failure) {
        return function (response) {
            var dataType = jsUtil.getTypeOf(response.data);

            // don't need post-processing if it's already binary type (on browser platform)
            if (dataType === 'ArrayBuffer' || dataType === 'Blob') {
                return success(response);
            }

            try {
                // json
                if (responseType === validResponseTypes[1]) {
                    response.data = response.data === ''
                        ? undefined
                        : JSON.parse(response.data);
                }

                // arraybuffer
                else if (responseType === validResponseTypes[2]) {
                    response.data = response.data === ''
                        ? null
                        : base64.toArrayBuffer(response.data);
                }

                // blob
                else if (responseType === validResponseTypes[3]) {
                    if (response.data === '') {
                        response.data = null;
                    } else {
                        var buffer = base64.toArrayBuffer(response.data);
                        var type = response.headers['content-type'] || '';
                        var blob = new Blob([buffer], { type: type });
                        response.data = blob;
                    }
                }

                success(response);
            } catch (error) {
                failure({
                    status: errorCodes.POST_PROCESSING_FAILED,
                    error: messages.POST_PROCESSING_FAILED + ' ' + error.message,
                    url: response.url,
                    headers: response.headers
                });
            }
        }
    }

    function injectFileEntryHandler(cb) {
        return function (response) {
            var fileEntry = createFileEntry(response.file);
            response.file = fileEntry;
            response.data = fileEntry;
            cb(fileEntry, response);
        }
    }

    function getCookieHeader(url) {
        var cookieString = cookieHandler.getCookieString(url);

        if (cookieString.length) {
            return { Cookie: cookieHandler.getCookieString(url) };
        }

        return {};
    }

    function getMatchingHostHeaders(url, headersList) {
        var matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
        var domain = matches && matches[1];

        return headersList[domain] || null;
    }

    function getMergedHeaders(url, requestHeaders, predefinedHeaders) {
        var globalHeaders = predefinedHeaders['*'] || {};
        var hostHeaders = getMatchingHostHeaders(url, predefinedHeaders) || {};
        var mergedHeaders = mergeHeaders(globalHeaders, hostHeaders);

        mergedHeaders = mergeHeaders(mergedHeaders, requestHeaders);
        mergedHeaders = mergeHeaders(mergedHeaders, getCookieHeader(url));

        return mergedHeaders;
    }

    function getAllowedDataTypes(dataSerializer) {
        switch (dataSerializer) {
            case 'utf8':
                return ['String'];
            case 'urlencoded':
                return ['Object'];
            case 'json':
                return ['Array', 'Object'];
            case 'raw':
                return ['Uint8Array', 'ArrayBuffer'];
            default:
                return [];
        }
    }

    function getAllowedInstanceTypes(dataSerializer) {
        return dataSerializer === 'multipart' ? ['FormData'] : null;
    }

    function processData(data, dataSerializer, cb) {
        var currentDataType = jsUtil.getTypeOf(data);
        var allowedDataTypes = getAllowedDataTypes(dataSerializer);
        var allowedInstanceTypes = getAllowedInstanceTypes(dataSerializer);

        if (allowedInstanceTypes) {
            var isCorrectInstanceType = false;

            allowedInstanceTypes.forEach(function (type) {
                if ((global[type] && data instanceof global[type]) || (ponyfills[type] && data instanceof ponyfills[type])) {
                    isCorrectInstanceType = true;
                }
            });

            if (!isCorrectInstanceType) {
                throw new Error(messages.INSTANCE_TYPE_MISMATCH_DATA + ' ' + allowedInstanceTypes.join(', '));
            }
        }

        if (!allowedInstanceTypes && allowedDataTypes.indexOf(currentDataType) === -1) {
            throw new Error(messages.TYPE_MISMATCH_DATA + ' ' + allowedDataTypes.join(', '));
        }

        switch (dataSerializer) {
            case 'utf8':
                return cb({ text: data });
            case 'raw':
                return cb(currentDataType === 'Uint8Array' ? data.buffer : data);
            case 'multipart':
                return processFormData(data, cb);
            default:
                return cb(data);
        }
    }

    function processFormData(data, cb) {
        dependencyValidator.checkBlobApi();
        dependencyValidator.checkFileReaderApi();
        dependencyValidator.checkTextEncoderApi();
        dependencyValidator.checkFormDataInstance(data);

        var textEncoder = new global.TextEncoder('utf8');
        var iterator = data.entries();

        var result = {
            buffers: [],
            names: [],
            fileNames: [],
            types: []
        };

        processFormDataIterator(iterator, textEncoder, result, cb);
    }

    function processFormDataIterator(iterator, textEncoder, result, onFinished) {
        var entry = iterator.next();

        if (entry.done) {
            return onFinished(result);
        }

        if (entry.value[1] instanceof global.Blob || entry.value[1] instanceof global.File) {
            var reader = new global.FileReader();

            reader.onload = function () {
                result.buffers.push(base64.fromArrayBuffer(reader.result));
                result.names.push(entry.value[0]);
                result.fileNames.push(entry.value[1].name !== undefined ? entry.value[1].name : 'blob');
                result.types.push(entry.value[1].type || '');
                processFormDataIterator(iterator, textEncoder, result, onFinished);
            };

            return reader.readAsArrayBuffer(entry.value[1]);
        }

        if (jsUtil.getTypeOf(entry.value[1]) === 'String') {
            result.buffers.push(base64.fromArrayBuffer(textEncoder.encode(entry.value[1]).buffer));
            result.names.push(entry.value[0]);
            result.fileNames.push(null);
            result.types.push('text/plain');

            return processFormDataIterator(iterator, textEncoder, result, onFinished)
        }

        // skip items which are not supported
        processFormDataIterator(iterator, textEncoder, result, onFinished);
    }

    function handleMissingCallbacks(successFn, failFn) {
        if (jsUtil.getTypeOf(successFn) !== 'Function') {
            throw new Error(messages.MANDATORY_SUCCESS);
        }

        if (jsUtil.getTypeOf(failFn) !== 'Function') {
            throw new Error(messages.MANDATORY_FAIL);
        }
    }

    function handleMissingOptions(options, globals) {
        options = options || {};

        return {
            data: jsUtil.getTypeOf(options.data) === 'Undefined' ? null : options.data,
            filePath: options.filePath,
            followRedirect: checkFollowRedirectValue(options.followRedirect || globals.followRedirect),
            headers: checkHeadersObject(options.headers || {}),
            method: checkHttpMethod(options.method || validHttpMethods[0]),
            name: options.name,
            params: checkParamsObject(options.params || {}),
            responseType: checkResponseType(options.responseType || validResponseTypes[0]),
            serializer: checkSerializer(options.serializer || globals.serializer),
            connectTimeout: checkTimeoutValue(options.connectTimeout || globals.connectTimeout),
            readTimeout: checkTimeoutValue(options.readTimeout || globals.readTimeout),
            timeout: checkTimeoutValue(options.timeout || globals.timeout)
        };
    }
})(window, jsUtil, cookieHandler, messages, base64, errorCodes, dependencyValidator, ponyfills);
var urlUtil = (function init(jsUtil) {
    return {
        parseUrl: parseUrl,
        appendQueryParamsString: appendQueryParamsString,
        serializeQueryParams: serializeQueryParams
    }

    function parseUrl(url) {
        var match = url.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);

        return match && {
            protocol: match[1],
            host: match[2],
            hostname: match[3],
            port: match[4] || '',
            pathname: match[5],
            search: match[6],
            hash: match[7]
        }
    }

    function appendQueryParamsString(url, params) {
        if (!url.length || !params.length) {
            return url;
        }

        var parsed = parseUrl(url);

        return parsed.protocol
            + '//'
            + parsed.host
            + parsed.pathname
            + (parsed.search.length ? parsed.search + '&' + params : '?' + params)
            + parsed.hash;
    }

    function serializeQueryParams(params, encode) {
        return serializeObject('', params, encode);
    }

    function serializeObject(parentKey, object, encode) {
        var parts = [];

        for (var key in object) {
            if (!object.hasOwnProperty(key)) {
                continue;
            }

            var identifier = parentKey.length ? parentKey + '[' + key + ']' : key;

            if (jsUtil.getTypeOf(object[key]) === 'Array') {
                parts.push(serializeArray(identifier, object[key], encode));
                continue;
            } else if (jsUtil.getTypeOf(object[key]) === 'Object') {
                parts.push(serializeObject(identifier, object[key], encode));
                continue;
            }

            parts.push(serializeIdentifier(parentKey, key, encode) + '=' + serializeValue(object[key], encode));
        }

        return parts.join('&');
    }

    function serializeArray(parentKey, array, encode) {
        var parts = [];

        for (var i = 0; i < array.length; ++i) {
            if (jsUtil.getTypeOf(array[i]) === 'Array') {
                parts.push(serializeArray(parentKey + '[]', array[i], encode));
                continue;
            } else if (jsUtil.getTypeOf(array[i]) === 'Object') {
                parts.push(serializeObject(parentKey + '[]' + array[i], encode));
                continue;
            }

            parts.push(serializeIdentifier(parentKey, '', encode) + '=' + serializeValue(array[i], encode));
        }

        return parts.join('&');
    }

    function serializeIdentifier(parentKey, key, encode) {
        if (!parentKey.length) {
            return encode ? encodeURIComponent(key) : key;
        }

        if (encode) {
            return encodeURIComponent(parentKey) + '[' + encodeURIComponent(key) + ']';
        } else {
            return parentKey + '[' + key + ']';
        }
    }

    function serializeValue(value, encode) {
        if (encode) {
            return encodeURIComponent(value);
        } else {
            return value;
        }
    }
})(jsUtil);
var publicInterface = (function init(exec, cookieHandler, urlUtil, helpers, globalConfigs, errorCodes, ponyfills) {
    var publicInterface = {
        getBasicAuthHeader: getBasicAuthHeader,
        useBasicAuth: useBasicAuth,
        getHeaders: getHeaders,
        setHeader: setHeader,
        getDataSerializer: getDataSerializer,
        setDataSerializer: setDataSerializer,
        setCookie: setCookie,
        clearCookies: clearCookies,
        removeCookies: removeCookies,
        getCookieString: getCookieString,
        getRequestTimeout: getRequestTimeout,
        setRequestTimeout: setRequestTimeout,
        getFollowRedirect: getFollowRedirect,
        setFollowRedirect: setFollowRedirect,
        // @Android Only
        getConnectTimeout: getConnectTimeout,
        // @Android Only
        setConnectTimeout: setConnectTimeout,
        getReadTimeout: getReadTimeout,
        setReadTimeout: setReadTimeout,
        setServerTrustMode: setServerTrustMode,
        setClientAuthMode: setClientAuthMode,
        sendRequest: sendRequest,
        post: post,
        put: put,
        patch: patch,
        get: get,
        delete: del,
        head: head,
        options: options,
        uploadFile: uploadFile,
        downloadFile: downloadFile,
        abort: abort,
        ErrorCode: errorCodes,
        ponyfills: ponyfills
    };

    function getBasicAuthHeader(username, password) {
        return { 'Authorization': 'Basic ' + helpers.b64EncodeUnicode(username + ':' + password) };
    }

    function useBasicAuth(username, password) {
        this.setHeader('*', 'Authorization', 'Basic ' + helpers.b64EncodeUnicode(username + ':' + password));
    }

    function getHeaders(host) {
        return globalConfigs.headers[host || '*'] || null;
    }

    function setHeader() {
        // this one is for being backward compatible
        var host = '*';
        var header = arguments[0];
        var value = arguments[1];

        if (arguments.length === 3) {
            host = arguments[0];
            header = arguments[1];
            value = arguments[2];
        }

        helpers.checkForBlacklistedHeaderKey(header);
        helpers.checkForInvalidHeaderValue(value);

        globalConfigs.headers[host] = globalConfigs.headers[host] || {};

        if (value === null) {
            delete globalConfigs.headers[host][header];
        } else {
            globalConfigs.headers[host][header] = value;
        }
    }

    function getDataSerializer() {
        return globalConfigs.serializer;
    }

    function setDataSerializer(serializer) {
        globalConfigs.serializer = helpers.checkSerializer(serializer);
    }

    function setCookie(url, cookie, options) {
        cookieHandler.setCookie(url, cookie, options);
    }

    function clearCookies() {
        cookieHandler.clearCookies();
    }

    function removeCookies(url, callback) {
        cookieHandler.removeCookies(url, callback);
    }

    function getCookieString(url) {
        return cookieHandler.getCookieString(url);
    }

    function getRequestTimeout() {
        return globalConfigs.timeout;
    }

    function setRequestTimeout(timeout) {
        globalConfigs.timeout = helpers.checkTimeoutValue(timeout);
        globalConfigs.connectTimeout = helpers.checkTimeoutValue(timeout);
        globalConfigs.readTimeout = helpers.checkTimeoutValue(timeout);
    }

    function getConnectTimeout() {
        return globalConfigs.connectTimeout;
    }

    function setConnectTimeout(timeout) {
        globalConfigs.connectTimeout = helpers.checkTimeoutValue(timeout);
    }

    function getReadTimeout() {
        return globalConfigs.readTimeout;
    }

    function setReadTimeout(timeout) {
        globalConfigs.readTimeout = helpers.checkTimeoutValue(timeout);
    }

    function getFollowRedirect() {
        return globalConfigs.followRedirect;
    }

    function setFollowRedirect(follow) {
        globalConfigs.followRedirect = helpers.checkFollowRedirectValue(follow);
    }

    function setServerTrustMode(mode, success, failure) {
        helpers.handleMissingCallbacks(success, failure);

        return exec(success, failure, 'CordovaHttpPlugin', 'setServerTrustMode', [helpers.checkSSLCertMode(mode)]);
    }

    function setClientAuthMode() {
        var mode = arguments[0];
        var options = null;
        var success = arguments[1];
        var failure = arguments[2];

        if (arguments.length === 4) {
            options = arguments[1];
            success = arguments[2];
            failure = arguments[3];
        }

        mode = helpers.checkClientAuthMode(mode);
        options = helpers.checkClientAuthOptions(mode, options);

        helpers.handleMissingCallbacks(success, failure);

        return exec(success, failure, 'CordovaHttpPlugin', 'setClientAuthMode', [mode, options.alias, options.rawPkcs, options.pkcsPassword]);
    }

    function sendRequest(url, options, success, failure) {
        helpers.handleMissingCallbacks(success, failure);

        options = helpers.handleMissingOptions(options, globalConfigs);
        url = urlUtil.appendQueryParamsString(url, urlUtil.serializeQueryParams(options.params, true));

        var headers = helpers.getMergedHeaders(url, options.headers, globalConfigs.headers);

        var onFail = helpers.injectCookieHandler(url, failure);
        var onSuccess = helpers.injectCookieHandler(url, helpers.injectRawResponseHandler(options.responseType, success, failure));

        var reqId = helpers.nextRequestId();

        switch (options.method) {
            case 'post':
            case 'put':
            case 'patch':
                helpers.processData(options.data, options.serializer, function (data) {
                    exec(onSuccess, onFail, 'CordovaHttpPlugin', options.method, [url, data, options.serializer, headers, options.connectTimeout, options.readTimeout, options.followRedirect, options.responseType, reqId]);
                });
                break;
            case 'upload':
                var fileOptions = helpers.checkUploadFileOptions(options.filePath, options.name);
                exec(onSuccess, onFail, 'CordovaHttpPlugin', 'uploadFiles', [url, headers, fileOptions.filePaths, fileOptions.names, options.connectTimeout, options.readTimeout, options.followRedirect, options.responseType, reqId]);
                break;
            case 'download':
                var filePath = helpers.checkDownloadFilePath(options.filePath);
                var onDownloadSuccess = helpers.injectCookieHandler(url, helpers.injectFileEntryHandler(success));
                exec(onDownloadSuccess, onFail, 'CordovaHttpPlugin', 'downloadFile', [url, headers, filePath, options.connectTimeout, options.readTimeout, options.followRedirect, reqId]);
                break;
            default:
                exec(onSuccess, onFail, 'CordovaHttpPlugin', options.method, [url, headers, options.connectTimeout, options.readTimeout, options.followRedirect, options.responseType, reqId]);
                break;
        }

        return reqId;
    }

    function post(url, data, headers, success, failure) {
        return publicInterface.sendRequest(url, { method: 'post', data: data, headers: headers }, success, failure);
    };

    function put(url, data, headers, success, failure) {
        return publicInterface.sendRequest(url, { method: 'put', data: data, headers: headers }, success, failure);
    }

    function patch(url, data, headers, success, failure) {
        return publicInterface.sendRequest(url, { method: 'patch', data: data, headers: headers }, success, failure);
    }

    function get(url, params, headers, success, failure) {
        return publicInterface.sendRequest(url, { method: 'get', params: params, headers: headers }, success, failure);
    };

    function del(url, params, headers, success, failure) {
        return publicInterface.sendRequest(url, { method: 'delete', params: params, headers: headers }, success, failure);
    }

    function head(url, params, headers, success, failure) {
        return publicInterface.sendRequest(url, { method: 'head', params: params, headers: headers }, success, failure);
    }

    function options(url, params, headers, success, failure) {
        return publicInterface.sendRequest(url, { method: 'options', params: params, headers: headers }, success, failure);
    };

    function uploadFile(url, params, headers, filePath, name, success, failure) {
        return publicInterface.sendRequest(url, { method: 'upload', params: params, headers: headers, filePath: filePath, name: name }, success, failure);
    }

    function downloadFile(url, params, headers, filePath, success, failure) {
        return publicInterface.sendRequest(url, { method: 'download', params: params, headers: headers, filePath: filePath }, success, failure);
    }

    function abort(requestId , success, failure) {
        return exec(success, failure, 'CordovaHttpPlugin', 'abort', [requestId]);
    }

    return publicInterface;
})(exec, cookieHandler, urlUtil, helpers, globalConfigs, errorCodes, ponyfills);

dependencyValidator.logWarnings();

module.exports = publicInterface;

});