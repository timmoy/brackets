$(function() {
    "use strict";

    var CommandManager = brackets.getModule("command/CommandManager");
    var Commands       = brackets.getModule("command/Commands");
    var fs             = brackets.getModule("fileSystemImpl");
    var Buffer         = brackets.getModule("filesystem/impls/filer/BracketsFiler").Buffer;

    function savePhoto(){
        Caman(canvas, function () {
            this.render(function () {
                var image = this.toBase64();
                var binaryDataStr = /^data:image\/png;base64,(.+)/.exec(image)[1];
                //self.camera.savePhoto(base64ToBuffer(binaryDataStr));
                var binary = window.atob(binaryDataStr);
                var len = binary.length;
                var bytes = new Uint8Array(len);
                for(var i = 0; i < len; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                var data = new Buffer(bytes.buffer);
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
