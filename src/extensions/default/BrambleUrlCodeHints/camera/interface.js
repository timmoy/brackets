/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, Audio, clearTimeout */

// A module that provides UI utility for every component needed for taking
// a picture
define(function (require, exports, module) {
    "use strict";

    var selfieWidgetHTML = require("text!camera/selfieWidget.html");
    var base64ToBuffer = require("camera/utils").base64ToBuffer;
    var shutter;

    // We hardcode the width of the video interface for now
    var _width = 320;

    // Shutter animation of a camera
    function playSnapAnimation() {
        $("#selfie-video-bg").addClass("on");
        shutter.play();
        var openShutter = setTimeout(function() {
            clearTimeout(openShutter);
            $("#selfie-video-bg").removeClass("on");
        }, 105);
    }

    function Interface(camera) {
        this.camera = camera;
        this.video = camera.video;
        this.photo = camera.photo;
        this.canvas = this.photo.canvas;
    }

    // Initialize all interfaces needed for the selfie taker
    Interface.prototype.init = function() {
        // Replace the request-access message with camera components
        var selfieContainer = $("#selfie-container");
        $("#selfie-allow-access").remove();
        selfieContainer.prepend(selfieWidgetHTML);

        // Camera component initialization
        this.video.interface = document.getElementById("selfie-video");
        this.photo.interface = document.getElementById("selfie-photo");
        this.canvas.interface = document.getElementById("selfie-canvas");

        // Camera buttons
        this.snapButton = document.getElementById("selfie-snap");
        this.saveButton = document.getElementById("selfie-use");
        this.saveButton.style.display = "initial";

        // Lazy-load shutter sound
        if(!shutter) {
            shutter = new Audio("./extensions/default/BrambleUrlCodeHints/camera/camera-shutter-click-08.mp3");
        }
    };

    // Set the video height
    Interface.prototype.setCameraSize = function(height) {
        this._height = height;
        this.video.interface.setAttribute("height", height);
        this.video.interface.setAttribute("width", _width);
        this.canvas.interface.setAttribute("height", height);
        this.canvas.interface.setAttribute("width", _width);
    };

    // Enable the Snap icon for the camera
    Interface.prototype.enableSnapIcon = function() {
        var self = this;

        this.snapButton.addEventListener("click", function(event) {
            event.preventDefault();

            self.saveButton.removeAttribute("disabled");
            playSnapAnimation();
            self.snapPhoto();
        });
    };

    // Read the snapped photo bytes and persist it
    Interface.prototype.snapPhoto = function() {
        if(!this._height) {
            return this.camera.fail();
        }

        var self = this;

        function persistPhoto() {
            var data = self.photo.data;
            if(!data) {
                return self.camera.fail();
            }

            var binaryDataStr;
            if(img.src){
              console.log("copy of image is here");
              Caman(img, function () {
                this.brightness(5);
                this.render(function () {
                  this.save(img.src+".png");
                });
              });
              binaryDataStr = /^data:image\/png;base64,(.+)/.exec(img.src+".png")[1];
              console.log("alternate saved");
            }else{
              binaryDataStr = /^data:image\/png;base64,(.+)/.exec(data)[1];
            }

            self.camera.savePhoto(base64ToBuffer(binaryDataStr));
        }

        /*function updateFilter(){
        +      var select = document.getElementById("filters-select");
        +      if(select.options[select.selectedIndex].value != "none"){
        +        //alert(select.options[select.selectedIndex].value + " filter applied");
        +        document.getElementById("selfie-photo").className = "polaroid " + select.options[select.selectedIndex].value;
        +      }else{
        +        document.getElementById("selfie-photo").className = "polaroid";
        +      }
        +    }*/


        var context = this.canvas.interface.getContext("2d");
        this.canvas.interface.width = _width;
        this.canvas.interface.height = this._height;
        context.drawImage(this.video.interface, 0, 0, _width, this._height);

        // Update the photo component with the snapped photo
        this.photo.update();

        //pattern from http://tutorialzine.com/2013/02/instagram-filter-app/
        //$(function() {

          //var Caman = require('caman').Caman;
          var canvas = document.getElementById("canvas");
          var ctx = canvas.getContext('2d');

          /* Enable Cross Origin Image Editing */
          var img = new Image();
          img.crossOrigin = '';
          img.src = self.photo.data;
          console.log("img width: "+ img.width + " height " + img.height + "source: " + img.src);

          img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            console.log("loaded width: "+ img.width + " height " + img.height);
            ctx.drawImage(img, 0, 0, img.width, img.height);
          }

          var $reset = $('#resetbtn');
          var $pinhole = $('#pinholebtn');
          $reset.on('click', function(e) {
            $('input[type=range]').val(0);
            Caman('#canvas', img, function() {
              this.revert(false);
              this.render();
              console.log("reset");
            });
          });

          /* In built filters */
          $pinhole.on('click', function(e) {
            Caman('#canvas', img, function() {
              this.pinhole().render();
              console.log("filtered");
            });
          });

          // Listen for clicks on the filters

          /*filters.click(function(e){
            console.log("clicked");

            Caman("#selfie-canvas", function () {
              this.invert();
              console.log("inverted");
              this.render();
              console.log("rendered");
            });
          });//end of click*/
        //});
        //end of pattern

        this.saveButton.removeEventListener("click", persistPhoto);
        this.saveButton.addEventListener("click", persistPhoto);
    };

    // Get the width of the video
    Interface.prototype.getWidth = function() {
        return _width;
    };

    module.exports = Interface;
});
