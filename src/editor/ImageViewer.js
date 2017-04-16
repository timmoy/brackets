/*
 * Copyright (c) 2013 - present Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

define(function (require, exports, module) {
    "use strict";

    var DocumentManager     = require("document/DocumentManager"),
        ImageViewTemplate   = require("text!htmlContent/image-view.html"),
        ProjectManager      = require("project/ProjectManager"),
        PreferencesManager  = require("preferences/PreferencesManager"),
        LanguageManager     = require("language/LanguageManager"),
        MainViewFactory     = require("view/MainViewFactory"),
        Strings             = require("strings"),
        StringUtils         = require("utils/StringUtils"),
        FileSystem          = require("filesystem/FileSystem"),
        BlobUtils           = require("filesystem/impls/filer/BlobUtils"),
        FileUtils           = require("file/FileUtils"),
        _                   = require("thirdparty/lodash"),
        Mustache            = require("thirdparty/mustache/mustache");

    // Vibrant doesn't seem to play well with requirejs AMD loading, load it globally.
    require("thirdparty/Vibrant");
    require("thirdparty/caman/caman.full.min");
    console.log("Requires done");

    var _viewers = {};

    var _slice = Function.prototype.call.bind(Array.prototype.slice);

    // Get a Blob URL out of the cache
    function _getImageUrl(file) {
        return BlobUtils.getUrl(file.fullPath);
    }

    // Use Vibrant.js to try and extract color info. This is possible for
    // most, but not all image types (e.g., svg).
    function _extractColors(pane, img) {
        var swatchElems = _slice(pane.find(".image-view-swatch"));
        var hexElems = _slice(pane.find(".image-view-hex"));
        var swatches;
        var i = 0;

        try {
            var vibrant = new window.Vibrant(img);
            swatches = vibrant.swatches();
            $(".image-view-swatches").removeClass("hide");
        } catch(e) {
            // Hide the color swatches, since we can't display anything
            $(".image-view-swatches").addClass("hide");
            return;
        }

        Object.keys(swatches).forEach(function(swatch) {
            var swatchColor = swatchElems[i];
            var swatchHex = hexElems[i];

            var hex = swatches[swatch] && swatches[swatch].getHex();
            // Sometimes there isn't a LightMuted color
            if(!hex) {
                return;
            }

            swatchColor.style.backgroundColor = hex;
            swatchHex.textContent = hex;
            i++;
        });
    }

    /**
     * ImageView objects are constructed when an image is opened
     * @see {@link Pane} for more information about where ImageViews are rendered
     *
     * @constructor
     * @param {!File} file - The image file object to render
     * @param {!jQuery} container - The container to render the image view in
     */
    function ImageView(file, $container) {
        this.file = file;
        this.$el = $(Mustache.render(ImageViewTemplate, {imgUrl: _getImageUrl(file)}));

        $container.append(this.$el);

        this._naturalWidth = 0;
        this._naturalHeight = 0;
        this._scale = 100;           // 100%
        this._scaleDivInfo = null;   // coordinates of hidden scale sticker

        this.relPath = ProjectManager.makeProjectRelativeIfPossible(this.file.fullPath);

        this.$imagePath = this.$el.find(".image-path");
        this.$imagePreview = this.$el.find(".image-preview");
        this.$imageData = this.$el.find(".image-data");

        this.$image = this.$el.find(".image");
        this.$imageScale = this.$el.find(".image-scale");
        this.$imagePreview.on("load", _.bind(this._onImageLoaded, this));

        _viewers[file.fullPath] = this;
    }

    /**
     * DocumentManger.fileNameChange handler - when an image is renamed, we must
     * update the view
     *
     * @param {jQuery.Event} e - event
     * @param {!string} oldPath - the name of the file that's changing changing
     * @param {!string} newPath - the name of the file that's changing changing
     * @private
     */
    ImageView.prototype._onFilenameChange = function (e, oldPath, newPath) {
        /*
         * File objects are already updated when the event is triggered
         * so we just need to see if the file has the same path as our image
         */
        if (this.file.fullPath === newPath) {
            this.relPath = ProjectManager.makeProjectRelativeIfPossible(newPath);
        }
    };

    /**
     * <img>.on("load") handler - updates content of the image view
     *                            initializes computed values
     *                            installs event handlers
     * @param {Event} e - event
     * @private
     */
    ImageView.prototype._onImageLoaded = function (e) {
        // add dimensions and size
        this._naturalWidth = e.currentTarget.naturalWidth;
        this._naturalHeight = e.currentTarget.naturalHeight;

        var extension = FileUtils.getFileExtension(this.file.fullPath);

        var stringFormat = Strings.IMAGE_DIMENSIONS;
        var dimensionString = StringUtils.format(stringFormat, this._naturalWidth, this._naturalHeight);

        if (extension === "ico") {
            dimensionString += " (" + Strings.IMAGE_VIEWER_LARGEST_ICON + ")";
        }

        // get image size
        var self = this;

        this.file.stat(function (err, stat) {
            if (err) {
                self.$imageData.html(dimensionString);
            } else {
                var sizeString = "";
                if (stat.size) {
                    sizeString = " &mdash; " + StringUtils.prettyPrintBytes(stat.size, 2);
                }
                var dimensionAndSize = dimensionString + sizeString;
                self.$imageData.html(dimensionAndSize)
                .attr("title", dimensionAndSize.replace("&mdash;", "-"));
            }
        });

        // make sure we always show the right file name
        DocumentManager.on("fileNameChange.ImageView", _.bind(this._onFilenameChange, this));

        this._updateScale();

        _extractColors(this.$el, e.currentTarget);

        $(function() {

            var CommandManager = brackets.getModule("command/CommandManager");
            var Commands       = brackets.getModule("command/Commands");
            var fs             = brackets.getModule("fileSystemImpl");
            var Buffer         = brackets.getModule("filesystem/impls/filer/BracketsFiler").Buffer;

            function savePhoto(){
                Caman(canvas, function () {
                    this.render(function () {
                        var image = this.toBase64();
                        console.log("image: " + image);
                        var binaryDataStr = /^data:image\/png;base64,(.+)/.exec(image)[1];
                        //self.camera.savePhoto(base64ToBuffer(binaryDataStr));
                        console.log("binary data str: " + binaryDataStr);
                        var binary = window.atob(binaryDataStr);
                        console.log("binary: " + binary);
                        var len = binary.length;
                        console.log("len: " + len);
                        var bytes = new Uint8Array(len);
                        console.log("New bytes: " + bytes);
                        for(var i = 0; i < len; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        console.log("Processed bytes: " + bytes);
                        var data = new Buffer(bytes.buffer);
                        console.log("Data: " + data);
                        fs.writeFile(savePath, data, {encoding: null}, function(err) {
                            if(err) {
                                return self.fail(err);
                            }
                            // Update the file tree to show the new file
                            CommandManager.execute(Commands.FILE_REFRESH);
                            console.log("save path: " + savePath);
                        });
                        console.log("attributes: " + canvas.width + ", " + canvas.height);
                    });
                });
                console.log("photo saved");
            }

            /*
            Can't use this pattern at the moment since the Caman function won't run before
            canvas is assigned (the image element gets loaded before it gets replaced
            with the  canvas element)

            Caman("#image-canvas", function () {
              this.render();
              console.log("tried to replace image with canvas");
            });

            var canvas = document.getElementById('image-canvas');*/

            var canvas = document.getElementById('temp-canvas');
            console.log("canvas is: " + canvas);
            //var ctx = canvas.getContext('2d');

            /* Enable Cross Origin Image Editing */
            var img = new Image();
            img.crossOrigin = '';
            /*need to get the url from the <img> due to the way images are loaded
            into the image viewer, so we load the original image into a 0x0 pixel
            image and allow {{imgUrl}} to call the image-viewer function which
            sets the url that we end up using*/
            img.src = document.getElementById('image-canvas').src;
            var savePath = img.src;
            console.log("img has src = " + img.src );

            Caman("#temp-canvas", img.src, function () {
                // this is the new loading pattern
                this.render();
            });

            var $reset = $('#resetbtn');
            var $pinhole = $('#pinholebtn');
            var $contrast = $('#contrastbtn');
            var $sepia = $('#sepiabtn');
            var $vintage = $('#vintagebtn');
            var $emboss = $('#embossbtn');
            var $sunrise = $('#sunrisebtn');
            var $glowingSun = $('#glowingsunbtn');
            var $save = $('#savebtn');

            $reset.on('click', function(e) {
                $('input[type=range]').val(0);
                Caman(canvas, function() {
                    this.revert(false);
                    this.render();
                    console.log("reset");
                });
            });
            /* Filters */
            $pinhole.on('click', function(e) {
                Caman(canvas, function() { // canvas id reference here to enable scrolling
                    this.pinhole().render();
                    console.log("filtered: pinhole");
                });
            });
            $contrast.on('click', function(e) {
                Caman(canvas, function() {
                    this.contrast(10).render();
                    console.log("filtered: contrast");
                });
            });
            $sepia.on('click', function(e) {
                Caman(canvas, function() {
                    this.sepia(20).render();
                    console.log("filtered: sepia");
                });
            });
            $vintage.on('click', function(e) {
                Caman(canvas, function() {
                    this.vintage().render();
                    console.log("filtered: vintage");
                });
            });
            $emboss.on('click', function(e) {
                Caman(canvas, function() {
                    this.emboss().render();
                    console.log("filtered: emboss");
                });
            });
            $sunrise.on('click', function(e) {
                Caman(canvas, function() {
                    this.sunrise().render();
                    console.log("filtered: sunrise");
                });
            });
            $glowingSun.on('click', function(e) {
                Caman(canvas, function() {
                    this.glowingSun().render();
                    console.log("filtered: glowing sun");
                });
            });
            $save.on('click', function(e) {
                Caman(canvas, img.src, function() {
                    this.render(function() {
                        //this.save('png');
                        savePhoto();
                    });
                });
            });
        });
    };

    /**
     * Update the scale element
     * @private
     */
    ImageView.prototype._updateScale = function () {
        var currentWidth = this.$imagePreview.width();

        if (currentWidth && currentWidth < this._naturalWidth) {
            this._scale = currentWidth / this._naturalWidth * 100;
            this.$imageScale.text(Math.floor(this._scale) + "%")
                // Keep the position of the image scale div relative to the image.
                .css("left", this.$imagePreview.position().left + 5)
                .show();
        } else {
            // Reset everything related to the image scale sticker before hiding it.
            this._scale = 100;
            this._scaleDivInfo = null;
            this.$imageScale.text("").hide();
        }
    };

    /**
     * Check mouse entering/exiting the scale sticker.
     * Hide it when entering and show it again when exiting.
     *
     * @param {number} offsetX mouse offset from the left of the previewing image
     * @param {number} offsetY mouseoffset from the top of the previewing image
     * @private
     */
    ImageView.prototype._handleMouseEnterOrExitScaleSticker = function (offsetX, offsetY) {
        var imagePos       = this.$imagePreview.position(),
            scaleDivPos    = this.$imageScale.position(),
            imgWidth       = this.$imagePreview.width(),
            imgHeight      = this.$imagePreview.height(),
            scaleDivLeft,
            scaleDivTop,
            scaleDivRight,
            scaleDivBottom;

        if (this._scaleDivInfo) {
            scaleDivLeft   = this._scaleDivInfo.left;
            scaleDivTop    = this._scaleDivInfo.top;
            scaleDivRight  = this._scaleDivInfo.right;
            scaleDivBottom = this._scaleDivInfo.bottom;

            if ((imgWidth + imagePos.left) < scaleDivRight) {
                scaleDivRight = imgWidth + imagePos.left;
            }

            if ((imgHeight + imagePos.top) < scaleDivBottom) {
                scaleDivBottom = imgHeight + imagePos.top;
            }

        } else {
            scaleDivLeft   = scaleDivPos.left;
            scaleDivTop    = scaleDivPos.top;
            scaleDivRight  = this.$imageScale.width() + scaleDivLeft;
            scaleDivBottom = this.$imageScale.height() + scaleDivTop;
        }

        if (this._scaleDivInfo) {
            // See whether the cursor is no longer inside the hidden scale div.
            // If so, show it again.
            if ((offsetX < scaleDivLeft || offsetX > scaleDivRight) ||
                    (offsetY < scaleDivTop || offsetY > scaleDivBottom)) {
                this._scaleDivInfo = null;
                this.$imageScale.show();
            }
        } else if ((offsetX >= scaleDivLeft && offsetX <= scaleDivRight) &&
                (offsetY >= scaleDivTop && offsetY <= scaleDivBottom)) {
            // Handle mouse inside image scale div.
            // But hide it only if the pixel under mouse is also in the image.
            if (offsetX < (imagePos.left + imgWidth) &&
                    offsetY < (imagePos.top + imgHeight)) {
                // Remember image scale div coordinates before hiding it.
                this._scaleDivInfo = {left: scaleDivPos.left,
                                 top: scaleDivPos.top,
                                 right: scaleDivRight,
                                 bottom: scaleDivBottom};
                this.$imageScale.hide();
            }
        }
    };

    /**
     * View Interface functions
     */

    /*
     * Retrieves the file object for this view
     * return {!File} the file object for this view
     */
    ImageView.prototype.getFile = function () {
        return this.file;
    };

    /*
     * Updates the layout of the view
     */
    ImageView.prototype.updateLayout = function () {
        var $container = this.$el.parent();

        var pos = $container.position(),
            iWidth = $container.innerWidth(),
            iHeight = $container.innerHeight(),
            oWidth = $container.outerWidth(),
            oHeight = $container.outerHeight();

        // $view is "position:absolute" so
        //  we have to update the height, width and position
        this.$el.css({top: pos.top + ((oHeight - iHeight) / 2),
                        left: pos.left + ((oWidth - iWidth) / 2),
                        width: iWidth,
                        height: iHeight});
        this._updateScale();
    };

    /*
     * Destroys the view
     */
    ImageView.prototype.destroy = function () {
        delete _viewers[this.file.fullPath];
        DocumentManager.off(".ImageView");
        this.$image.off(".ImageView");
        this.$el.remove();
    };

    /*
     * Refreshes the image preview with what's on disk
     */
    ImageView.prototype.refresh = function () {
        // Update the DOM node with the src URL
        this.$imagePreview.attr("src", _getImageUrl(this.file));
    };

    /*
     * Creates an image view object and adds it to the specified pane
     * @param {!File} file - the file to create an image of
     * @param {!Pane} pane - the pane in which to host the view
     * @return {jQuery.Promise}
     */
    function _createImageView(file, pane) {
        var view = pane.getViewForPath(file.fullPath);

        if (view) {
            pane.showView(view);
        } else {
            view = new ImageView(file, pane.$content);
            pane.addView(view, true);
        }
        return new $.Deferred().resolve().promise();
    }

    /**
     * Handles file system change events so we can refresh
     *  image viewers for the files that changed on disk due to external editors
     * @param {jQuery.event} event - event object
     * @param {?File} file - file object that changed
     * @param {Array.<FileSystemEntry>=} added If entry is a Directory, contains zero or more added children
     * @param {Array.<FileSystemEntry>=} removed If entry is a Directory, contains zero or more removed children
     */
    function _handleFileSystemChange(event, entry, added, removed) {
        // this may have been called because files were added
        //  or removed to the file system.  We don't care about those
        if (!entry || entry.isDirectory) {
            return;
        }

        // Look for a viewer for the changed file
        var viewer = _viewers[entry.fullPath];

        // viewer found, call its refresh method
        if (viewer) {
            viewer.refresh();
        }
    }

    /*
     * Install an event listener to receive all file system change events
     * so we can refresh the view when changes are made to the image in an external editor
     */
    FileSystem.on("change", _handleFileSystemChange);

    /*
     * Initialization, register our view factory
     */
    MainViewFactory.registerViewFactory({
        canOpenFile: function (fullPath) {
            var lang = LanguageManager.getLanguageForPath(fullPath);
            var svgAsXML = PreferencesManager.get("openSVGasXML");
            var id = lang.getId();

            // Depending on whether or not the user wants to treat SVG files as XML
            // we default to open as an image.
            return id === "image" || (!svgAsXML && id === "svg");
        },
        openFile: function (file, pane) {
            return _createImageView(file, pane);
        }
    });


    /*
     * This is for extensions that want to create a
     * view factory based on ImageViewer
     */
    exports.ImageView = ImageView;
});
