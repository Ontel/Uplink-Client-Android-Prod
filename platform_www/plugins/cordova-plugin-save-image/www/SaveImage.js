cordova.define("cordova-plugin-save-image.SaveImage", function(require, exports, module) {
var ImageSaver = function () {
};

ImageSaver.saveImageToGallery = function (localImagePath, successCallback, failureCallback, albumName) {
    var args = [_getLocalImagePathWithoutPrefix()];

    if (typeof successCallback != 'function') {
        throw new Error('SaveImage Error: successCallback is not a function');
    }

    if (typeof failureCallback != 'function') {
        throw new Error('SaveImage Error: failureCallback is not a function');
    }

    if (albumName) {
        if (typeof albumName != 'string') {
            throw new Error('SaveImage Error: albumName is not a string');
        } else {
            args.push(albumName);
        }
    }

    return cordova.exec(
        successCallback, failureCallback, 'SaveImage', 'saveImageToGallery', args);

    function _getLocalImagePathWithoutPrefix() {
        if (localImagePath.indexOf('file:///') === 0) {
            return localImagePath.substring(7);
        }
        return localImagePath;
    }
};

module.exports = ImageSaver;

});
