!function(t){function n(e){if(i[e])return i[e].exports;var o=i[e]={i:e,l:!1,exports:{}};return t[e].call(o.exports,o,o.exports,n),o.l=!0,o.exports}var i={};n.m=t,n.c=i,n.d=function(t,i,e){n.o(t,i)||Object.defineProperty(t,i,{configurable:!1,enumerable:!0,get:e})},n.n=function(t){var i=t&&t.__esModule?function(){return t.default}:function(){return t};return n.d(i,"a",i),i},n.o=function(t,n){return Object.prototype.hasOwnProperty.call(t,n)},n.p="",n(n.s=0)}([function(t,n,i){"use strict";function e(t){for(var n="=".repeat((4-t.length%4)%4),i=(t+n).replace(/\-/g,"+").replace(/_/g,"/"),e=window.atob(i),o=new Uint8Array(e.length),a=0;a<e.length;++a)o[a]=e.charCodeAt(a);return o}function o(t){return function(n){(console.error||console.log)(t,n)}}var a={VIDEO_ANSWER:"VIDEO_ANSWER",VIDEO_REJECT:"VIDEO_REJECT"};self.addEventListener("install",function(t){self.skipWaiting()}),self.addEventListener("activate",function(t){console.log("Activated",t)}),self.addEventListener("push",function(t){var n="Swift Projects";if(t.data){var i=t.data.json(),e=i&&i.data||{};"video-chat-invite"===e.type?t.waitUntil(self.registration.showNotification(i.title||n,{body:i.body||"You have an update!",icon:"icon.png",tag:i.tag||"push",actions:[{action:a.VIDEO_ANSWER,title:"Answer"},{action:a.VIDEO_REJECT,title:"Reject"}],data:e})):t.waitUntil(self.registration.showNotification(i.title||n,{body:i.body||"You have an update!",icon:"icon.png",tag:i.tag||"push"}).catch(o("Failed to display push notification")))}else t.waitUntil(self.registration.showNotification(n,{body:"You have an update!",icon:"icon.png",tag:"push"}).catch(o("Failed to display push notification")))}),self.addEventListener("notificationclick",function(t){t.notification.close();t.notification.data;if(t.action===a.VIDEO_ANSWER){if(t.notification&&t.notification.data){var n=t.notification.data;if(n.channelId&&n.sessionId){var i="/#/video-chat/"+n.channelId+"/"+n.sessionId;t.waitUntil(clients.openWindow(i))}}}else if(!t.action||t.notification&&"video-chat-invite"===t.notification.type){if(t.notification&&t.notification.data){var e=t.notification.data;if(e.channelId&&e.sessionId){var o="/#/video-chat/"+e.channelId+"/"+e.sessionId;t.waitUntil(clients.openWindow(o))}}}else t.waitUntil(clients.matchAll({includeUncontrolled:!0,type:"window"}).then(function(t){console.log("total windowClients = ",t.length);for(var n=0;n<t.length;n++){var i=t[n];if(i.focused)return i.focus()}return t[0]&&"focus"in t[0]?t[0].focus():clients.openWindow?clients.openWindow("https://swiftprojects.io/"):void 0}))}),self.addEventListener("pushsubscriptionchange",function(t){console.log("[Service Worker]: 'pushsubscriptionchange' event fired.");var n=e("BPlztpek7o-gbCEWKymExOPOB9jDim1fzL7ed0PC4zACbJgSiUovaYpCN636lbdvrh-uYKW3w8ogkHtrlqGcmjI");t.waitUntil(self.registration.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:n}).then(function(t){console.log("[Service Worker] New subscription: ",t)}))})}]);