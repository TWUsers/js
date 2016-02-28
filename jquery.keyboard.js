


/*! jQuery UI Virtual Keyboard v1.22.5 *//*

Author: Jeremy Satterfield
Modified: Rob Garrison (Mottie on github)
-----------------------------------------
Licensed under the MIT License

Caret code modified from jquery.caret.1.02.js
Licensed under the MIT License:
http://www.opensource.org/licenses/mit-license.php
-----------------------------------------

An on-screen virtual keyboard embedded within the browser window which
will popup when a specified entry field is focused. The user can then
type and preview their input before Accepting or Canceling.

As a plugin to jQuery UI styling and theme will automatically
match that used by jQuery UI with the exception of the required CSS.

Requires: jQuery v1.4.3+
Optional:
 jQuery UI (position utility only) & CSS theme
 jQuery mousewheel

Setup/Usage:
	Please refer to https://github.com/Mottie/Keyboard/wiki
*/
/*jshint browser:true, jquery:true, unused:false */
/*global require:false, define:false, module:false */
;(function(factory) {
	if (typeof define === 'function' && define.amd) {
		define(['jquery'], factory);
	} else if (typeof module === 'object' && typeof module.exports === 'object') {
		module.exports = factory(require('jquery'));
	} else {
		factory(jQuery);
	}
}(function($) {
'use strict';
var $keyboard = $.keyboard = function(el, options){
	var base = this, o;

	base.version = '1.22.5';

	// Access to jQuery and DOM versions of element
	base.$el = $(el);
	base.el = el;

	// Add a reverse reference to the DOM object
	base.$el.data('keyboard', base);

	base.init = function(){
		var kbcss = $keyboard.css;
		base.settings = options || {};
		base.options = o = $.extend(true, {}, $keyboard.defaultOptions, options);

		// keyboard is active (not destroyed);
		base.el.active = true;
		// unique keyboard namespace
		base.namespace = '.keyboard' + Math.random().toString(16).slice(2);
		// Shift and Alt key toggles, sets is true if a layout has more than one keyset
		// used for mousewheel message
		base.shiftActive = base.altActive = base.metaActive = base.sets = base.capsLock = false;
		// Class names of the basic key set - meta keysets are handled by the keyname
		base.rows = [ '', '-shift', '-alt', '-alt-shift' ];

		base.inPlaceholder = base.$el.attr('placeholder') || '';
		// html 5 placeholder/watermark
		base.watermark = $keyboard.watermark && base.inPlaceholder !== '';
		// convert mouse repeater rate (characters per second) into a time in milliseconds.
		base.repeatTime = 1000/(o.repeatRate || 20);
		// delay in ms to prevent mousedown & touchstart from both firing events at the same time
		o.preventDoubleEventTime = o.preventDoubleEventTime || 100;
		// flag indication that a keyboard is open
		base.isOpen = false;
		// is mousewheel plugin loaded?
		base.wheel = $.isFunction( $.fn.mousewheel );
		// keyCode of keys always allowed to be typed - caps lock, page up & down, end, home, arrow, insert &
		// delete keys
		base.alwaysAllowed = [20,33,34,35,36,37,38,39,40,45,46];
		base.$keyboard = [];
		// keyboard enabled
		base.enabled = true;
		// make a copy of the original keyboard position
		if (!$.isEmptyObject(o.position)) {
			o.position.orig_at = o.position.at;
		}

		base.checkCaret = ( o.lockInput || $keyboard.checkCaretSupport() );

		// [shift, alt, meta]
		base.last = { start:0, end:0, key:'', val:'', layout:'', virtual:true, keyset: [false, false, false] };
		base.temp = [ '', 0, 0 ]; // used when building the keyboard - [keyset element, row, index]

		// Bind events
		$.each('initialized beforeVisible visible hidden canceled accepted beforeClose'.split(' '), function(i,f){
			if ($.isFunction(o[f])){
				base.$el.bind(f + base.namespace, o[f]);
			}
		});



		// Add placeholder if not supported by the browser
		if (!base.watermark && base.$el.val() === '' && base.inPlaceholder !== '' &&
			base.$el.attr('placeholder') !== '') {
			base.$el
				.addClass(kbcss.placeholder) // css watermark style (darker text)
				.val( base.inPlaceholder );
		}

		base.$el.trigger( $keyboard.events.kbInit, [ base, base.el ] );

		// initialized with keyboard open
		if (o.alwaysOpen) {
			base.reveal();
		}

	};

	base.toggle = function(){
		var $toggle = base.$keyboard.find( '.' + $keyboard.css.keyToggle ),
			locked = !base.enabled;
		// prevent physical keyboard from working
		base.$preview.prop( 'readonly', locked );
		// disable all buttons
		base.$keyboard
			.toggleClass( $keyboard.css.keyDisabled, locked )
			.find( '.' + $keyboard.css.keyButton )
			.not( $toggle )
			.prop( 'disabled', locked )
			.attr( 'aria-disabled', locked );
		$toggle.toggleClass( $keyboard.css.keyDisabled, locked );
		// stop auto typing
		if ( locked && base.typing_options ) {
			base.typing_options.text = '';
		}
	};

	base.setCurrent = function(){
		var kbcss = $keyboard.css;
		// ui-keyboard-has-focus is applied in case multiple keyboards have alwaysOpen = true and are stacked
		$('.' + kbcss.hasFocus).removeClass(kbcss.hasFocus);
		$('.' + kbcss.isCurrent).removeClass(kbcss.isCurrent);

		base.$el.addClass(kbcss.isCurrent);
		base.$keyboard.addClass(kbcss.hasFocus);
		base.isCurrent(true);
		base.isOpen = true;
	};

	base.isCurrent = function(set){
		var cur = $keyboard.currentKeyboard || false;
		if (set) {
			cur = $keyboard.currentKeyboard = base.el;
		} else if (set === false && cur === base.el) {
			cur = $keyboard.currentKeyboard = '';
		}
		return cur === base.el;
	};

	base.isVisible = function() {
		return base.$keyboard && base.$keyboard.length ? base.$keyboard.is(':visible') : false;
	};

	base.focusOn = function(){
		if (!el.active) {
			// keyboard was destroyed
			return;
		}
		if (base.$el.is(':visible')) {
			// caret position is always 0,0 in webkit; and nothing is focused at this point... odd
			// save caret position in the input to transfer it to the preview
			// add delay to get correct caret position
			base.timer2 = setTimeout(function(){
				var undef;
				// Number inputs don't support selectionStart and selectionEnd
				// Number/email inputs don't support selectionStart and selectionEnd
				if ( !/(number|email)/i.test(base.el.type) && !o.caretToEnd ) {
					base.saveCaret( undef, undef, base.$el );
				}
			}, 20);
		}
		if (!base.isVisible()) {
			clearTimeout(base.timer);
			base.reveal();
		}
		if (o.alwaysOpen) {
			base.setCurrent();
		}
	};

	base.reveal = function(refresh){
		if (base.isOpen) {
			refresh = true;
		}
		var kbcss = $keyboard.css;
		base.opening = true;
		// remove all 'extra' keyboards
		$('.' + kbcss.keyboard).not('.' + kbcss.alwaysOpen).remove();

		// update keyboard after a layout change
		if (refresh) {
			base.isOpen = false;
			base.last.val = base.$preview && base.$preview.val() || '';
			if (base.$keyboard.length) {
				base.$keyboard.remove();
				base.$keyboard = [];
				base.shiftActive = base.altActive = base.metaActive = false;
			}
		}

		// Don't open if disabled
		if (base.$el.is(':disabled') || (base.$el.attr('readonly') &&
			!base.$el.hasClass(kbcss.locked))) {
			base.$el.addClass(kbcss.noKeyboard);
			return;
		} else {
			base.$el.removeClass(kbcss.noKeyboard);
		}

		// Unbind focus to prevent recursion - openOn may be empty if keyboard is opened externally
		if (o.openOn) {
			base.$el.unbind( o.openOn + base.namespace );
		}

		// build keyboard if it doesn't exist; or attach keyboard if it was removed, but not cleared
		if ( !base.$keyboard || base.$keyboard && ( !base.$keyboard.length || $.contains(document.body, base.$keyboard[0]) ) ) {
			base.startup();
		}

		// clear watermark
		if (!base.watermark && base.el.value === base.inPlaceholder) {
			base.$el
				.removeClass(kbcss.placeholder)
				.val('');
		}
		// save starting content, in case we cancel
		base.originalContent = base.$el.val();
		base.$preview.val( refresh ? base.last.val : base.originalContent );

		// disable/enable accept button
		if (o.acceptValid) { base.checkValid(); }

		if (o.resetDefault) {
			base.shiftActive = base.altActive = base.metaActive = false;
			base.showKeySet();
		}

		// beforeVisible event
		base.$el.trigger( $keyboard.events.kbBeforeVisible, [ base, base.el ] );

		base.setCurrent();
		// update keyboard - enabled or disabled?
		base.toggle();

		// show keyboard
		base.$keyboard.show();

		// adjust keyboard preview window width - save width so IE won't keep expanding (fix issue #6)
		if (o.usePreview && $keyboard.msie) {
			if (typeof base.width === 'undefined') {
				base.$preview.hide(); // preview is 100% browser width in IE7, so hide the damn thing
				base.width = Math.ceil(base.$keyboard.width()); // set input width to match the widest keyboard row
				base.$preview.show();
			}
			base.$preview.width(base.width);
		}

		base.position = $.isEmptyObject(o.position) ? false : o.position;

		// position after keyboard is visible (required for UI position utility) and appropriately sized
		if ($.ui && $.ui.position && base.position) {
			// get single target position || target stored in element data (multiple targets) || default @ element
			base.position.of = base.position.of || base.$el.data('keyboardPosition') || base.$el;
			base.position.collision = base.position.collision || 'flipfit flipfit';
			o.position.at = o.usePreview ? o.position.orig_at : o.position.at2;
			base.$keyboard.position(base.position);
		}

		base.checkDecimal();

		// get preview area line height
		// add roughly 4px to get line height from font height, works well for font-sizes from 14-36px
		// needed for textareas
		base.lineHeight = parseInt( base.$preview.css('lineHeight'), 10) ||
			parseInt(base.$preview.css('font-size') ,10) + 4;

		if (o.caretToEnd) {
			base.saveCaret( base.originalContent.length, base.originalContent.length );
		}

		// IE caret haxx0rs
		if ($keyboard.allie){
			// sometimes end = 0 while start is > 0
			if (base.last.end === 0 && base.last.start > 0) {
				base.last.end = base.last.start;
			}
			// IE will have start -1, end of 0 when not focused (see demo: http://jsfiddle.net/Mottie/fgryQ/3/)
			if (base.last.start < 0) {
				// ensure caret is at the end of the text (needed for IE)
				base.last.start = base.last.end = base.originalContent.length;
			}
		}

		// opening keyboard flag; delay allows switching between keyboards without immediately closing
		// the keyboard
		base.timer2 = setTimeout(function(){
			base.opening = false;
			if (o.initialFocus) {
				$keyboard.caret( base.$preview, base.last );
			}
			// save event time for keyboards with stayOpen: true
			base.last.eventTime = new Date().getTime();
			base.$el.trigger( $keyboard.events.kbVisible, [ base, base.el ] );
			base.timer = setTimeout(function(){
				// get updated caret information after visible event - fixes #331
				if (base) { // Check if base exists, this is a case when destroy is called, before timers have fired
					base.saveCaret();
				}
			}, 200);
		}, 10);
		// return base to allow chaining in typing extension
		return base;
	};

	base.updateLanguage = function(){
		// change language if layout is named something like 'french-azerty-1'
		var layouts =  $keyboard.layouts,
			lang = o.language || layouts[ o.layout ] && layouts[ o.layout ].lang && layouts[ o.layout ].lang || [ o.language || 'en' ],
			kblang = $keyboard.language;

		// some languages include a dash, e.g. 'en-gb' or 'fr-ca'
		// allow o.language to be a string or array...
		// array is for future expansion where a layout can be set for multiple languages
		lang = ( $.isArray(lang) ? lang[0] : lang ).split('-')[0];

		// set keyboard language
		o.display = $.extend( true, {}, kblang.en.display, kblang[ lang ] && kblang[ lang ].display || {}, base.settings.display );

		o.combos = $.extend( true, {}, kblang.en.combos, kblang[ lang ] && kblang[ lang ].combos || {}, base.settings.combos );
		o.wheelMessage = kblang[ lang ] && kblang[ lang ].wheelMessage || kblang.en.wheelMessage;
		// rtl can be in the layout or in the language definition; defaults to false
		o.rtl = layouts[ o.layout ] && layouts[ o.layout ].rtl || kblang[ lang ] && kblang[ lang ].rtl  || false;

		// save default regex (in case loading another layout changes it)
		base.regex = kblang[ lang ] && kblang[ lang ].comboRegex || $keyboard.comboRegex;
		// determine if US '.' or European ',' system being used
		base.decimal = /^\./.test(o.display.dec);
		base.$el
			.toggleClass('rtl', o.rtl)
			.css('direction', o.rtl ? 'rtl' : '');
	};

	base.startup = function(){
		var kbcss = $keyboard.css;
		// ensure base.$preview is defined
		base.$preview = base.$el;

		if ( !(base.$keyboard && base.$keyboard.length) ) {
			// custom layout - create a unique layout name based on the hash
			if (o.layout === 'custom') { o.layoutHash = 'custom' + base.customHash(); }
			base.layout = o.layout === 'custom' ? o.layoutHash : o.layout;
			base.last.layout = base.layout;

			base.updateLanguage();

			if (typeof $keyboard.builtLayouts[base.layout] === 'undefined') {
				if ($.isFunction(o.create)) {
					o.create(base);
				}
				if (!base.$keyboard.length) {
					base.buildKeyboard(base.layout, true);
				}
			}
			base.$keyboard = $keyboard.builtLayouts[base.layout].$keyboard.clone();
			if ( ( base.el.id || '' ) !== '' ) {
				// add ID to keyboard for styling purposes
				base.$keyboard.attr( 'id', base.el.id + $keyboard.css.idSuffix );
			}

			// build preview display
			if (o.usePreview) {
				// restore original positioning (in case usePreview option is altered)
				if (!$.isEmptyObject(o.position)) {
					o.position.at = o.position.orig_at;
				}
				base.$preview = base.$el.clone(false)
					.removeAttr('id')
					.removeClass(kbcss.placeholder + ' ' + kbcss.input)
					.addClass(kbcss.preview + ' ' + o.css.input)
					.removeAttr('aria-haspopup')
					.attr('tabindex', '-1')
					.show(); // for hidden inputs
				// Switch the number input fields to text so the caret positioning will work again
				if (base.$preview.attr('type') == 'number') {
					base.$preview.attr('type', 'text');
				}
				// build preview container and append preview display
				$('<div />')
					.addClass(kbcss.wrapper)
					.append(base.$preview)
					.prependTo(base.$keyboard);
			} else {
				// No preview display, use element and reposition the keyboard under it.
				if (!$.isEmptyObject(o.position)) {
					o.position.at = o.position.at2;
				}
			}

		}

		base.preview = base.$preview[0];
		base.$decBtn = base.$keyboard.find('.' + kbcss.keyPrefix + 'dec');
		// add enter to allowed keys; fixes #190
		if (o.enterNavigation || base.el.nodeName === 'TEXTAREA') { base.alwaysAllowed.push(13); }
		if (o.lockInput) {
			base.$preview.addClass(kbcss.locked).attr({ 'readonly': 'readonly'});
		}

		base.bindKeyboard();

		base.$keyboard.appendTo( o.appendLocally ? base.$el.parent() : o.appendTo || 'body' );

		base.bindKeys();

		// adjust with window resize; don't check base.position
		// here in case it is changed dynamically
		if (o.reposition && $.ui && $.ui.position && o.appendTo == 'body') {
			$(window).bind('resize' + base.namespace, function(){
				if (base.position && base.isVisible()) {
					base.$keyboard.position(base.position);
				}
			});
		}

	};

	base.saveCaret = function(start, end, $el){
		var p = $keyboard.caret( $el || base.$preview, start, end );
		base.last.start = start || p.start;
		base.last.end = end || p.end;
	};

	base.setScroll = function(){
		// Set scroll so caret & current text is in view
		// needed for virtual keyboard typing, NOT manual typing - fixes #23
		if ( base.last.virtual ) {

			var scrollWidth, clientWidth, adjustment, direction,
				isTextarea = base.preview.nodeName === 'TEXTAREA',
				value = base.last.val.substring( 0, Math.max( base.last.start, base.last.end ) );

			if ( !base.$previewCopy ) {
				// clone preview
				base.$previewCopy = base.$preview.clone()
					.removeAttr('id') // fixes #334
					.css({
						position : 'absolute',
						zIndex : -10,
						visibility : 'hidden'
					})
					.addClass('ui-keyboard-preview-clone');
				if ( !isTextarea ) {
					// make input zero-width because we need an accurate scrollWidth
					base.$previewCopy.css({ 'white-space' : 'pre', 'width' : 0 });
				}
				if (o.usePreview) {
					// add clone inside of preview wrapper
					base.$preview.after( base.$previewCopy );
				} else {
					// just slap that thing in there somewhere
					base.$keyboard.prepend( base.$previewCopy );
				}
			}

			if ( isTextarea ) {
				// need the textarea scrollHeight, so set the clone textarea height to be the line height
				base.$previewCopy
					.height( base.lineHeight )
					.val( value );
				// set scrollTop for Textarea
				base.preview.scrollTop = base.lineHeight * ( Math.floor( base.$previewCopy[0].scrollHeight / base.lineHeight ) - 1 );
			} else {
				// add non-breaking spaces
				base.$previewCopy.val( value.replace(/\s/g, '\xa0') );

				// if scrollAdjustment option is set to "c" or "center" then center the caret
				adjustment = /c/i.test( o.scrollAdjustment ) ? base.preview.clientWidth / 2 : o.scrollAdjustment;
				scrollWidth = base.$previewCopy[0].scrollWidth - 1;

				// set initial state as moving right
				if ( typeof base.last.scrollWidth === 'undefined' ) {
					base.last.scrollWidth = scrollWidth;
					base.last.direction = true;
				}
				// if direction = true; we're scrolling to the right
				direction = base.last.scrollWidth === scrollWidth ? base.last.direction : base.last.scrollWidth < scrollWidth;
				clientWidth = base.preview.clientWidth - adjustment;

				// set scrollLeft for inputs; try to mimic the inherit caret positioning + scrolling:
				// hug right while scrolling right...
				if ( direction ) {
					if ( scrollWidth < clientWidth ) {
						base.preview.scrollLeft = 0;
					} else {
						base.preview.scrollLeft = scrollWidth - clientWidth;
					}
				} else {
					// hug left while scrolling left...
					if ( scrollWidth >= base.preview.scrollWidth - clientWidth ) {
						base.preview.scrollLeft = base.preview.scrollWidth - adjustment;
					} else if ( scrollWidth - adjustment > 0 ) {
						base.preview.scrollLeft = scrollWidth - adjustment;
					} else {
						base.preview.scrollLeft = 0;
					}
				}

				base.last.scrollWidth = scrollWidth;
				base.last.direction = direction;
			}
		}
	};

	base.bindKeyboard = function(){
		var evt, layout = $keyboard.builtLayouts[base.layout];
		base.$preview
			.unbind('keypress keyup keydown mouseup touchend '.split(' ').join(base.namespace + ' '))
			.bind('click' + base.namespace, function(){
				// update last caret position after user click, use at least 150ms or it doesn't work in IE
				base.timer2 = setTimeout(function(){
					base.saveCaret();
				}, 150);
			})
			.bind('keypress' + base.namespace, function(e){
				if (o.lockInput) { return false; }
				var k = base.last.key = String.fromCharCode(e.charCode || e.which);
				base.last.virtual = false;
				base.last.event = e;
				base.last.$key = []; // not a virtual keyboard key
				if (base.checkCaret) {
					base.saveCaret();
				}

				// update caps lock - can only do this while typing =(
				base.capsLock = (((k >= 65 && k <= 90) && !e.shiftKey) ||
					((k >= 97 && k <= 122) && e.shiftKey)) ? true : false;

				// restrict input - keyCode in keypress special keys:
				// see http://www.asquare.net/javascript/tests/KeyCode.html
				if (o.restrictInput) {
					// allow navigation keys to work - Chrome doesn't fire a keypress event (8 = bksp)
					if ( (e.which === 8 || e.which === 0) && $.inArray( e.keyCode, base.alwaysAllowed ) ) { return; }
					// quick key check
					if ($.inArray(k, layout.acceptedKeys) === -1) {
						e.preventDefault();
						// copy event object in case e.preventDefault() breaks when changing the type
						evt = $.extend({}, e);
						evt.type = $keyboard.events.inputRestricted;
						base.$el.trigger( evt, [ base, base.el ] );
						if ( $.isFunction(o.restricted) ) {
							o.restricted( evt, base, base.el );
						}
					}
				} else if ( (e.ctrlKey || e.metaKey) && (e.which === 97 || e.which === 99 || e.which === 118 ||
						(e.which >= 120 && e.which <=122)) ) {
					// Allow select all (ctrl-a:97), copy (ctrl-c:99), paste (ctrl-v:118) & cut (ctrl-x:120) &
					// redo (ctrl-y:121)& undo (ctrl-z:122); meta key for mac
					return;
				}
				// Mapped Keys - allows typing on a regular keyboard and the mapped key is entered
				// Set up a key in the layout as follows: 'm(a):label'; m = key to map, (a) = actual keyboard key
				// to map to (optional), ':label' = title/tooltip (optional)
				// example: \u0391 or \u0391(A) or \u0391:alpha or \u0391(A):alpha
				if (layout.hasMappedKeys) {
					if (layout.mappedKeys.hasOwnProperty(k)){
						base.last.key = layout.mappedKeys[k];
						base.insertText( base.last.key );
						e.preventDefault();
					}
				}
				base.checkMaxLength();

			})
			
	};

	base.bindKeys = function(){
		var kbcss = $keyboard.css;
		base.$allKeys = base.$keyboard.find('button.' + kbcss.keyButton)
			.unbind(base.namespace + ' ' + base.namespace + 'kb')
			.bind(o.keyBinding.split(' ').join(base.namespace + ' ') + base.namespace + ' ' + $keyboard.events.kbRepeater, function(e){
				e.preventDefault();
				// prevent errors when external triggers attempt to 'type' - see issue #158
				if (!base.$keyboard.is(':visible')){ return false; }
				// 'key', { action: doAction, original: n, curtxt : n, curnum: 0 }
				var action, $key,
					indx = 0,
					key = this,
					$this = $(key),
					// get keys from other layers/keysets (shift, alt, meta, etc) that line up by data-position
					$keys = base.getLayers( $this ),
					txt = $keys.map(function(){ return $(this).attr('data-curtxt'); }).get(),
					// prevent mousedown & touchstart from both firing events at the same time - see #184
					timer = new Date().getTime();
				// find index of mousewheel selected key
				$keys.each(function(i, v){
					if (v === key) {
						indx = i;
						return false;
					}
				});
				// target mousewheel selected key
				$key = indx < 0 ? $this : $keys.eq(indx + $this.data('curnum'));
				action = $key.attr('data-action');
				// don't split colon key. Fixes #264
				action = action === ':' ? ':' : (action || '').split(':')[0];
				if (timer - (base.last.eventTime || 0) < o.preventDoubleEventTime) { return; }
				base.last.eventTime = timer;
				base.last.event = e;
				base.last.virtual = true;
				base.$preview.focus();
				base.last.$key = $key;
				base.last.key = $key.attr('data-curtxt');
				// Start caret in IE when not focused (happens with each virtual keyboard button click
				if (base.checkCaret) {
					$keyboard.caret( base.$preview, base.last );
				}
				if (action.match('meta')) { action = 'meta'; }
				if (action in $keyboard.keyaction && $.isFunction($keyboard.keyaction[action])) {
					// stop processing if action returns false (close & cancel)
					if ($keyboard.keyaction[action](base,this,e) === false) { return false; }
				} else if (typeof action !== 'undefined') {
					txt = base.last.key = (base.wheel && !$(this).hasClass(kbcss.keyAction)) ?
						base.last.key : action;
					base.insertText(txt);
					if (!base.capsLock && !o.stickyShift && !e.shiftKey) {
						base.shiftActive = false;
						base.showKeySet(this);
					}
				}
				// set caret if caret moved by action function; also, attempt to fix issue #131
				$keyboard.caret( base.$preview, base.last );
				base.checkCombos();
				base.$el.trigger( $keyboard.events.kbChange, [ base, base.el ] );
				base.last.val = base.$preview.val();

				if ($.isFunction(o.change)){
					o.change( $.Event( $keyboard.events.inputChange ), base, base.el );
					// return false to prevent reopening keyboard if base.accept() was called
					return false;
				}

			})
			// Change hover class and tooltip
			.bind('mouseenter mouseleave touchstart '.split(' ').join(base.namespace + ' '), function(e){
				if (!base.isCurrent()) { return; }
				var $this = $(this),
					$keys = base.getLayers( $this ),
					txt = ( $keys.length ? $keys.map(function(){ return $(this).attr('data-curtxt') || ''; }).get() : '' ) || [ $this.find('.' + kbcss.keyText).text() ];

				if ((e.type === 'mouseenter' || e.type === 'touchstart') && base.el.type !== 'password' &&
					!$this.hasClass(o.css.buttonDisabled) ){
					$this
						.addClass(o.css.buttonHover)
						.attr('title', function(i,t){
							// show mouse wheel message
							return (base.wheel && t === '' && base.sets && txt.length > 1 && e.type !== 'touchstart') ?
								o.wheelMessage : t;
						});
				}
				if (e.type === 'mouseleave'){
					$this.data({
						'curtxt' : $this.data('original'),
						'curnum' : 0
					});
					$this
						// needed or IE flickers really bad
						.removeClass( (base.el.type === 'password') ? '' : o.css.buttonHover)
						.attr('title', function(i,t){ return (t === o.wheelMessage) ? '' : t; })
						.find('.' + kbcss.keyText).html( $this.data('original') ); // restore original button text
				}
			})
			// using 'kb' namespace for mouse repeat functionality to keep it separate
			// I need to trigger a 'repeater.keyboard' to make it work
			.bind('mouseup' + base.namespace + ' ' + 'mouseleave touchend touchmove touchcancel '.split(' ').join(base.namespace + 'kb '), function(e){
				base.last.virtual = true;
				if (/(mouseleave|touchend|touchcancel)/i.test(e.type)) {
					$(this).removeClass(o.css.buttonHover); // needed for touch devices
				} else {
					if (base.isVisible() && base.isCurrent()) { base.$preview.focus(); }
					if (base.checkCaret) {
						$keyboard.caret( base.$preview, base.last );
					}
				}
				base.mouseRepeat = [false,''];
				clearTimeout(base.repeater); // make sure key repeat stops!
				return false;
			})
			// prevent form submits when keyboard is bound locally - issue #64
			.bind('click' + base.namespace, function(){
				return false;
			})
			// no mouse repeat for action keys (shift, ctrl, alt, meta, etc)
			.not('.' + kbcss.keyAction)
			// Allow mousewheel to scroll through other keysets of the same (non-action) key
			.bind('mousewheel' + base.namespace, function(e, delta){
				if (base.wheel) {
					// deltaY used by newer versions of mousewheel plugin
					delta = delta || e.deltaY;
					var n,
						$this = $(this),
						$keys = base.getLayers( $this ),
						txt = $keys.length && $keys.map(function(){ return $(this).attr('data-curtxt'); }).get() || [ $this.find('.' + kbcss.keyText).text() ];
					if (txt.length > 1) {
						n = $this.data('curnum') + (delta > 0 ? -1 : 1);
						if (n > txt.length-1) { n = 0; }
						if (n < 0) { n = txt.length-1; }
					} else {
						n = 0;
					}
					$this.data({
						'curnum' : n,
						'layers' : txt,
						'curtxt' : txt[n]
					});
					$this.find('.' + kbcss.keyText).html( txt[n] );
					return false;
				}
			})
			// mouse repeated action key exceptions
			.add('.' + kbcss.keyPrefix + ('tab bksp space enter'.split(' ').join(',.' + kbcss.keyPrefix)), base.$keyboard)
			.bind('mousedown touchstart '.split(' ').join(base.namespace + 'kb '), function(){
				if (o.repeatRate !== 0) {
					var key = $(this);
					base.mouseRepeat = [true, key]; // save the key, make sure we are repeating the right one (fast typers)
					setTimeout(function() {
						if (base.mouseRepeat[0] && base.mouseRepeat[1] === key) { base.repeatKey(key); }
					}, o.repeatDelay);
				}
				return false;
			});
	};

	// Insert text at caret/selection - thanks to Derek Wickwire for fixing this up!
	base.insertText = function(txt){
		var bksp, t,
			isBksp = txt === '\b',
			// use base.$preview.val() instead of base.preview.value (val.length includes carriage returns in IE).
			val = base.$preview.val(),
			pos = $keyboard.caret( base.$preview ),
			len = val.length; // save original content length

		// silly IE caret hacks... it should work correctly, but navigating using arrow keys in a textarea
		// is still difficult
		// in IE, pos.end can be zero after input loses focus
		if (pos.end < pos.start) { pos.end = pos.start; }
		if (pos.start > len) { pos.end = pos.start = len; }

		if (base.preview.nodeName === 'TEXTAREA') {
			// This makes sure the caret moves to the next line after clicking on enter (manual typing works fine)
			if ($keyboard.msie && val.substr(pos.start, 1) === '\n') { pos.start += 1; pos.end += 1; }
		}

		bksp = isBksp && pos.start === pos.end;
		txt = isBksp ? '' : txt;
		t = pos.start + (bksp ? -1 : txt.length);

		if (txt === '{d}') {
			txt = '';
			t = pos.start;
			pos.end += 1;
		}

		base.$preview.val( val.substr(0, pos.start - (bksp ? 1 : 0)) + txt + val.substr(pos.end) );
		base.saveCaret( t, t ); // save caret in case of bksp
		base.setScroll();
	};

	// check max length
	base.checkMaxLength = function(){
		var start, caret,
			val = base.$preview.val();
		if (o.maxLength !== false && val.length > o.maxLength) {
			start = $keyboard.caret( base.$preview ).start;
			caret = Math.min(start, o.maxLength);

			// prevent inserting new characters when maxed #289
			if (!o.maxInsert) {
				val = base.last.val;
				caret = start - 1; // move caret back one
			}

			base.$preview.val( val.substring(0, o.maxLength) );
			// restore caret on change, otherwise it ends up at the end.
			base.saveCaret( caret, caret );
		}
		if (base.$decBtn.length) {
			base.checkDecimal();
		}
	};

	// mousedown repeater
	base.repeatKey = function(key){
		key.trigger( $keyboard.events.kbRepeater );
		if (base.mouseRepeat[0]) {
			base.repeater = setTimeout(function() {
				base.repeatKey(key);
			}, base.repeatTime);
		}
	};

	base.showKeySet = function(el){
		o = base.options; // refresh options
		var kbcss = $keyboard.css,
			key = '',
			toShow = (base.shiftActive ? 1 : 0) + (base.altActive ? 2 : 0);
		if (!base.shiftActive) { base.capsLock = false; }
		// check meta key set
		if (base.metaActive) {
			// the name attribute contains the meta set # 'meta99'
			key = (el && el.name && /meta/i.test(el.name)) ? el.name : '';
			// save active meta keyset name
			if (key === '') {
				key = (base.metaActive === true) ? '' : base.metaActive;
			} else {
				base.metaActive = key;
			}
			// if meta keyset doesn't have a shift or alt keyset, then show just the meta key set
			if ( (!o.stickyShift && base.last.keyset[2] !== base.metaActive) ||
				( (base.shiftActive || base.altActive) && !base.$keyboard.find('.' + kbcss.keySet + '-' + key +
					base.rows[toShow]).length) ) {
				base.shiftActive = base.altActive = false;
			}
		} else if (!o.stickyShift && base.last.keyset[2] !== base.metaActive && base.shiftActive) {
			// switching from meta key set back to default, reset shift & alt if using stickyShift
			base.shiftActive = base.altActive = false;
		}
		toShow = (base.shiftActive ? 1 : 0) + (base.altActive ? 2 : 0);
		key = (toShow === 0 && !base.metaActive) ? '-normal' : (key === '') ? '' : '-' + key;
		if (!base.$keyboard.find('.' + kbcss.keySet + key + base.rows[toShow]).length) {
			// keyset doesn't exist, so restore last keyset settings
			base.shiftActive = base.last.keyset[0];
			base.altActive = base.last.keyset[1];
			base.metaActive = base.last.keyset[2];
			return;
		}
		base.$keyboard
			.find('.' + kbcss.keyPrefix + 'alt,.' + kbcss.keyPrefix + 'shift,.' + kbcss.keyAction + '[class*=meta]')
				.removeClass(o.css.buttonActive).end()
			.find('.' + kbcss.keyPrefix + 'alt').toggleClass( o.css.buttonActive, base.altActive ).end()
			.find('.' + kbcss.keyPrefix + 'shift').toggleClass( o.css.buttonActive, base.shiftActive ).end()
			.find('.' + kbcss.keyPrefix + 'lock').toggleClass( o.css.buttonActive, base.capsLock ).end()
			.find('.' + kbcss.keySet).hide().end()
			.find('.' + kbcss.keySet + key + base.rows[toShow]).show().end()
			.find('.' + kbcss.keyAction + '.' + kbcss.keyboard + key).addClass(o.css.buttonActive);
		base.last.keyset = [ base.shiftActive, base.altActive, base.metaActive ];
		base.$el.trigger( $keyboard.events.kbKeysetChange, [ base, base.el ] );
	};

	// check for key combos (dead keys)
	base.checkCombos = function(){
		if (!base.isVisible()) { return base.$preview.val(); }
		var i, r, t, t2,
			// use base.$preview.val() instead of base.preview.value (val.length includes carriage returns in IE).
			val = base.$preview.val(),
			pos = $keyboard.caret( base.$preview ),
			layout = $keyboard.builtLayouts[base.layout],
			len = val.length; // save original content length

		// silly IE caret hacks... it should work correctly, but navigating using arrow keys in a textarea
		// is still difficult
		// in IE, pos.end can be zero after input loses focus
		if (pos.end < pos.start) { pos.end = pos.start; }
		if (pos.start > len) { pos.end = pos.start = len; }
		// This makes sure the caret moves to the next line after clicking on enter (manual typing works fine)
		if ($keyboard.msie && val.substr(pos.start, 1) === '\n') { pos.start += 1; pos.end += 1; }

		if (o.useCombos) {
			// keep 'a' and 'o' in the regex for ae and oe ligature (æ,œ)
			// thanks to KennyTM: http://stackoverflow.com/q/4275077
			// original regex /([`\'~\^\"ao])([a-z])/mig moved to $.keyboard.comboRegex
			if ($keyboard.msie) {
				// old IE may not have the caret positioned correctly, so just check the whole thing
				val = val.replace(base.regex, function(s, accent, letter){
					return (o.combos.hasOwnProperty(accent)) ? o.combos[accent][letter] || s : s;
				});
			// prevent combo replace error, in case the keyboard closes - see issue #116
			} else if (base.$preview.length) {
				// Modern browsers - check for combos from last two characters left of the caret
				t = pos.start - (pos.start - 2 >= 0 ? 2 : 0);
				// target last two characters
				$keyboard.caret( base.$preview, t, pos.end );
				// do combo replace
				t2 = ($keyboard.caret( base.$preview ).text || '').replace(base.regex, function(s, accent, letter){
					return (o.combos.hasOwnProperty(accent)) ? o.combos[accent][letter] || s : s;
				});
				// add combo back
				base.$preview.val( $keyboard.caret( base.$preview ).replaceStr(t2) );
				val = base.$preview.val();
			}
		}

		// check input restrictions - in case content was pasted
		if (o.restrictInput && val !== '') {
			t = val;
			r = layout.acceptedKeys.length;
			for (i=0; i < r; i++){
				if (t === '') { continue; }
				t2 = layout.acceptedKeys[i];
				if (val.indexOf(t2) >= 0) {
					// escape out all special characters
					if (/[\[|\]|\\|\^|\$|\.|\||\?|\*|\+|\(|\)|\{|\}]/g.test(t2)) { t2 = '\\' + t2; }
					t = t.replace( (new RegExp(t2, 'g')), '');
				}
			}
			// what's left over are keys that aren't in the acceptedKeys array
			if (t !== '') { val = val.replace(t, ''); }
		}

		// save changes, then reposition caret
		pos.start += val.length - len;
		pos.end += val.length - len;
		base.$preview.val(val);
		base.saveCaret( pos.start, pos.end );

		// set scroll to keep caret in view
		base.setScroll();

		base.checkMaxLength();

		if (o.acceptValid) { base.checkValid(); }

		return val; // return text, used for keyboard closing section
	};

	// Toggle accept button classes, if validating
	base.checkValid = function(){
		var kbcss = $keyboard.css,
			valid = true;
		if ($.isFunction(o.validate)) {
			valid = o.validate(base, base.$preview.val(), false);
		}
		// toggle accept button classes; defined in the css
		base.$keyboard.find('.' + kbcss.keyPrefix + 'accept')
			.toggleClass( kbcss.inputInvalid, !valid )
			.toggleClass( kbcss.inputValid, valid );

	};

	// Decimal button for num pad - only allow one (not used by default)
	base.checkDecimal = function(){
		// Check US '.' or European ',' format
		if ( ( base.decimal && /\./g.test(base.preview.value) ) ||
			( !base.decimal && /\,/g.test(base.preview.value) ) ) {
			base.$decBtn
				.attr({ 'disabled': 'disabled', 'aria-disabled': 'true' })
				.removeClass(o.css.buttonHover)
				.addClass(o.css.buttonDisabled);
		} else {
			base.$decBtn
				.removeAttr('disabled')
				.attr({ 'aria-disabled': 'false' })
				.addClass(o.css.buttonDefault)
				.removeClass(o.css.buttonDisabled);
		}
	};

	// get other layer values for a specific key
	base.getLayers = function($el){
		var kbcss = $keyboard.css,
			key = $el.attr('data-pos'),
			$keys = $el.closest('.' + kbcss.keyboard).find('button[data-pos="' + key + '"]');
		return $keys.filter(function(){ return $(this).find('.' + kbcss.keyText).text() !== ''; }).add($el);
	};

	// Go to next or prev inputs
	// goToNext = true, then go to next input; if false go to prev
	// isAccepted is from autoAccept option or true if user presses shift-enter
	base.switchInput = function(goToNext, isAccepted){
		if ($.isFunction(o.switchInput)) {
			o.switchInput(base, goToNext, isAccepted);
		} else {
			// base.$keyboard may be an empty array - see #275 (apod42)
			if (base.$keyboard.length) {
				base.$keyboard.hide();
			}
			var kb, stopped = false,
				all = $('button, input, textarea, a').filter(':visible').not(':disabled'),
				indx = all.index(base.$el) + (goToNext ? 1 : -1);
			if (base.$keyboard.length) {
				base.$keyboard.show();
			}
			if (indx > all.length - 1) {
				stopped = o.stopAtEnd;
				indx = 0; // go to first input
			}
			if (indx < 0) {
				stopped = o.stopAtEnd;
				indx = all.length - 1; // stop or go to last
			}
			if (!stopped) {
				isAccepted = base.close(isAccepted);
				if (!isAccepted) { return; }
				kb = all.eq(indx).data('keyboard');
				if (kb && kb.options.openOn.length) {
					kb.focusOn();
				} else {
					all.eq(indx).focus();
				}
			}
		}
		return false;
	};

	// Close the keyboard, if visible. Pass a status of true, if the content was accepted
	// (for the event trigger).
	base.close = function(accepted){
		if (base.isOpen) {
			clearTimeout(base.throttled);
			var kbcss = $keyboard.css,
				kbevents = $keyboard.events,
				val = (accepted) ?  base.checkCombos() : base.originalContent;
			// validate input if accepted
			if (accepted && $.isFunction(o.validate) && !o.validate(base, val, true)) {
				val = base.originalContent;
				accepted = false;
				if (o.cancelClose) { return; }
			}
			base.isCurrent(false);
			base.isOpen = false;
			// update value for always open keyboards
			base.$preview.val(val);

			base.$el
				.removeClass(kbcss.isCurrent + ' ' + kbcss.inputAutoAccepted)
				// add 'ui-keyboard-autoaccepted' to inputs - see issue #66
				.addClass( (accepted || false) ? accepted === true ? '' : kbcss.inputAutoAccepted : '' )
				.trigger( (o.alwaysOpen) ? '' : kbevents.kbBeforeClose, [ base, base.el, (accepted || false) ] )
				.val( val )
				.trigger( ((accepted || false) ? kbevents.inputAccepted : kbevents.inputCanceled), [ base, base.el ] )
				.trigger( (o.alwaysOpen) ? kbevents.kbInactive : kbevents.kbHidden, [ base, base.el ] )
				.blur();
			// add close event time
			base.last.eventTime = new Date().getTime();
			if (o.openOn) {
				// rebind input focus - delayed to fix IE issue #72
				base.timer = setTimeout(function(){
					// make sure keyboard isn't destroyed
					if (el.active && base) { //Check if base exists, this is a case when destroy is called, before timers have fired
						base.$el.bind( o.openOn + base.namespace, function(){ base.focusOn(); });
						// remove focus from element (needed for IE since blur doesn't seem to work)
						if ($(':focus')[0] === base.el) { base.$el.blur(); }
					}
				}, 500);
			}
			if (!o.alwaysOpen && base.$keyboard) {
				// free up memory
				base.$keyboard.remove();
				base.$keyboard = [];
			}
			if (!base.watermark && base.el.value === '' && base.inPlaceholder !== '') {
				base.$el
					.addClass(kbcss.placeholder)
					.val(base.inPlaceholder);
			}
			// trigger default change event - see issue #146
			base.$el.trigger(kbevents.inputChange);
		}
		return !!accepted;
	};

	base.accept = function(){
		return base.close(true);
	};

	// Build default button
	base.keyBtn = $('<button />')
		.attr({ 'role': 'button', 'type': 'button', 'aria-disabled': 'false', 'tabindex' : '-1' })
		.addClass( $keyboard.css.keyButton );

	// Add key function
	// keyName = the name of the function called in $.keyboard.keyaction when the button is clicked
	// name = name added to key, or cross-referenced in the display options
	// base.temp[0] = keyset to attach the new button
	// regKey = true when it is not an action key
	base.addKey = function(keyName, name, regKey){
		var t, keyType, m, map, nm,
			kbcss = $keyboard.css,
			txt = name.split(':'),
			len = txt.length - 1,
			n = (regKey === true) ? keyName : o.display[txt[0]] || keyName,
			kn = (regKey === true) ? keyName.charCodeAt(0) : keyName;
		// map defined keys - format 'key(A):Label_for_key'
		// 'key' = key that is seen (can any character; but it might need to be escaped using '\'
		//  or entered as unicode '\u####'
		// '(A)' = the actual key on the real keyboard to remap, ':Label_for_key' ends up in the title/tooltip
		if (/\(.+\)/.test(n)) { // n = '\u0391(A):alpha'
			map = n.replace(/\(([^()]+)\)/, ''); // remove '(A)', left with '\u0391:alpha'
			m = n.match(/\(([^()]+)\)/)[1]; // extract 'A' from '(A)'
			n = map;
			nm = map.split(':');
			map = (nm[0] !== '' && nm.length > 1) ? nm[0] : map; // get '\u0391' from '\u0391:alpha'
			$keyboard.builtLayouts[base.layout].mappedKeys[m] = map;
		}

		// find key label
		nm = n.split(':');
		// corner case of ':(:):;' reduced to '::;', split as ['', '', ';']
		if (nm[0] === '' && nm[1] === '') { n = ':'; }
		n = (nm[0] !== '' && nm.length > 1) ? nm[0] : n;
		// allow alt naming of action keys
		n = $.trim( regKey ? n : txt[1] || n );
		// added to title
		t = (nm.length > 1) ? $.trim(nm[1]).replace(/_/g, ' ') || '' : len > 0 ? txt[len] || '' : '';

		// Action keys will have the 'ui-keyboard-actionkey' class
		// '\u2190'.length = 1 because the unicode is converted, so if more than one character,
		// add the wide class
		keyType = (n.length > 2) ? ' ' + kbcss.keyWide : '';
		keyType += (regKey) ? '' : ' ' + kbcss.keyAction;
		return base.keyBtn
			.clone()
			.attr({
				'data-value' : n,
				'name': kn,
				'data-pos': base.temp[1] + ',' + base.temp[2],
				'title' : t,
				'data-action' : keyName,
				'data-original' : n,
				'data-curtxt' : n,
				'data-curnum' : 0
			})
			// add 'ui-keyboard-' + keyName, if this is an action key
			//  (e.g. 'Bksp' will have 'ui-keyboard-bskp' class)
			// add 'ui-keyboard-' + unicode of 1st character
			//  (e.g. '~' is a regular key, class = 'ui-keyboard-126'
			//  (126 is the unicode value - same as typing &#126;)
			.addClass( (kn === '' ? '' : kbcss.keyPrefix + kn + keyType + ' ') + o.css.buttonDefault)
			.html('<span class="' + kbcss.keyText + '">' + n + '</span>')
			.appendTo(base.temp[0]);
	};

	base.customHash = function(){
		/*jshint bitwise:false */
		var i, array, hash, character, len,
			layout = o.customLayout,
			arrays = [], merged = [];
		// get all layout arrays
		for (array in layout) {
			if (layout.hasOwnProperty(array)) {
				arrays.push(layout[array]);
			}
		}
		// flatten array
		merged = merged.concat.apply(merged, arrays).join(' ');
		// produce hash name - http://stackoverflow.com/a/7616484/145346
		hash = 0;
		len = merged.length;
		if (len === 0) { return hash; }
		for (i = 0; i < len; i++) {
			character = merged.charCodeAt(i);
			hash = ( (hash<<5) - hash) + character;
			hash = hash & hash; // Convert to 32bit integer
		}
		return hash;
	};

	base.buildKeyboard = function(name, internal) {
		// o.display is empty when this is called from the scramble extension (when alwaysOpen:true)
		if ( $.isEmptyObject(o.display) ) {
			// set keyboard language
			base.updateLanguage();
		}
		var row, $row, currentSet,
			kbcss = $keyboard.css,
			sets = 0,
			layout = $keyboard.builtLayouts[name || base.layout] = {
				mappedKeys   : {},
				acceptedKeys : []
			},
			acceptedKeys = layout.acceptedKeys = [],

		container = $('<div />')
			.addClass( kbcss.keyboard + ' ' + o.css.container + (o.alwaysOpen ? ' ' + kbcss.alwaysOpen : '') )
			.attr({ 'role': 'textbox' })
			.hide();
		// verify layout or setup custom keyboard
		if ( ( internal && o.layout === 'custom' ) || !$keyboard.layouts.hasOwnProperty(o.layout) ) {
			o.layout = 'custom';
			$keyboard.layouts.custom = o.customLayout || { 'normal' : ['{cancel}'] };
		}
		// Main keyboard building loop
		$.each($keyboard.layouts[ internal ? o.layout : name ], function(set, keySet) {
			// skip layout name & lang settings
			if (set !== '' && !/^(name|lang|rtl)$/i.test(set)) {
				// keep backwards compatibility for change from default to normal naming
				if (set === 'default') { set = 'normal'; }
				sets++;
				$row = $('<div />')
					.attr('name', set) // added for typing extension
					.addClass( kbcss.keySet + ' ' + kbcss.keySet + '-' + set)
					.appendTo(container)
					.toggle( set === 'normal' );

				for ( row = 0; row < keySet.length; row++ ) {
					// remove extra spaces before spliting (regex probably could be improved)
					currentSet = $.trim(keySet[row]).replace(/\{(\.?)[\s+]?:[\s+]?(\.?)\}/g,'{$1:$2}');
					base.buildRow( $row, row, currentSet.split(/\s+/), acceptedKeys );
					$row.find('.' + kbcss.keyButton + ':last').after('<br class="' + kbcss.endRow + '">');
				}
			}
		});

		if (sets > 1) { base.sets = true; }
		layout.hasMappedKeys = !( $.isEmptyObject(layout.mappedKeys) ); // $.isEmptyObject() requires jQuery 1.4+
		layout.$keyboard = container;

		return container;
	};

	base.buildRow = function( $row, row, keys, acceptedKeys ) {
		var t, txt, key, isAction, action, margin,
			kbcss = $keyboard.css;
		for ( key = 0; key < keys.length; key++ ) {
			// used by addKey function
			base.temp = [ $row, row, key ];
			isAction = false;

			// ignore empty keys
			if (keys[key].length === 0) { continue; }

			// process here if it's an action key
			if (/^\{\S+\}$/.test(keys[key])) {
				action = keys[key].match(/^\{(\S+)\}$/)[1];
				// add active class if there are double exclamation points in the name
				if (/\!\!/.test(action)) {
					action = action.replace('!!', '');
					isAction = true;
				}

				// add empty space
				if (/^sp:((\d+)?([\.|,]\d+)?)(em|px)?$/i.test(action)) {
					// not perfect globalization, but allows you to use {sp:1,1em}, {sp:1.2em} or {sp:15px}
					margin = parseFloat( action
						.replace(/,/, '.')
						.match(/^sp:((\d+)?([\.|,]\d+)?)(em|px)?$/i)[1] || 0
					);
					$('<span class="' + kbcss.keyText + '">&nbsp;</span>')
						// previously {sp:1} would add 1em margin to each side of a 0 width span
						// now Firefox doesn't seem to render 0px dimensions, so now we set the
						// 1em margin x 2 for the width
						.width( (action.match(/px/i) ? margin + 'px' : (margin * 2) + 'em') )
						.addClass( kbcss.keySpacer )
						.appendTo($row);
				}

				// add empty button
				if (/^empty(:((\d+)?([\.|,]\d+)?)(em|px)?)?$/i.test(action)) {
					margin = (/:/.test(action)) ? parseFloat( action
						.replace(/,/,'.')
						.match(/^empty:((\d+)?([\.|,]\d+)?)(em|px)?$/i)[1] || 0
					) : '';
					base
						.addKey('', ' ')
						.addClass(o.css.buttonDisabled + ' ' + o.css.buttonEmpty)
						.attr('aria-disabled', true)
						.width( margin ? (action.match('px') ? margin + 'px' : (margin * 2) + 'em') : '' );
				}

				// meta keys
				if (/^meta\d+\:?(\w+)?/i.test(action)) {
					base
						.addKey(action.split(':')[0], action)
						.addClass( kbcss.keyHasActive );
					continue;
				}

				// switch needed for action keys with multiple names/shortcuts or
				// default will catch all others
				txt = action.split(':');
				switch(txt[0].toLowerCase()) {

					case 'a':
					case 'accept':
						base
							.addKey('accept', action)
							.addClass(o.css.buttonAction + ' ' + kbcss.keyAction);
						break;

					case 'alt':
					case 'altgr':
						base
							.addKey('alt', action)
							.addClass( kbcss.keyHasActive );
						break;

					case 'b':
					case 'bksp':
						base.addKey('bksp', action);
						break;

					case 'c':
					case 'cancel':
						base
							.addKey('cancel', action)
							.addClass(o.css.buttonAction + ' ' + kbcss.keyAction);
						break;

					// toggle combo/diacritic key
					case 'combo':
						base
							.addKey('combo', action)
							.addClass( kbcss.keyHasActive )
							.toggleClass(o.css.buttonActive, o.useCombos);
						break;

					// Decimal - unique decimal point (num pad layout)
					case 'dec':
						acceptedKeys.push((base.decimal) ? '.' : ',');
						base.addKey('dec', action);
						break;

					case 'e':
					case 'enter':
						base
							.addKey('enter', action)
							.addClass(o.css.buttonAction + ' ' + kbcss.keyAction);
						break;

					case 'lock':
						base
							.addKey('lock', action)
							.addClass( kbcss.keyHasActive );
						break;

					case 's':
					case 'shift':
						base
							.addKey('shift', action)
							.addClass( kbcss.keyHasActive );
						break;

					// Change sign (for num pad layout)
					case 'sign':
						acceptedKeys.push('-');
						base.addKey('sign', action);
						break;

					case 'space':
						acceptedKeys.push(' ');
						base.addKey('space', action);
						break;

					case 't':
					case 'tab':
						base.addKey('tab', action);
						break;

					default:
						if ($keyboard.keyaction.hasOwnProperty(txt[0])){
							// acceptedKeys.push(action);
							base
								.addKey(txt[0], action)
								.toggleClass( o.css.buttonAction + ' ' + kbcss.keyAction, isAction );
						}

				}

			} else {

				// regular button (not an action key)
				t = keys[key];
				acceptedKeys.push( t === ':' ? t : t.split(':')[0] );
				base.addKey(t, t, true);
			}
		}
	};

	base.destroy = function() {
		clearTimeout(base.timer);
		clearTimeout(base.timer2);
		$(document).unbind(base.namespace);
		$(window).unbind(base.namespace);
		base.el.active = false;
		if (base.$keyboard.length) { base.$keyboard.remove(); }
		var kbcss = $keyboard.css;
		base.$el
			.removeClass( [kbcss.input, kbcss.locked, kbcss.placeholder, kbcss.noKeyboard, kbcss.alwaysOpen, o.css.input].join(' ') )
			.removeAttr('aria-haspopup')
			.removeAttr('role')
			.unbind(base.namespace)
			.removeData('keyboard');
		base = null;
	};

		// Run initializer
		base.init();
	};
	$keyboard.css = {
		// keyboard id suffix
		idSuffix: '_keyboard',
		// element class names
		input: 'ui-keyboard-input',
		wrapper: 'ui-keyboard-preview-wrapper',
		preview: 'ui-keyboard-preview',
		keyboard: 'ui-keyboard',
		keySet: 'ui-keyboard-keyset',
		keyButton: 'ui-keyboard-button',
		keyWide: 'ui-keyboard-widekey',
		keyPrefix: 'ui-keyboard-',
		keyText: 'ui-keyboard-text', // span with button text
		keyHasActive: 'ui-keyboard-hasactivestate',
		keyAction: 'ui-keyboard-actionkey',
		keySpacer: 'ui-keyboard-spacer', // empty keys
		keyToggle: 'ui-keyboard-toggle',
		keyDisabled: 'ui-keyboard-disabled',
		// states
		locked: 'ui-keyboard-lockedinput',
		alwaysOpen: 'ui-keyboard-always-open',
		noKeyboard: 'ui-keyboard-nokeyboard',
		placeholder: 'ui-keyboard-placeholder',
		hasFocus: 'ui-keyboard-has-focus',
		isCurrent: 'ui-keyboard-input-current',
		// validation & autoaccept
		inputValid: 'ui-keyboard-valid-input',
		inputInvalid: 'ui-keyboard-invalid-input',
		inputAutoAccepted: 'ui-keyboard-autoaccepted',
		endRow: 'ui-keyboard-button-endrow' // class added to <br>
	};

	$keyboard.events = {
		// keyboard events
		kbChange: 'keyboardChange',
		kbBeforeClose: 'beforeClose',
		kbBeforeVisible: 'beforeVisible',
		kbVisible: 'visible',
		kbInit: 'initialized',
		kbInactive: 'inactive',
		kbHidden: 'hidden',
		kbRepeater: 'repeater',
		kbKeysetChange: 'keysetChange',
		// input events
		inputAccepted: 'accepted',
		inputCanceled: 'canceled',
		inputChange: 'change',
		inputRestricted: 'restricted'
	};

	// Action key function list
	$keyboard.keyaction = {
		accept : function(base) {
			base.close(true); // same as base.accept();
			return false;     // return false prevents further processing
		},
		alt : function(base, el) {
			base.altActive = !base.altActive;
			base.showKeySet(el);
		},
		bksp : function(base) {
			// the script looks for the '\b' string and initiates a backspace
			base.insertText('\b');
		},
		cancel : function(base) {
			base.close();
			return false; // return false prevents further processing
		},
		clear : function(base) {
			base.$preview.val('');
		},
		combo : function(base) {
			var c = !base.options.useCombos;
			base.options.useCombos = c;
			base.$keyboard.find('.' + $keyboard.css.keyPrefix + 'combo').toggleClass(base.options.css.buttonActive, c);
			if (c) { base.checkCombos(); }
			return false;
		},
		dec : function(base) {
			base.insertText((base.decimal) ? '.' : ',');
		},
		del : function(base) {
			// the script looks for the '{d}' string and initiates a delete
			base.insertText('{d}');
		},
		// resets to base keyset (deprecated because "default" is a reserved word)
		'default' : function(base, el) {
			base.shiftActive = base.altActive = base.metaActive = false;
			base.showKeySet(el);
		},
		// el is the pressed key (button) object; it is null when the real keyboard enter is pressed
		enter : function(base) {return false;
		},
		// caps lock key
		lock : function(base,el) {
			base.last.keyset[0] = base.shiftActive = base.capsLock = !base.capsLock;
			base.showKeySet(el);
		},
		left : function(base) {
			var p = $keyboard.caret( base.$preview );
			if (p.start - 1 >= 0) {
				// move both start and end of caret (prevents text selection) & save caret position
				base.last.start = base.last.end = p.start - 1;
				$keyboard.caret( base.$preview, base.last );
				base.setScroll();
			}
		},
		meta : function(base, el) {
			base.metaActive = !$(el).hasClass(base.options.css.buttonActive);
			base.showKeySet(el);
		},
		next : function(base) {
			base.switchInput(true, base.options.autoAccept);
			return false;
		},
		// same as 'default' - resets to base keyset
		normal : function(base, el) {
			base.shiftActive = base.altActive = base.metaActive = false;
			base.showKeySet(el);
		},
		prev : function(base) {
			base.switchInput(false, base.options.autoAccept);
			return false;
		},
		right : function(base) {
			var p = $keyboard.caret( base.$preview );
			if (p.start + 1 <= base.$preview.val().length) {
				// move both start and end of caret (prevents text selection) && save caret position
				base.last.start = base.last.end = p.start + 1;
				$keyboard.caret( base.$preview, base.last );
				base.setScroll();
			}
		},
		shift : function(base, el) {
			base.last.keyset[0] = base.shiftActive = !base.shiftActive;
			base.showKeySet(el);
		},
		sign : function(base) {
			if(/^\-?\d*\.?\d*$/.test( base.$preview.val() )) {
				base.$preview.val( (base.$preview.val() * -1) );
			}
		},
		space : function(base) {
			base.insertText(' ');
		},
		tab : function(base) {
			var tag = base.el.nodeName,
				o = base.options;
			if (tag === 'INPUT') {
				if (o.tabNavigation) {
					return base.switchInput(!base.shiftActive, true);
				} else {
					// ignore tab key in input
					return false;
				}
			}
			base.insertText('\t');
		},
		Esc : function(base) { return false;
		},	
		Ctrl : function(base) { return false;
		},
		Fn : function(base) { return false;
		},
		Win : function(base) { return false;
		},
		Menu : function(base) { return false;
		},
		Bksp1 : function(base) { base.insertText('\b'); return false;
		},
		toggle : function(base) {
			base.enabled = !base.enabled;
			base.toggle();
		}
	};

	// Default keyboard layouts
	$keyboard.builtLayouts = {};
	$keyboard.layouts = {};

	$keyboard.language = $.extend({}, $keyboard.language, {
		en : {
			display : {
				// check mark - same action as accept
				'a'      : '\u2714:Accept (Shift-Enter)',
				'accept' : 'Accept:Accept (Shift-Enter)',
				// other alternatives \u2311
				'alt'    : 'Alt:\u2325 AltGr',
				// Left arrow (same as &larr;)
				'b'      : '\u232b:Backspace',
				'bksp'   : 'Bksp:Backspace',
				// clear num pad
				'clear'  : 'C:Clear',
				'combo'  : '\u00f6:Toggle Combo Keys',
				// decimal point for num pad (optional), change '.' to ',' for European format
				'dec'    : '.:Decimal',
				// down, then left arrow - enter symbol
				'e'      : '\u23ce:Enter',
				'empty'  : '\u00a0',
				'enter'  : 'Enter:Enter \u23ce',
				// left arrow (move caret)
				'left'   : '\u2190',
				// caps lock
				'lock'   : 'Lock:\u21ea Caps Lock',
				'next'   : 'Next \u21e8',
				'prev'   : '\u21e6 Prev',
				// right arrow (move caret)
				'right'  : '\u2192',
				// thick hollow up arrow
				's'      : '\u21e7:Shift',
				'shift'  : 'Shift:Shift',
				// +/- sign for num pad
				'sign'   : '\u00b1:Change Sign',
				'space'  : '&nbsp;:Space',
				// right arrow to bar (used since this virtual keyboard works with one directional tabs)
				't'      : '\u21e5:Tab',
				// \u21b9 is the true tab symbol (left & right arrows)
				'tab'    : '\u21e5 Tab:Tab',
				// replaced by an image
				'toggle' : ' '
			},

			
		}
	});

	$keyboard.defaultOptions = {
		// set this to ISO 639-1 language code to override language set by the layout
		// http://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
		// language defaults to 'en' if not found
		language     : null,
		rtl          : false,

		// *** choose layout & positioning ***
		layout       : 'qwerty',
		customLayout : null,

		position     : {
			// optional - null (attach to input/textarea) or a jQuery object (attach elsewhere)
			of : null,
			my : 'center top',
			at : 'center top',
			// used when 'usePreview' is false (centers the keyboard at the bottom of the input/textarea)
			at2: 'center bottom'
		},

		// allow jQuery position utility to reposition the keyboard on window resize
		reposition   : true,

		// preview added above keyboard if true, original input/textarea used if false
		usePreview   : true,

		// if true, the keyboard will always be visible
		alwaysOpen   : false,

		// give the preview initial focus when the keyboard becomes visible
		initialFocus : true,

		// if true, keyboard will remain open even if the input loses focus, but closes on escape
		// or when another keyboard opens.
		stayOpen     : false,

		css : {
			// input & preview
			input          : 'ui-widget-content ui-corner-all',
			// keyboard container
			container      : 'ui-widget-content ui-widget ui-corner-all ui-helper-clearfix',
			// default state
			buttonDefault  : 'ui-state-default ui-corner-all',
			// hovered button
			buttonHover    : 'ui-state-hover',
			// Action keys (e.g. Accept, Cancel, Tab, etc); this replaces 'actionClass' option
			buttonAction   : 'ui-state-active',
			// Active keys (e.g. shift down, meta keyset active, combo keys active)
			buttonActive   : 'ui-state-active',
			// used when disabling the decimal button {dec} when a decimal exists in the input area
			buttonDisabled : 'ui-state-disabled',
			buttonEmpty    : 'ui-keyboard-empty'
		},

		// *** Useability ***
		// Auto-accept content when clicking outside the keyboard (popup will close)
		autoAccept      : false,
		// Prevents direct input in the preview window when true
		lockInput    : false,

		// Prevent keys not in the displayed keyboard from being typed in
		restrictInput: false,

		// Check input against validate function, if valid the accept button gets a class name of
		// 'ui-keyboard-valid-input'. If invalid, the accept button gets a class name of
		// 'ui-keyboard-invalid-input'
		acceptValid  : false,

		// if acceptValid is true & the validate function returns a false, this option will cancel
		// a keyboard close only after the accept button is pressed
		cancelClose  : true,

		// tab to go to next, shift-tab for previous (default behavior)
		tabNavigation: false,

		// enter for next input; shift-enter accepts content & goes to next
		// shift + 'enterMod' + enter ('enterMod' is the alt as set below) will accept content and go
		// to previous in a textarea
		enterNavigation : false,
		// mod key options: 'ctrlKey', 'shiftKey', 'altKey', 'metaKey' (MAC only)
		enterMod : 'altKey', // alt-enter to go to previous; shift-alt-enter to accept & go to previous

		// if true, the next button will stop on the last keyboard input/textarea; prev button stops at first
		// if false, the next button will wrap to target the first input/textarea; prev will go to the last
		stopAtEnd : true,

		// Set this to append the keyboard after the input/textarea (appended to the input/textarea parent).
		// This option works best when the input container doesn't have a set width & when the 'tabNavigation'
		// option is true.
		appendLocally: false,
		// When appendLocally is false, the keyboard will be appended to this object
		appendTo     : 'body',

		// If false, the shift key will remain active until the next key is (mouse) clicked on; if true it will
		// stay active until pressed again
		stickyShift  : false,

		// Prevent pasting content into the area
		preventPaste : false,

		// caret placed at the end of any text when keyboard becomes visible
		caretToEnd   : false,

		// caret stays this many pixels from the edge of the input while scrolling left/right;
		// use "c" or "center" to center the caret while scrolling
		scrollAdjustment : 10,

		// Set the max number of characters allowed in the input, setting it to false disables this option
		maxLength    : false,
		// allow inserting characters @ caret when maxLength is set
		maxInsert    : true,

		// Mouse repeat delay - when clicking/touching a virtual keyboard key, after this delay the key will
		// start repeating
		repeatDelay  : 500,

		// Mouse repeat rate - after the repeatDelay, this is the rate (characters per second) at which the
		// key is repeated Added to simulate holding down a real keyboard key and having it repeat. I haven't
		// calculated the upper limit of this rate, but it is limited to how fast the javascript can process
		// the keys. And for me, in Firefox, it's around 20.
		repeatRate   : 20,

		// resets the keyboard to the default keyset when visible
		resetDefault : false,

		// Event (namespaced) on the input to reveal the keyboard. To disable it, just set it to ''.
		openOn       : 'focus',

		// Event (namepaced) for when the character is added to the input (clicking on the keyboard)
		keyBinding   : 'mousedown touchstart',

		// combos (emulate dead keys : http://en.wikipedia.org/wiki/Keyboard_layout#US-International)
		// if user inputs `a the script converts it to à, ^o becomes ô, etc.
		useCombos : true,

/*
		// *** Methods ***
		// commenting these out to reduce the size of the minified version
		// Callbacks - attach a function to any of these callbacks as desired
		initialized   : function(e, keyboard, el) {},
		beforeVisible : function(e, keyboard, el) {},
		visible       : function(e, keyboard, el) {},
		change        : function(e, keyboard, el) {},
		beforeClose   : function(e, keyboard, el, accepted) {},
		accepted      : function(e, keyboard, el) {},
		canceled      : function(e, keyboard, el) {},
		restricted    : function(e, keyboard, el) {},
		hidden        : function(e, keyboard, el) {},
		// called instead of base.switchInput
		switchInput   : function(keyboard, goToNext, isAccepted) {},
		// used if you want to create a custom layout or modify the built-in keyboard
		create        : function(keyboard) { return keyboard.buildKeyboard(); }
*/

		// this callback is called just before the 'beforeClose' to check the value
		// if the value is valid, return true and the keyboard will continue as it should
		// (close if not always open, etc). If the value is not value, return false and the clear the keyboard
		// value ( like this "keyboard.$preview.val('');" ), if desired. The validate function is called after
		// each input, the 'isClosing' value will be false; when the accept button is clicked,
		// 'isClosing' is true
		validate    : function(keyboard, value, isClosing) { return true; }

	};

	// for checking combos
	$keyboard.comboRegex = /([`\'~\^\"ao])([a-z])/mig;

	// store current keyboard element; used by base.isCurrent()
	$keyboard.currentKeyboard = '';

	$('<!--[if lte IE 8]><script>jQuery("body").addClass("oldie");</script><![endif]--><!--[if IE]>' +
		'<script>jQuery("body").addClass("ie");</script><![endif]-->').appendTo('body').remove();
	$keyboard.msie = $('body').hasClass('oldie'); // Old IE flag, used for caret positioning
	$keyboard.allie = $('body').hasClass('ie');

	$keyboard.watermark = (typeof(document.createElement('input').placeholder) !== 'undefined');

	$keyboard.checkCaretSupport = function() {
		if ( typeof $keyboard.checkCaret !== 'boolean' ) {
			// Check if caret position is saved when input is hidden or loses focus
			// (*cough* all versions of IE and I think Opera has/had an issue as well
			var $temp = $('<div style="height:0px;width:0px;overflow:hidden;"><input type="text" value="testing"></div>')
				.prependTo( 'body' ); // stop page scrolling
			$keyboard.caret( $temp.find('input'), 3, 3 );
			// Also save caret position of the input if it is locked
			$keyboard.checkCaret = $keyboard.caret( $temp.find('input').hide().show() ).start !== 3;
			$temp.remove();
		}
		return $keyboard.checkCaret;
	};

	$keyboard.caret = function($el, param1, param2) {
		if ( !$el.length || $el.is(':hidden') || $el.css('visibility') === 'hidden' ) {
			return {};
		}
		var start, end, txt, pos;
		// set caret position
		if (typeof param1 !== 'undefined') {
			// allow setting caret using ( $el, { start: x, end: y } )
			if (typeof param1 === 'object' && 'start' in param1 && 'end' in param1) {
				start = param1.start;
				end = param1.end;
			// set caret using ( $el, start, end );
			} else if (typeof param1 === 'number' && typeof param2 === 'number') {
				start = param1;
				end = param2;
			}
			// *** SET CARET POSITION ***
			// modify the line below to adapt to other caret plugins
			return $el.caret( start, end );
		}
		// *** GET CARET POSITION ***
		// modify the line below to adapt to other caret plugins
		pos = $el.caret();
		start = pos.start;
		end = pos.end;

		// *** utilities ***
		txt = ($el[0].value || $el.text() || '');
		return {
			start : start,
			end : end,
			// return selected text
			text : txt.substring( start, end ),
			// return a replace selected string method
			replaceStr : function( str ) {
				return txt.substring( 0, start ) + str + txt.substring( end, txt.length );
			}
		};
	};

	$.fn.keyboard = function(options){
		return this.each(function(){
			if (!$(this).data('keyboard')) {
				/*jshint nonew:false */
				(new $.keyboard(this, options));
			}
		});
	};

	$.fn.getkeyboard = function(){
		return this.data('keyboard');
	};

/* Copyright (c) 2010 C. F., Wong (<a href="http://cloudgen.w0ng.hk">Cloudgen Examplet Store</a>)
 * Licensed under the MIT License:
 * http://www.opensource.org/licenses/mit-license.php
 * Highly modified from the original
  */

$.fn.caret = function( start, end ) {
	if ( typeof this[0] === 'undefined' || this.is(':hidden') || this.css('visibility') === 'hidden' ) {
		return this;
	}
	var selRange, range, stored_range, txt, val,
		selection = document.selection,
		$el = this,
		el = $el[0],
		sTop = el.scrollTop,
		ss = false,
		supportCaret = true;
	try {
		ss = 'selectionStart' in el;
	} catch(err){
		supportCaret = false;
	}
	if (supportCaret && typeof start !== 'undefined') {
		if (!/(email|number)/i.test(el.type)) {
			if (ss){
				el.selectionStart = start;
				el.selectionEnd = end;
			} else {
				selRange = el.createTextRange();
				selRange.collapse(true);
				selRange.moveStart('character', start);
				selRange.moveEnd('character', end - start);
				selRange.select();
			}
		}
		// must be visible or IE8 crashes; IE9 in compatibility mode works fine - issue #56
		if ( $el.is(':visible') || $el.css('visibility') !== 'hidden' ) { el.focus(); }
		el.scrollTop = sTop;
		return this;
	} else {
		if (/(email|number)/i.test(el.type)) {
			// fix suggested by raduanastase (https://github.com/Mottie/Keyboard/issues/105#issuecomment-40456535)
			start = end = $el.val().length;
		} else if (ss) {
			start = el.selectionStart;
			end = el.selectionEnd;
		} else if (selection) {
			if (el.nodeName === 'TEXTAREA') {
				val = $el.val();
				range = selection.createRange();
				stored_range = range.duplicate();
				stored_range.moveToElementText(el);
				stored_range.setEndPoint('EndToEnd', range);
				// thanks to the awesome comments in the rangy plugin
				start = stored_range.text.replace(/\r/g, '\n').length;
				end = start + range.text.replace(/\r/g, '\n').length;
			} else {
				val = $el.val().replace(/\r/g, '\n');
				range = selection.createRange().duplicate();
				range.moveEnd('character', val.length);
				start = (range.text === '' ? val.length : val.lastIndexOf(range.text));
				range = selection.createRange().duplicate();
				range.moveStart('character', -val.length);
				end = range.text.length;
			}
		} else {
			// caret positioning not supported
			start = end = (el.value || '').length;
		}
		txt = (el.value || '');
		return {
			start : start,
			end : end,
			text : txt.substring( start, end ),
			replace : function(str) {
				return txt.substring( 0, start ) + str + txt.substring( end, txt.length );
			}
		};
	}
};

return $keyboard;

}));


/*! jQuery UI Virtual Keyboard previewKeyset v1.1 *//*
 * for Keyboard v1.18+ only (updated 3/7/2015)
 *
 * By Rob Garrison (aka Mottie & Fudgey)
 * Licensed under the MIT License
 *
 * Use this extension with the Virtual Keyboard to add a preview
 * of other keysets to the main keyboard.
 *
 * Requires:
 *  jQuery
 *  Keyboard plugin : https://github.com/Mottie/Keyboard
 *
 * Setup:
 *  $('.ui-keyboard-input')
 *   .keyboard(options)
 *   .previewKeyset();
 *
 *  // or if targeting a specific keyboard
 *  $('#keyboard1')
 *   .keyboard(options)     // keyboard plugin
 *   .previewKeyset();    // this keyboard extension
 *
 */
/*jshint browser:true, jquery:true, unused:false */
/*global require:false, define:false, module:false */
;(function(factory) {
	if (typeof define === 'function' && define.amd) {
		define(['jquery'], factory);
	} else if (typeof module === 'object' && typeof module.exports === 'object') {
		module.exports = factory(require('jquery'));
	} else {
		factory(jQuery);
	}
}(function($) {
'use strict';
$.keyboard = $.keyboard || {};

$.fn.previewKeyset = function( options ) {
	return this.each( function() {
		// make sure a keyboard is attached
		var base = $( this ).data( 'keyboard' ),
			defaults = {
				sets : [ 'normal', 'shift', 'clavierClean', 'clavierCleanShift', 'alt', 'alt-shift' ]
			};

		if ( !base ) { return; }

		base.previewKeyset_options = $.extend( {}, defaults, options );

		base.previewKeyset = function() {
			var kbcss = $.keyboard.css,
				sets = base.previewKeyset_options.sets,
				// only target option defined sets
				$sets = base.$keyboard.find( '.' + kbcss.keySet ).filter( '[name="' + sets.join('"],[name="') + '"]' );
			if ( $sets.length > 1 ) {
				// start with normal keyset & find all non-action buttons
				$sets.eq( 0 ).find( '.' + kbcss.keyButton ).not( '.' + kbcss.keyAction ).each(function(){
					var indx, nam,
						data = {},
						len = sets.length,
						// find all keys with the same position
						$sibs = $sets.find( 'button[data-pos="' + $(this).attr('data-pos') + '"]' );
					for ( indx = 0; indx < len; indx++ ) {
						nam = $sibs.eq( indx ).parent().attr( 'name' );
						if ( $.inArray( nam, sets ) >= 0 ) {
							data[ 'data-' + nam ] = $sibs.eq( indx ).find( '.' + kbcss.keyText ).text();
						}
					}
					$sibs.attr( data );
				});
			}
		};

		// visible event is fired before this extension is initialized, so check!
		if (base.options.alwaysOpen && base.isVisible()) {
			base.previewKeyset();
		} else {
			base.$el.bind($.keyboard.events.kbBeforeVisible + base.namespace + 'Preview', function() {
				base.previewKeyset();
			});
		}

	});
};

}));


/*! jQuery UI Virtual Keyboard Typing Simulator v1.9 *//*
 * for Keyboard v1.18+ only (3/11/2015)
 *
 * By Rob Garrison (aka Mottie & Fudgey)
 * Licensed under the MIT License
 *
 * Use this extension with the Virtual Keyboard to simulate
 * typing for tutorials or whatever else use you can find
 *
 * Requires:
 *  jQuery
 *  Keyboard plugin : https://github.com/Mottie/Keyboard
 *
 * Setup:
 *  $('.ui-keyboard-input')
 *   .keyboard(options)
 *   .addTyping(typing-options);
 *
 *  // or if targeting a specific keyboard
 *  $('#keyboard1')
 *   .keyboard(options)
 *   .addTyping(typing-options);
 *
 * Basic Usage:
 *  // To disable manual typing on the virtual keyboard, just set "showTyping" option to false
 *  $('#keyboard-input').keyboard(options).addTyping({ showTyping: false });
 *
 *  // Change the default typing delay (time the virtual keyboard highlights the manually typed key) - default = 250 milliseconds
 *  $('#keyboard-input').keyboard(options).addTyping({ delay: 500 });
 *
 *  // get keyboard object, open it, then start typing simulation
 *  $('#keyboard-input').getkeyboard().reveal().typeIn('Hello World', 700);
 *
 *  // get keyboard object, open it, type in "This is a test" with 700ms delay between types, then accept & close the keyboard
 *  $('#keyboard-input').getkeyboard().reveal().typeIn('This is a test', 700, function(){ $('#keyboard-input').getkeyboard().close(true); });
 */

// EXAMPLES:
// $('#inter').getkeyboard().reveal().typeIn('\tHello \b\n\tWorld', 500);
// $('#meta').getkeyboard().reveal().typeIn('abCDd11123\u2648\u2649\u264A\u264B', 700, function(){ alert('all done!'); });
/*jshint browser:true, jquery:true, unused:false */
/*global require:false, define:false, module:false */
;(function(factory) {
	if (typeof define === 'function' && define.amd) {
		define(['jquery'], factory);
	} else if (typeof module === 'object' && typeof module.exports === 'object') {
		module.exports = factory(require('jquery'));
	} else {
		factory(jQuery);
	}
}(function($) {
	$.fn.addTyping = function(options){
		//Set the default values, use comma to separate the settings, example:
		var defaults = {
			showTyping : true,
			lockTypeIn : false,
			delay      : 250
		},
		$keyboard = $.keyboard;
		return this.each(function(){
			// make sure a keyboard is attached
			var o, base = $(this).data('keyboard');
			if (!base) { return; }

			// variables
			o = base.typing_options = $.extend({}, defaults, options);
			base.typing_keymap = {
				' '   : 'space',
				'"'   : '34',
				"'"   : '39',
				'&nbsp;' : 'space',
				'\b'  : 'bksp', // delete character to the left
				'{b}' : 'bksp',
				'{d}' : 'del',  // delete character to the right
				'{l}' : 'left', // move caret left
				'{r}' : 'right', // move caret right
				'\n'  : 'enter',
				'\r'  : 'enter',
				'{e}' : 'enter',
				'\t'  : 'tab',
				'{t}' : 'tab'
			};
			base.typing_xref = {
				8  : 'bksp',
				9  : 'tab',
				13 : 'enter',
				32 : 'space',
				46 : 'del'
			};
			base.typing_event = false;
			base.typing_namespace = base.namespace + 'typing';
			// save lockInput setting
			o.savedLockInput = base.options.lockInput;

			base.typing_setup = function(){
				var kbevents = $keyboard.events,
					namespace = base.typing_namespace;
				base.$el.add( base.$preview ).unbind(namespace);
				base.$el
					.bind([ kbevents.kbHidden, kbevents.kbInactive, '' ].join( namespace + ' ' ), function(e){
						base.typing_reset();
					})
					.bind( $keyboard.events.kbBeforeVisible + namespace, function(){
						base.typing_setup();
					});
				base.$allKeys
					.bind('mousedown' + namespace, function(){
						base.typing_reset();
					});
				base.$preview
				.bind('keyup' + namespace, function(e){
					if (o.init && o.lockTypeIn) { return false; }
					if (e.which >= 37 && e.which <=40) { return; } // ignore arrow keys
					if (e.which === 16) { base.shiftActive = false; }
					if (e.which === 18) { base.altActive = false; }
					if (e.which === 16 || e.which === 18) {
						base.showKeySet();
						// Alt key will shift focus to the menu - doesn't work in Windows
						setTimeout(function(){ base.$preview.focus(); }, 200);
						return;
					}
				})
				// change keyset when either shift or alt is held down
				.bind('keydown' + namespace, function(e){
					if (o.init && o.lockTypeIn) { return false; }
					e.temp = false; // prevent repetitive calls while keydown repeats.
					if (e.which === 16) { e.temp = !base.shiftActive; base.shiftActive = true; }
					// it should be ok to reset e.temp, since both alt and shift will call this function separately
					if (e.which === 18) { e.temp = !base.altActive; base.altActive = true; }
					if (e.temp) {
						base.showKeySet();
						base.$preview.focus(); // Alt shift focus to the menu
					}
					base.typing_event = true;
					// Simulate key press for tab and backspace since they don't fire the keypress event
					if (e.which === 8 || e.which === 9) {
						base.typing_findKey( '', e ); // pass event object
					}

				})
				.bind('keypress' + namespace, function(e){
					if (o.init && o.lockTypeIn) { return false; }
					// Simulate key press on virtual keyboard
					if (base.typing_event && !base.options.lockInput) {
						base.typing_reset();
						base.typing_event = true;
						base.typing_findKey( '', e ); // pass event object
					}
				});
			};

			base.typing_reset = function(){
				base.typing_event = o.init = false;
				o.text = '';
				o.len = o.current = 0;
				base.options.lockInput = o.savedLockInput;
				// clearTimeout(base.typing_timer);
			};

			// Store typing text
			base.typeIn = function(txt, delay, callback, e){
				if (!base.isVisible()) {
					// keyboard was closed
					clearTimeout(base.typing_timer);
					base.typing_reset();
					return;
				}
				if (!base.typing_event){

					if (o.init !== true) {
						o.init = true;
						base.options.lockInput = o.lockTypeIn;
						o.text = txt || o.text || '';
						o.len = o.text.length;
						o.delay = delay || 300;
						o.current = 0; // position in text string
						if (callback) {
							o.callback = callback;
						}
					}
					// function that loops through and types each character
					txt = o.text.substring( o.current, ++o.current );
					// add support for curly-wrapped single character: {l}, {r}, {d}, etc.
					if ( txt === '{' && o.text.substring( o.current + 1, o.current + 2 ) === '}' ) {
						txt += o.text.substring( o.current, o.current += 2 );
					}
					base.typing_findKey( txt, e );
				} else if (typeof txt === 'undefined') {
					// typeIn called by user input
					base.typing_event = false;
					base.options.lockInput = o.savedLockInput;
					return;
				}

			};

			base.typing_findKey = function(txt, e){
				var tar, m, n, k, key, ks, meta, set,
					kbcss = $keyboard.css,
					mappedKeys = $keyboard.builtLayouts[base.layout].mappedKeys;
				// stop if keyboard is closed
				if ( !base.isOpen || !base.$keyboard.length ) { return; }
				ks = base.$keyboard.find('.' + kbcss.keySet);
				k = txt in base.typing_keymap ? base.typing_keymap[txt] : txt;
				// typing_event is true when typing on the actual keyboard - look for actual key
				// All of this breaks when the CapLock is on... unable to find a cross-browser method that works.
				tar = '.' + kbcss.keyButton + '[data-action="' + k + '"]';
				if (base.typing_event && e) {
					if (base.typing_xref.hasOwnProperty(e.keyCode || e.which)) {
						// special named keys: bksp, tab and enter
						tar = '.' + kbcss.keyPrefix + base.typing_xref[e.keyCode || e.which];
					} else {
						m = String.fromCharCode(e.charCode || e.which);
						tar = (mappedKeys.hasOwnProperty(m)) ?
							'.' + kbcss.keyButton + '[data-action="' + mappedKeys[m]  + '"]' :
							'.' + kbcss.keyPrefix + (e.charCode || e.which);
					}
				}
				// find key
				key = ks.filter(':visible').find(tar);
				if (key.length) {
					// key is visible, simulate typing
					base.typing_simulateKey(key, txt, e);
				} else {
					// key not found, check if it is in the keymap (tab, space, enter, etc)
					if (base.typing_event) {
						key = ks.find(tar);
					} else {
						// key not found, check if it is in the keymap (tab, space, enter, etc)
						n = txt in base.typing_keymap ? base.typing_keymap[txt] : txt.charCodeAt(0);
						// find actual key on keyboard
						key = ks.find('.' + kbcss.keyPrefix + n);
					}

					// find the keyset
					set = key.closest('.' + kbcss.keySet);

					// figure out which keyset the key is in then simulate clicking on that meta key, then on the key
					if (set.attr('name')) {
						// get meta key name
						meta = set.attr('name');
						// show correct key set
						base.shiftActive = /shift/.test(meta);
						base.altActive = /alt/.test(meta);
						base.metaActive = base.last.keyset[2] = (meta).match(/meta\d+/) || false;
						// make the plugin think we're passing it a jQuery object with a name
						base.showKeySet({ name : base.metaActive});

						// Add the key
						base.typing_simulateKey(key, txt, e);
					} else {
						if (!base.typing_event) {
							// Key doesn't exist on the keyboard, so just enter it
							if (txt in base.typing_keymap && base.typing_keymap[txt] in $keyboard.keyaction) {
								$keyboard.keyaction[base.typing_keymap[txt]](base, key, e);
							} else {
								base.insertText(txt);
							}
							base.checkCombos();
							base.$el.trigger( $keyboard.events.kbChange, [ base, base.el ] );
						}
					}

				}

				if (o.current <= o.len && o.len !== 0){
					if (!base.isVisible()) { return; } // keyboard was closed, abort!!
					setTimeout(function(){ base.typeIn(); }, o.delay);
				} else if (o.len !== 0){
					// o.len is zero when the user typed on the actual keyboard during simulation
					base.typing_reset();
					if ($.isFunction(o.callback)) {
						// ensure all typing animation is done before the callback
						setTimeout(function(){
							// if the user typed during the key simulation, the "o" variable may sometimes be undefined
							if ($.isFunction(o.callback)) {
								o.callback(base);
							}
						}, o.delay);
					}
					return;
				} else {
					base.typing_reset();
				}
			};

			// mouseover the key, add the text directly, then mouseout on the key
			base.typing_simulateKey = function(el, txt, e){
				var len = el.length;
				if (len) { el.filter(':visible').trigger('mouseenter' + base.namespace); }
				base.typing_timer = setTimeout(function(){
					var len = el.length;
					if (len) { setTimeout(function(){ el.trigger('mouseleave' + base.namespace); }, o.delay/3); }
					if (!base.isVisible()) { return; }
					if (!base.typing_event) {
						if (txt in base.typing_keymap && base.typing_keymap[txt] in $keyboard.keyaction) {
							e = e || $.Event('keypress');
							e.target = el; // "Enter" checks for the e.target
							$keyboard.keyaction[base.typing_keymap[txt]](base, el, e );
						} else {
							base.insertText(txt);
						}
						base.checkCombos();
						base.$el.trigger( $keyboard.events.kbChange, [ base, base.el ] );
					}
				}, o.delay/3);
			};

			if (o.showTyping) {
				// visible event is fired before this extension is initialized, so check!
				if (base.options.alwaysOpen && base.isVisible()) {
					base.typing_setup();
				}
				// capture and simulate typing
				base.$el.bind( $keyboard.events.kbBeforeVisible + base.typing_namespace, function(){
					base.typing_setup();
				});
			}

		});
	};

}));

/* Wolof Keyboard Layout  ==> from keyboard-layouts-microsoft.js
 * generated from http://www.microsoft.com/resources/msdn/goglobal/keyboards/kbdwol.html
 */
jQuery.keyboard.layouts['ms-Wolof'] = {
	"name" : "ms-Wolof",
	"lang" : ["wo"],
	"normal" : [
	    "{Esc} \u00e3 & \u00e9 \u0022 ' ( - \u00f1 _ \u014b \u00e0 ) = {Bksp1}",
		"{tab} a z e r t y u i o p ^ \u00f3 *",
		"{lock} q s d f g h j k l m \u00f9 {enter}",
		"{shift} < w x c v b n , ; : ! {shift}",
		"{Ctrl} {Fn} {Win} {alt} {space} {alt} {Menu} {Ctrl}"
	],
	"shift" : [
		"{Esc} \u00c3 1 2 3 4 5 6 7 8 9 0 \u00c9 + {Bksp1}",
		"{tab} A Z E R T Y U I O P \u00a8 \u00d3 \u00d1",
		"{lock} Q S D F G H J K L M \u00c0 {enter}",
		"{shift} > W X C V B N ? . / Ŋ {shift}",
		"{Ctrl} {Fn} {Win} {alt} {space} {alt} {Menu} {Ctrl}"
	],
	"clavierClean" : [
		"&nbsp; \u00c3 1 2 3 4 5 6 7 8 9 0 \u00c9 + &nbsp;",
		"{tab} &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; \u00a8 \u00d3 \u00d1",
		"{lock} &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; \u00c0 {enter}",
		"{shift} > &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ? . / Ŋ {shift}",
		"&nbsp; &nbsp; &nbsp; {alt} {space} {alt} &nbsp; &nbsp;"
	],
	
	"clavierCleanShift" : [
		"&nbsp; \u00e3 & \u00e9 \u0022 ' ( - \u00f1 _ \u014b \u00e0 ) = &nbsp;",
		"{tab} &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ^ \u00f3 *",
		"{lock} &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; \u00f9 {enter}",
		"{shift} < &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; , ; : ! {shift}",
		"&nbsp; &nbsp; &nbsp; {alt} {space} {alt} &nbsp; &nbsp;"
	],
	"alt" : [
		"{Esc} {empty} {empty} ~ # { [ | ` \u005c ^ @ ] } {Bksp1}",
		"{tab} {empty} {empty} \u20ac {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} \u00a4 {empty}",
		"{lock} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {enter}",
		"{shift} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {empty} {shift}",
		"{Ctrl} {Fn} {Win} {alt} {space} {alt} {Menu} {Ctrl}"
	]
};

