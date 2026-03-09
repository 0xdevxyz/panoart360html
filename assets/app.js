/*! ------------------------------------------------
 * Project Name: Hintio Coming Soon & Landing Page Template
 * Project Description: Hintio - clean and bold coming soon & landing page template to kick-start your project
 * Tags: mix_design, hintio, coming soon, under construction, template, coming soon page, landing page, one page, html5, css3
 * Version: 2.0.4
 * Build Date: July 2020
 * Last Update: June 2025
 * This product is available exclusively on Themeforest
 * Author: mix_design
 * Author URI: https://themeforest.net/user/mix_design
 * File name: app.js
 * ------------------------------------------------

 * ------------------------------------------------
 * Table of Contents
 * ------------------------------------------------
 *
 *  2. SVG Fallback
 *  3. Chrome Smooth Scroll
 *  4. Images moving ban
 *  5. Cursor
 *  6. PhotoSwipe Gallery Images Replace
 *  7. Main Menu & Sections Behavior
 *  8. Popups Behavior
 *
 * ------------------------------------------------
 * Table of Contents End
 * ------------------------------------------------ */

 $(function() {

   // SVG Fallback
   if(!Modernizr.svg) {
     $("img[src*='svg']").attr("src", function() {
       return $(this).attr("src").replace(".svg", ".png");
     });
   };

   // Chrome Smooth Scroll
   try {
     $.browserSelector();
     if($("html").hasClass("chrome")) {
       $.smoothScroll();
     }
   } catch(err) {
   };

   // Images moving ban
   $("img, a").on("dragstart", function(event) { event.preventDefault(); });

   // Cursor
   function followCursor() {
     var cursor = $('.cursor');
     // follow effect
     function moveCursor(e) {
 	    var t = e.clientX + "px",
           n = e.clientY + "px";
       var circleCursor = anime({
         targets: '.cursor',
         duration: 30,
         left: t,
         top: n,
         easing: 'linear'
       });
     }
     $(window).on('mousemove', moveCursor);
     // line link hover
     $('.link-s').on('mouseenter', function() {
       cursor.addClass('cursor-s');
     });
     $('.link-s').on('mouseleave', function() {
       cursor.removeClass('cursor-s');
     });
     // buttons & triggers hover
     $('.link-l').on('mouseenter', function() {
       cursor.addClass('cursor-l');
     });
     $('.link-l').on('mouseleave', function() {
       cursor.removeClass('cursor-l');
     });
   };
   // init
   followCursor();

   // PhotoSwipe Gallery Images Replace
   $('.works-link')
     // Background set up
     .each(function(){
     $(this)
     // Add a photo container
     .append('<div class="picture"></div>')
     // Set up a background image for each link based on data-image attribute
     .children('.picture').css({'background-image': 'url('+ $(this).attr('data-image') +')'});
   });

   // Variables
   var menuTrigger        = $('#menu-trigger'),
       menuClose          = $('#menu-close'),
       menu               = $('#menu'),

       mainSection        = $('#main'),
       aboutSection       = $('#about'),
       worksSection       = $('#works'),
       contactSection     = $('#contact'),

       homeTrigger        = $('#home-trigger'),
       aboutTrigger       = $('#about-trigger'),
       worksTrigger       = $('#works-trigger'),
       contactTrigger     = $('#contact-trigger'),
       exploreTrigger     = $('#explore-trigger'),

       aboutClose         = $('#about-close'),
       worksClose         = $('#works-close'),
       contactClose         = $('#contact-close'),

       notify                  = $('#notify'),
       sayhello                = $('#sayhello'),

       notifyTrigger           = $('#notify-trigger'),
       sayhelloTrigger         = $('#sayhello-trigger'),
       sayhelloTriggerContact  = $('#sayhello-trigger-2'),

       notifyClose             = $('#notify-close'),
       sayhelloClose           = $('#sayhello-close');

   // Main Menu & Sections Behavior
   menuTrigger.on('click', function(event){
     event.preventDefault();
     mainSection.addClass('animate-out');
     setTimeout(function(){
       menu.addClass('animate-in');
       $('body').addClass('overflow-hidden');
     }, 400);
   });

   menuClose.on('click', function(event){
     event.preventDefault();
     menu.addClass('animate-out');
     setTimeout(function(){
       mainSection.removeClass('animate-out');
     }, 400);
     setTimeout(function(){
       menu.removeClass('animate-in animate-out');
       $('body').removeClass('overflow-hidden');
     }, 800);
   });

   homeTrigger.on('click', function(event){
       event.preventDefault();
       menu.addClass('animate-out');
       homeTrigger.addClass('active-link');
       setTimeout(function(){
         mainSection.removeClass('animate-out');
       }, 400);
       setTimeout(function(){
         menu.removeClass('animate-in animate-out');
       }, 800);
     });
   // Body remove class "overflow-hidden" on menu item click
   $('.menu a').on('click', function(event){
     $('body').removeClass('overflow-hidden');
   });

   exploreTrigger.on('click', function(event){
     event.preventDefault();
     mainSection.addClass('animate-out');
     $('.active-link').removeClass('active-link');
     setTimeout(function(){
       aboutSection.fadeIn(0, function() {
         aboutSection.addClass('active animate-in');
       });
     }, 400);
     setTimeout(function(){
     }, 1000);
   });

    aboutTrigger.on('click', function(event){
      event.preventDefault();
      menu.addClass('is-scaled-out');
      $('.active-link').removeClass('active-link');
      aboutTrigger.addClass('active-link');
      setTimeout(function(){
        aboutSection.fadeIn(0, function() {
          aboutSection.addClass('active animate-in');
        });
      }, 400);
      setTimeout(function(){
        menu.removeClass('animate-in animate-out is-scaled-out');
      }, 1000);
    });

    aboutClose.on('click', function(event){
      event.preventDefault();
      aboutSection.addClass('animate-out');
      $('.active-link').removeClass('active-link');
      setTimeout(function(){
        aboutSection.fadeOut(100, function() {
          mainSection.removeClass('animate-out');
          homeTrigger.addClass('active-link');
          aboutSection.removeClass('animate-out animate-in active');
        });
      }, 400);
    });

     worksTrigger.on('click', function(event){
       event.preventDefault();
       menu.addClass('is-scaled-out');
       $('.active-link').removeClass('active-link');
       worksTrigger.addClass('active-link');
       setTimeout(function(){
         worksSection.fadeIn(0, function() {
           worksSection.addClass('active animate-in');
         });
       }, 400);
       setTimeout(function(){
         menu.removeClass('animate-in animate-out is-scaled-out');
       }, 1000);
     });

     worksClose.on('click', function(event){
       event.preventDefault();
       worksSection.addClass('animate-out');
       $('.active-link').removeClass('active-link');
       setTimeout(function(){
         worksSection.fadeOut(100, function() {
           mainSection.removeClass('animate-out');
           homeTrigger.addClass('active-link');
           worksSection.removeClass('animate-out animate-in active');
         });
       }, 400);
     });

     contactTrigger.on('click', function(event){
       event.preventDefault();
       menu.addClass('is-scaled-out');
       $('.active-link').removeClass('active-link');
       contactTrigger.addClass('active-link');
       setTimeout(function(){
         contactSection.fadeIn(0, function() {
           contactSection.addClass('active animate-in');
         });
       }, 400);
       setTimeout(function(){
         menu.removeClass('animate-in animate-out is-scaled-out');
       }, 1000);
     });

     contactClose.on('click', function(event){
       event.preventDefault();
       contactSection.addClass('animate-out');
       $('.active-link').removeClass('active-link');
       setTimeout(function(){
         contactSection.fadeOut(100, function() {
           mainSection.removeClass('animate-out');
           homeTrigger.addClass('active-link');
           contactSection.removeClass('animate-out animate-in active');
         });
       }, 400);
     });

     // Popups Behavior
     // Contact Form Open
     sayhelloTrigger.on('click', function(event){
       event.preventDefault();
       mainSection.addClass('popup-is-visible');
       $('body').addClass('overflow-hidden');
       sayhello.addClass('animate-in');
     });

     // Contact Form Close
     sayhelloClose.on('click', function(event){
       event.preventDefault();
       sayhello.addClass('animate-out');

       if (contactSection.hasClass('active')) {
         setTimeout(function(){
           contactSection.removeClass('popup-is-visible');
           sayhello.removeClass('animate-in animate-out');
           $('body').removeClass('overflow-hidden');
         }, 1600);
       } else {
         setTimeout(function(){
           mainSection.removeClass('popup-is-visible');
           sayhello.removeClass('animate-in animate-out');
           $('body').removeClass('overflow-hidden');
         }, 1600);
       }

     });

     // Contact Form Open (in contact section)
     sayhelloTriggerContact.on('click', function(event){
       event.preventDefault();
       contactSection.addClass('popup-is-visible');
       $('body').addClass('overflow-hidden');
       sayhello.addClass('animate-in');
     });

     // Notify Form Open
     notifyTrigger.on('click', function(event){
       event.preventDefault();
       mainSection.addClass('popup-is-visible');
       $('body').addClass('overflow-hidden');
       notify.addClass('animate-in');
     });

     // Notify Form Close
     notifyClose.on('click', function(event){
       event.preventDefault();
       notify.addClass('animate-out');
       setTimeout(function(){
         mainSection.removeClass('popup-is-visible');
         notify.removeClass('animate-in animate-out');
         $('body').removeClass('overflow-hidden');
       }, 1600);
     });

});
