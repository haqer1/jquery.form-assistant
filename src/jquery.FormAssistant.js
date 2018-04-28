/*
 * Patch up jQuery 1.9+ for classic-style browser detection (http://code.jquery.com/jquery-migrate-1.4.1.js).
 * This is only used for old browser detection, so should be fine even without making updates going forward.
 */
jQuery.uaMatch = function( ua ) {
	ua = ua.toLowerCase();

	var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
		/(webkit)[ \/]([\w.]+)/.exec( ua ) ||
		/(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
		/(msie) ([\w.]+)/.exec( ua ) ||
		ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) ||
		[];

	return {
		browser: match[ 1 ] || "",
		version: match[ 2 ] || "0"
	};
};

// Don't clobber any existing jQuery.browser in case it's different
if ( !jQuery.browser ) {
	matched = jQuery.uaMatch( navigator.userAgent );
	browser = {};

	if ( matched.browser ) {
		browser[ matched.browser ] = true;
		browser.version = matched.version;
	}

	// Chrome is Webkit, but Webkit is also Safari.
	if ( browser.chrome ) {
		browser.webkit = true;
	} else if ( browser.webkit ) {
		browser.safari = true;
	}

	jQuery.browser = browser;
}
/**
 * Form assistant jquery plugin. For now, usable for notification of form element changes 
 * (including support for forms with (some) pre-populated fields &/or forms reloaded using AJAX &/or a parent element containing more than 1 form). 
 * Supports old and new browsers. For old browsers, a timeout callback is used to capture some 
 * changes asynchronously (mouse-driven selections on context menu for text input and textarea).
 * 
 * Sample usage:
 * jQuery("#" +formId).FormAssistant({
 *   onChange: function(element, event) {
 *     _this.resetResponseContainer();
 *   }
 * });
 * 
 * @param options                 Custom options
 * @option onChange (required)    Change callback.
 * @option inputSelector          Form element types to capture changes in.
 * @option inputNotSelector       Form element types not to capture changes in.
 * @option eventsBound            Main events to bind (old browsers are bound for keyup unconditionally).
 * @option dataKey                Key to use for data storage.
 * @option oldBrowserTimeoutDelay Timeout delay for old browser change callbacks.
 *
 * @see  #onProgrammaticChange
 * 
 * @author Reşat SABIQ
 * @version: 1.1.0
 */
