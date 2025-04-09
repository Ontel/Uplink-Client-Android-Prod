cordova.define("cordova-plugin-advanced-http.global-configs", function(exports, module) {

var globalConfigs = {
  headers: {},
  serializer: 'urlencoded',
  followRedirect: true,
  timeout: 60.0,
  connectTimeout: 60.0,
  readTimeout: 60.0
};

module.exports = globalConfigs;

});
