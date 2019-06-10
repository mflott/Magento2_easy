/**
 * Copyright © 2015 Magento. All rights reserved.
 * See COPYING.txt for license details.
 */
/*jshint browser:true jquery:true*/
/*global alert*/
define([
    "jquery",
    'Magento_Ui/js/modal/alert',
    "jquery/ui",
    "mage/translate",
    "mage/mage",
    "mage/validation"
], function (jQuery, alert) {
    "use strict";
    jQuery.widget('mage.nwtdibsCheckout', {
        options: {
            shippingMethodFormSelector: '#shipping-method-form',
            shippingMethodLoaderSelector: '#shipping-method-loader',
            getShippingMethodButton: '#shipping-method-button',
            newsletterFormSelector: '#dibs-easy-checkout-newsletter-form',
            commentFormSelector: '#dibskassan-comment',
            couponFormSelector: '#discount-coupon-form',
            cartContainerSelector: '#details-table',
            waitLoadingContainer: '#review-please-wait',
            ctrlkey: null,
            ctrlcookie: 'dibs-easy-checkoutCartCtrlKey',
            dibsCountryChange: false,
            dibsShippingChange: false,
            hasInitFlag: false,
            shippingAjaxInProgress: false,
            scrollTrigger: '.go-to.dibs-btn',
            scrollTarget: '.dibs-checkout-wrapper'
        },
        _create: function () {
            this._bindEvents();
            this.dibsApiChanges;
            this.uiManipulate();
            this.scrollToPayment();
        },
        _bindCartAjax: function () {
            var cart = this.options.cartContainerSelector;
            var inputs = jQuery(cart).find('.ajax-qty-change');
            var _this = this;
            jQuery.each(inputs, function (i, input) {
                var inputQty = jQuery(input);
                var data_submit_url = inputQty.data('cart-url-submit');
                var data_refresh_url = inputQty.data('cart-url-update');
                var data_remove_url = inputQty.data('cart-url-remove');
                var increment = inputQty.siblings('.input-number-increment');
                var decrement = inputQty.siblings('.input-number-decrement');
                var remove = inputQty.parent().siblings('.remove-product');
                var prevVal = false;

                if (increment.data('binded')) return;
                if (decrement.data('binded')) return;
                if (remove.data('binded')) return;

                increment.data('binded', true);
                decrement.data('binded', true);
                remove.data('binded', true);

                increment.on('click', function () {
                    inputQty.val(parseInt(inputQty.val()) + 1);
                    if (typeof ajaxActionTriggerTimeout !== "undefined") {
                        clearTimeout(ajaxActionTriggerTimeout);
                    }
                    window.ajaxActionTriggerTimeout = setTimeout(function () {
                        inputQty.trigger('change');
                    }, 1000);
                });
                decrement.on('click', function () {
                    var v = parseInt(inputQty.val());
                    if (v < 2) return;
                    inputQty.val(v - 1);
                    if (typeof ajaxActionTriggerTimeout !== "undefined") {
                        clearTimeout(ajaxActionTriggerTimeout);
                    }
                    window.ajaxActionTriggerTimeout = setTimeout(function () {
                        inputQty.trigger('change');
                    }, 1000);
                });
                remove.on('click', function () {
                    var c = confirm(jQuery.mage.__('Are you sure you want to remove this?'));
                    if (c == true) {
                        var data = {
                            item_id: inputQty.data('cart-product-id'),
                            form_key: inputQty.data('cart-form-key')
                        };
                        jQuery.ajax({
                            type: "POST",
                            url: data_remove_url,
                            data: data,
                            beforeSend: function () {
                                _this._ajaxBeforeSend();
                            },
                            complete: function () {
                            },
                            success: function (data) {
                                if (!data.success) {
                                    if (data.error_message) {
                                        confirm(data.error_message);
                                    }
                                }
                                _this._ajaxSubmit(data_refresh_url);
                            }
                        });
                    }
                });
                inputQty.on('keypress', function (e) {
                    if (e.keyCode == "1") {
                        inputQty.trigger('change');
                        return false;
                    }
                    ;
                }).on('focus', function () {
                    prevVal = jQuery(inputQty).val();
                }).on('change', function () {
                    var data = {
                        item_id: inputQty.data('cart-product-id'),
                        form_key: inputQty.data('cart-form-key'),
                        item_qty: inputQty.val()
                    };
                    if (data.item_qty == 0) {
                        jQuery(inputQty).val(prevVal);
                        return false;
                    }
                    jQuery.ajax({
                        type: "POST",
                        url: data_submit_url,
                        data: data,
                        beforeSend: function () {
                            _this._ajaxBeforeSend();
                        },
                        complete: function () {
                        },
                        success: function (data) {
                            if (!data.success) {
                                if (data.error_message) {
                                    confirm(data.error_message);
                                }
                            }
                            _this._ajaxSubmit(data_refresh_url);
                        }
                    });
                });
            });
        },

        _bindEvents: function (block) {
            //$blocks = ['shipping_method','cart','coupon','messages', 'dibs','newsletter','comment'];

            block = block ? block : null;
            if (!block || block == 'shipping') {
                jQuery(this.options.shippingMethodLoaderSelector).on('submit', jQuery.proxy(this._loadShippingMethod, this));
            }
            if (!block || block == 'shipping_method') {
                jQuery(this.options.shippingMethodFormSelector).find('input[type=radio]').on('change', jQuery.proxy(this._changeShippingMethod, this));
            }
            if (!block || block == 'newsletter') {
                jQuery(this.options.newsletterFormSelector).find('input[type=checkbox]').on('change', jQuery.proxy(this._changeSubscriptionStatus, this));
            }
            if (!block || block == 'comment') {
                jQuery(this.options.commentFormSelector).on('submit', jQuery.proxy(this._saveComment, this));
                this.checkValueOfInputs(jQuery(this.options.commentFormSelector));
            }
            if (!block || block == 'cart') {
                this._bindCartAjax();
            }
            if (!block || block == 'coupon') {
                jQuery(this.options.couponFormSelector).on('submit', jQuery.proxy(this._applyCoupon, this));
                this.checkValueOfInputs(jQuery(this.options.couponFormSelector));
            }

        },

        checkValueOfInputs: function (form) {
            var checkValue = function (elem) {
                if (jQuery(elem).val()) {
                    form.find('.primary').show();
                } else {
                    form.find('.primary').hide();
                }
            }
            var field = jQuery(form).find('.dibs-easy-checkout-show-on-focus').get(0);
            jQuery(field).on("keyup", function () {
                checkValue(this)
            });
            jQuery(field).on("change", function () {
                checkValue(this)
            });
        },


        /**
         * show ajax loader
         */
        _ajaxBeforeSend: function () {
            if (window._dibsCheckout) {
                try {
                    window._dibsCheckout.freezeCheckout();
                } catch (err) {
                }
            }
            jQuery(this.options.waitLoadingContainer).show();
        },

        /**
         * hide ajax loader
         */
        _ajaxComplete: function () {
            if (window._dibsCheckout) {
                try {
                    window._dibsCheckout.thawCheckout();
                } catch (err) {
                }
            }
            jQuery(this.options.waitLoadingContainer).hide();
        },

        _changeShippingMethod: function () {
            this._ajaxFormSubmit(jQuery(this.options.shippingMethodFormSelector));
        },

        _loadShippingMethod: function () {
            this._ajaxFormSubmit(jQuery(this.options.shippingMethodLoaderSelector));
            return false;
        },

        _changeSubscriptionStatus: function () {
            this._ajaxFormSubmit(jQuery(this.options.newsletterFormSelector));
        },
        _saveComment: function () {
            this._ajaxFormSubmit(jQuery(this.options.commentFormSelector));
            return false;
        },
        _applyCoupon: function () {
            this._ajaxFormSubmit(jQuery(this.options.couponFormSelector));
            return false;
        },


        _ajaxFormSubmit: function (form) {
            return this._ajaxSubmit(form.prop('action'), form.serialize());
        },
        /**
         * Attempt to ajax submit order
         */
        _ajaxSubmit: function (url, data, method, beforeDIBSAjax, afterDIBSAjax) {
            if (!method) method = 'post';
            var _this = this;
            if (this.options.shippingAjaxInProgress === true) {
                return false;
            }
            jQuery.ajax({
                url: url,
                type: method,
                context: this,
                data: data,
                dataType: 'json',
                beforeSend: function () {
                    _this.options.shippingAjaxInProgress = true;
                    _this._ajaxBeforeSend();
                    if (typeof beforeDIBSAjax === 'function') {
                        beforeDIBSAjax();
                    }
                },
                complete: function () {
                    _this.options.shippingAjaxInProgress = false;
                    _this._ajaxComplete();
                },
                success: function (response) {
                    if (jQuery.type(response) === 'object' && !jQuery.isEmptyObject(response)) {

                        if (response.reload || response.redirect) {
                            this.loadWaiting = false; //prevent that resetLoadWaiting hiding loader
                            if (response.messages) {
                                //alert({content: response.messages});
                                jQuery(this.options.waitLoadingContainer).html('<span class="error">' + response.messages + ' Reloading...</span>');
                            } else {
                                jQuery(this.options.waitLoadingContainer).html('<span class="error">Reloading...</span>');
                            }

                            if (response.redirect) {
                                window.location.href = response.redirect;
                            } else {
                                window.location.reload();
                            }
                            return true;
                        } //end redirect   

                        //ctlKeyy Cookie
                        if (response.ctrlkey) {
                            _this.options.ctrlkey = response.ctrlkey;
                            jQuery.mage.cookies.set(_this.options.ctrlcookie, response.ctrlkey);
                        }

                        if (response.updates) {

                            var blocks = response.updates;
                            var div = null;

                            for (var block in blocks) {
                                if (blocks.hasOwnProperty(block)) {
                                    div = jQuery('#dibs-easy-checkout_' + block);
                                    if (div.size() > 0) {
                                        div.replaceWith(blocks[block]);
                                        this._bindEvents(block);
                                    }
                                }
                            }
                        }

                        if (typeof afterDIBSAjax === 'function') {
                            afterDIBSAjax();
                        }

                        if (response.messages) {
                            alert({
                                content: response.messages
                            });
                        }

                    } else {
                        alert({
                            content: jQuery.mage.__('Sorry, something went wrong. Please try again (reload this page)')
                        });
                        // window.location.reload();
                    }
                },
                error: function () {
                    alert({
                        content: jQuery.mage.__('Sorry, something went wrong. Please try again later.')
                    });
                    //window.location.reload();
//                     this._ajaxComplete();
                }
            });
        },

        dibsApiChanges: function () {
            if (!window._dibsCheckout) {
                return
            }

            self = this;
            window._dibsCheckout.on('payment-completed', function (response) {
                self._ajaxSubmit(BASE_URL + "onepage/order/SaveOrder/pid/" + response.paymentId);

            })
        },

        /**
         * UI Stuff
         */
        getViewport: function () {
            var e = window, a = 'inner';
            if (!('innerWidth' in window)) {
                a = 'client';
                e = document.documentElement || document.body;
            }
            return {width: e[a + 'Width'], height: e[a + 'Height']};
        },
        sidebarFiddled: false,
        fiddleSidebar: function () {
            var t = this;
            if ((this.getViewport().width <= 960) && !this.sidebarFiddled) {
                jQuery('.mobile-collapse').each(function () {
                    jQuery(this).collapsible('deactivate');
                    t.sidebarFiddled = true;
                });
            }
        },
        uiManipulate: function () {
            var t = this;
            jQuery(window).resize(function () {
                t.fiddleSidebar();
            });
            jQuery(document).ready(function () {
                t.fiddleSidebar();
            });
        },

        scrollToPayment: function () {
            var trigger = this.options.scrollTrigger;
            var target = this.options.scrollTarget;
            jQuery(trigger).click(function () {
                jQuery('html, body').animate({
                    scrollTop: jQuery(target).offset().top
                }, 500)
            })
        }


    });

    return jQuery.mage.nwtdibsCheckout;
});