(function( $ ) {
  $.extend({
    FormAssistant: new function() {
      var NAME = "FormAssistant";
      var defaults = {
        inputSelector:    "input, textarea, select",
        inputNotSelector: "input[type='button'], input[type='hidden'], input[type='image'], input[type='reset'], input[type='submit']",
        // change: required to detect submit click, and navigation away; keypress: required to detect Enter; 
        // focus: unnecessary; paste: doesn't get the new value, so probably not needed
        eventsBound:      "change keypress textInput input",
        dataKey:          NAME,
        onChange:         function (element) { 
          return;
        },
        oldBrowserTimeoutDelay: 200
      };
      var settings = null;
      var loggingSupported = console.log ? true : false;

      /**
       * Constructor.
       */
      this.construct = function(options) {
        if (options.onChange == null)
          $.error("options.onChange is required for jquery." +NAME+ '.');
        settings = $.extend(defaults, options);
        $.browser.chrome = /chrome/.test(navigator.userAgent.toLowerCase());
        if($.browser.chrome) 
          // If it is chrome then jQuery thinks it's safari so we have to tell it it isn't
          $.browser.safari = false;
        var ua = $.browser;
        var version = parseInt(ua.version.slice(0,3));
        // Old browser additions:
        if ((ua.mozilla && version < 4) || (ua.msie && version < 9) || (ua.chrome && version < 15))
          constructForOldBrowser(this);
        // Up-to-date browser: 
        return this.each(function() {
          var collection = getInnerElementCollection(this);
          collection.each(function(index) {
            var element = collection[index];
            if (loggingSupported)
              console.log("FormAssistant: " +element);
            var data = ensureData(element);
            data.value = element.value;
            var type = element.getAttribute("type");
            if (type == "checkbox" || type == "radio") 
              data.checked = element.checked;
          });

          collection.bind(settings.eventsBound, function(event) {
            changeListener(this, event);
          });
        });
      }
      
      /**
       * This method may need to be called for reliable detection of value changes 
       * after a programmatic change of the value (for instance, for select elements).
       */
      this.onProgrammaticChange = function(element, value, prop) {
        var data = ensureData(element);
        if (prop) {
          data[prop] = value;
        } else
          data.value = value;
      }
      
      function ensureData(element) {
        var data = jQuery(element).data(settings.dataKey);
        if (!data) {
          data = {};
          jQuery(element).data(settings.dataKey, data);
        }
        return data;
      }

      function isChanged(element, data) {
        var checkedDifferent = false;
        var additionalLogging = "";
        if (element.nodeName.toLowerCase() == "input") {
          var type = element.getAttribute("type");
          if (type == "checkbox" || type == "radio") {
            checkedDifferent = element.checked != data.checked;
            if (checkedDifferent && loggingSupported)
              additionalLogging = " '" +element.checked+ "' != '" +data.checked+ "'";
          }
        }
        var valueChanged = element.value != data.value;
        var changed = (valueChanged && !(data.value == undefined && element.value == "")) || checkedDifferent;
        if (changed && loggingSupported) {
          var sign = valueChanged ? " != " : " == ";
          console.log("FormAssistant: " +element.id+ " '" +element.value+ "'" +sign+ "'" +data.value+ "'" +additionalLogging);
        }
        return changed;
      }

      function uncheckRadioSiblings(element) {
        jQuery("input[name=" +element.name).each(function() {
          if (this.value != element.value) {
            jQuery(this).prop("checked", false);
            ensureData(this).checked = false;
          }
        });
      }

      function changeListener(element, event) {
        var data = ensureData(element);
        if (isChanged(element, data)) {
          var type = element.getAttribute("type");
          if (type == "radio") 
             uncheckRadioSiblings(element)
          data.value = element.value;
          data.checked = element.checked;
          // not clearing validation for reference
          settings.onChange(element, event);
        } 
      }

      function getInnerElementCollection(element) {
        var collection = null;
        if (settings.inputSelector) {
          if (!settings.inputNotSelector)
            collection = $(element).find(settings.inputSelector);
          else
            collection = $(element).find(settings.inputSelector).not(settings.inputNotSelector);
        } else {
          if (!settings.inputNotSelector)
            collection = $(element);
          else
            collection = $(element).not(settings.inputNotSelector);
        }
        return collection;
      }
      
      function constructForOldBrowser($this) {
        $this.each(function() {
          var textFieldCollection = getInnerElementCollection(this).not("select");
          textFieldCollection.keyup(function(event) {
              changeListener(this, event);
          });
          textFieldCollection.each(function() {
            var _this = this;
            function recursiveTimeoutCallback() {
              var data = jQuery(_this).data(settings.dataKey);
              changeListener(_this);
              window.setTimeout(recursiveTimeoutCallback, settings.oldBrowserTimeoutDelay);
            }
            window.setTimeout(recursiveTimeoutCallback, settings.oldBrowserTimeoutDelay);
          });
          var selectCollection = getInnerElementCollection(this).filter("select");
          selectCollection.keyup(function(event) {
            changeListener(this, event);
          });
        });
      }
    }
  });

  $.fn.FormAssistant = function( method ) {
    if ( $.FormAssistant[method] ) {
      return $.FormAssistant[method].apply(this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
      return $.FormAssistant.construct.apply( this, arguments );
    } else {
      $.error( 'Method ' +  method + ' does not exist on jQuery.FormAssistant' );
    }    
  };
})( jQuery );
