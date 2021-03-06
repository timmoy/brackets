/*
 * Copyright (c) 2012 - present Adobe Systems Incorporated. All rights reserved.
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

/*global jQuery */

// TODO: (issue #264) break out the definition of brackets into a separate module from the application controller logic

/**
 * brackets is the root of the Brackets codebase. This file pulls in all other modules as
 * dependencies (or dependencies thereof), initializes the UI, and binds global menus & keyboard
 * shortcuts to their Commands.
 *
 * Unlike other modules, this one can be accessed without an explicit require() because it exposes
 * a global object, window.brackets.
 */
define(function (require, exports, module) {
    "use strict";

    // Load dependent non-module scripts
    require("widgets/bootstrap-dropdown");
    require("widgets/bootstrap-modal");
    require("widgets/bootstrap-twipsy-mod");

    // Load CodeMirror add-ons--these attach themselves to the CodeMirror module
    require("thirdparty/CodeMirror/addon/edit/closebrackets");
    require("thirdparty/CodeMirror/addon/edit/closetag");
    require("thirdparty/CodeMirror/addon/edit/matchbrackets");
    require("thirdparty/CodeMirror/addon/edit/matchtags");
    require("thirdparty/CodeMirror/addon/fold/xml-fold");
    require("thirdparty/CodeMirror/addon/mode/multiplex");
    require("thirdparty/CodeMirror/addon/mode/overlay");
    require("thirdparty/CodeMirror/addon/mode/simple");
    require("thirdparty/CodeMirror/addon/scroll/scrollpastend");
    require("thirdparty/CodeMirror/addon/search/match-highlighter");
    require("thirdparty/CodeMirror/addon/search/searchcursor");
    require("thirdparty/CodeMirror/addon/selection/active-line");
    require("thirdparty/CodeMirror/addon/selection/mark-selection");
    require("thirdparty/CodeMirror/keymap/sublime");

    // XXXBramble: also preload the modes we'll need later, and have them get bundled.
    // See src/language/LanguageManager.js and src/language/languages.json
    require("thirdparty/CodeMirror/mode/meta");
    require("thirdparty/CodeMirror/mode/css/css");
    require("thirdparty/CodeMirror/mode/htmlmixed/htmlmixed");
    require("thirdparty/CodeMirror/mode/javascript/javascript");
    require("thirdparty/CodeMirror/mode/jsx/jsx");
    require("thirdparty/CodeMirror/mode/xml/xml");
    require("thirdparty/CodeMirror/mode/markdown/markdown");

    // Load dependent modules
    var AppInit             = require("utils/AppInit"),
        LanguageManager     = require("language/LanguageManager"),
        FileSyncManager     = require("project/FileSyncManager"),
        PerfUtils           = require("utils/PerfUtils"),
        Strings             = require("strings"),
        ExtensionLoader     = require("utils/ExtensionLoader"),
        Async               = require("utils/Async"),
        UrlParams           = require("utils/UrlParams").UrlParams,
        PreferencesManager  = require("preferences/PreferencesManager"),
        DragAndDrop         = require("utils/DragAndDrop"),
        NativeApp           = require("utils/NativeApp"),
        DeprecationWarning  = require("utils/DeprecationWarning"),
        ViewCommandHandlers = require("view/ViewCommandHandlers");

    var MainViewHTML        = require("text!htmlContent/main-view.html");

    // XXXBramble: load dependent modules that aren't used here (jshint 'defined but never used')
    require("document/DocumentManager");
    require("editor/EditorManager");
    require("language/JSUtils");
    require("project/WorkingSetView");
    require("document/DocumentCommandHandlers");
    require("command/KeyBindingManager");
    require("editor/CodeHintManager");
    require("command/Menus");
    require("utils/ExtensionUtils");
    require("language/CodeInspection");

    // load modules for later use
    require("utils/Global");
    require("editor/CSSInlineEditor");
    require("project/WorkingSetSort");
    require("search/QuickOpen");
    require("search/QuickOpenHelper");
    require("file/FileUtils");
    require("project/SidebarView");
    require("utils/Resizer");
    require("LiveDevelopment/main");
    require("utils/ColorUtils");
    require("view/ThemeManager");
    require("thirdparty/lodash");
    require("language/XMLUtils");
    require("language/JSONUtils");

    // DEPRECATED: In future we want to remove the global CodeMirror, but for now we
    // expose our required CodeMirror globally so as to avoid breaking extensions in the
    // interim.
    var CodeMirror = require("thirdparty/CodeMirror/lib/codemirror");

    Object.defineProperty(window, "CodeMirror", {
        get: function () {
            DeprecationWarning.deprecationWarning('Use brackets.getModule("thirdparty/CodeMirror/lib/codemirror") instead of global CodeMirror.', true);
            return CodeMirror;
        }
    });

    // DEPRECATED: In future we want to remove the global Mustache, but for now we
    // expose our required Mustache globally so as to avoid breaking extensions in the
    // interim.
    var Mustache = require("thirdparty/mustache/mustache");

    Object.defineProperty(window, "Mustache", {
        get: function () {
            DeprecationWarning.deprecationWarning('Use brackets.getModule("thirdparty/mustache/mustache") instead of global Mustache.', true);
            return Mustache;
        }
    });

    // DEPRECATED: In future we want to remove the global PathUtils, but for now we
    // expose our required PathUtils globally so as to avoid breaking extensions in the
    // interim.
    var PathUtils = require("thirdparty/path-utils/path-utils");

    Object.defineProperty(window, "PathUtils", {
        get: function () {
            DeprecationWarning.deprecationWarning('Use brackets.getModule("thirdparty/path-utils/path-utils") instead of global PathUtils.', true);
            return PathUtils;
        }
    });

    // Load modules that self-register and just need to get included in the main project
    require("command/DefaultMenus");
    require("document/ChangedDocumentTracker");
    require("editor/EditorCommandHandlers");
    require("editor/EditorOptionHandlers");
    require("editor/EditorStatusBar");
    require("editor/ImageViewer");
    require("search/FindInFilesUI");
    require("search/FindReplace");

    // Compatibility shim for PanelManager to WorkspaceManager migration
    require("view/PanelManager");

    PerfUtils.addMeasurement("brackets module dependencies resolved");

    // Local variables
    var params = new UrlParams();

    // read URL params
    params.parse();

    /**
     * Setup Brackets
     */
    function _onReady() {
        PerfUtils.addMeasurement("window.document Ready");

        // Use quiet scrollbars if we aren't on Lion. If we're on Lion, only
        // use native scroll bars when the mouse is not plugged in or when
        // using the "Always" scroll bar setting.
        var osxMatch = /Mac OS X 10\D([\d+])\D/.exec(window.navigator.userAgent);
        if (osxMatch && osxMatch[1] && Number(osxMatch[1]) >= 7) {
            // test a scrolling div for scrollbars
            var $testDiv = $("<div style='position:fixed;left:-50px;width:50px;height:50px;overflow:auto;'><div style='width:100px;height:100px;'/></div>").appendTo(window.document.body);

            if ($testDiv.outerWidth() === $testDiv.get(0).clientWidth) {
                $(".sidebar").removeClass("quiet-scrollbars");
            }

            $testDiv.remove();
        }

        // Load default languages and preferences
        Async.waitForAll([LanguageManager.ready, PreferencesManager.ready]).always(function () {
            // Load all extensions. This promise will complete even if one or more
            // extensions fail to load.
            var extensionPathOverride = params.get("extensions");  // used by unit tests
            var extensionLoaderPromise = ExtensionLoader.init(extensionPathOverride ? extensionPathOverride.split(",") : null);

            // Load the initial project after extensions have loaded
            extensionLoaderPromise.always(function () {
               // Signal that extensions are loaded
                AppInit._dispatchReady(AppInit.EXTENSIONS_LOADED);

                // Finish UI initialization
                ViewCommandHandlers.restoreFontSize();

                // XXXBramble: the project loading logic happens based on a message
                // from the hosting app.  See extensions/default/bramble/main.js
            });
        });
    }

    /**
     * Setup event handlers prior to dispatching AppInit.HTML_READY
     */
    function _beforeHTMLReady() {
        // Add the platform (mac, win or linux) to the body tag so we can have platform-specific CSS rules
        $("body").addClass("platform-" + brackets.platform);

        // Browser-hosted version may also have different CSS (e.g. since '#titlebar' is shown)
        if (brackets.inBrowser) {
            $("body").addClass("in-browser");
        } else {
            $("body").addClass("in-appshell");
        }

        // Enable/Disable HTML Menus
        if (brackets.nativeMenus) {
            $("body").addClass("has-appshell-menus");
        } else {
            // (issue #5310) workaround for bootstrap dropdown: prevent the menu item to grab
            // the focus -- override jquery focus implementation for top-level menu items
            (function () {
                var defaultFocus = $.fn.focus;
                $.fn.focus = function () {
                    if (!this.hasClass("dropdown-toggle")) {
                        return defaultFocus.apply(this, arguments);
                    }
                };
            }());
        }
        
        // Localize MainViewHTML and inject.
        // XXXBramble: we don't use <body> here, so that we can do a loading spinner first
        // that will get turned off, and this div shown, in bramble UI.initUI().
        $("#main-view").html(Mustache.render(MainViewHTML, Strings));
        
        // Update title
        $("title").text(brackets.config.app_title);

        // Respond to dragging & dropping files/folders onto the window by opening them. If we don't respond
        // to these events, the file would load in place of the Brackets UI
        DragAndDrop.attachHandlers();

        // TODO: (issue 269) to support IE, need to listen to document instead (and even then it may not work when focus is in an input field?)
        $(window).focus(function () {
            // This call to syncOpenDocuments() *should* be a no-op now that we have
            // file watchers, but is still here as a safety net.
            FileSyncManager.syncOpenDocuments();
        });

        // Prevent unhandled middle button clicks from triggering native behavior
        // Example: activating AutoScroll (see #510)
        $("html").on("mousedown", ".inline-widget", function (e) {
            if (e.button === 1) {
                e.preventDefault();
            }
        });

        // The .no-focus style is added to clickable elements that should
        // not steal focus. Calling preventDefault() on mousedown prevents
        // focus from going to the click target.
        $("html").on("mousedown", ".no-focus", function (e) {
            // Text fields should always be focusable.
            var $target = $(e.target),
                isFormElement =
                    $target.is("input") ||
                    $target.is("textarea") ||
                    $target.is("select");

            if (!isFormElement) {
                e.preventDefault();
            }
        });

        // Prevent clicks on any link from navigating to a different page (which could lose unsaved
        // changes). We can't use a simple .on("click", "a") because of http://bugs.jquery.com/ticket/3861:
        // jQuery hides non-left clicks from such event handlers, yet middle-clicks still cause CEF to
        // navigate. Also, a capture handler is more reliable than bubble.
        window.document.body.addEventListener("click", function (e) {
            // Check parents too, in case link has inline formatting tags
            var node = e.target, url;
            while (node) {
                if (node.tagName === "A") {
                    url = node.getAttribute("href");
                    if (url && !url.match(/^#/)) {
                        NativeApp.openURLInDefaultBrowser(url);
                    }
                    e.preventDefault();
                    break;
                }
                node = node.parentElement;
            }
        }, true);

        // jQuery patch to shim deprecated usage of $() on EventDispatchers
        var DefaultCtor = jQuery.fn.init;
        jQuery.fn.init = function (firstArg, secondArg) {
            var jQObject = new DefaultCtor(firstArg, secondArg);

            // Is this a Brackets EventDispatcher object? (not a DOM node or other object)
            if (firstArg && firstArg._EventDispatcher) {
                // Patch the jQ wrapper object so it calls EventDispatcher's APIs instead of jQuery's
                jQObject.on  = firstArg.on.bind(firstArg);
                jQObject.one = firstArg.one.bind(firstArg);
                jQObject.off = firstArg.off.bind(firstArg);
                // Don't offer legacy support for trigger()/triggerHandler() on core model objects; extensions
                // shouldn't be doing that anyway since it's basically poking at private API

                // Console warning, since $() is deprecated for EventDispatcher objects
                // (pass true to only print once per caller, and index 4 since the extension caller is deeper in the stack than usual)
                DeprecationWarning.deprecationWarning("Deprecated: Do not use $().on/off() on Brackets modules and model objects. Call on()/off() directly on the object without a $() wrapper.", true, 4);
            }
            return jQObject;
        };
    }

    // Wait for view state to load.
    var viewStateTimer = PerfUtils.markStart("User viewstate loading");
    PreferencesManager._smUserScopeLoading.always(function () {
        PerfUtils.addMeasurement(viewStateTimer);
        // Dispatch htmlReady event
        _beforeHTMLReady();
        AppInit._dispatchReady(AppInit.HTML_READY);
        $(window.document).ready(_onReady);
    });
});
