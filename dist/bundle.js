!function(t){"use strict";t="default"in t?t.default:t;var e="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol?"symbol":typeof t},n=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},r=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),o=function(t,e){for(var n=0;n<t.length;n++)if(e(t[n]))return t[n]},i=function(t){return Object.keys(t).reduce(function(e,n){var r=t[n].status;return r?e[r].push(n):e.unknown.push(n),e},{understock:[],"re-stock":[],ok:[],overstock:[],unknown:[]})},c=function(){function t(e,r,o,i,c,u,s){n(this,t),this.$q=e,this.STOCK_STATUSES=r,this.lgasService=o,this.statesService=i,this.zonesService=c,this.thresholdsService=u,this.productListService=s}return r(t,[{key:"decorateWithIndicators",value:function(t){var n=this,r=void 0,c=void 0,u=void 0,s=void 0,a=function(t,n,r,i){var c=i.location.lga,u=i.location.state;if(c)return o(t,function(t){return t.id===c});if(u)return o(n,function(t){return t.id===u});var s=function(){var t=i.location.zone;return{v:o(r,function(e){return e.id===t})}}();return"object"===("undefined"==typeof s?"undefined":e(s))?s.v:void 0},l=function(t,e){return Object.keys(t).reduce(function(t,n){return t[n]+=e,t},t)},f=function(t,e){var i=a(r,c,u,e),f=void 0;f=i&&"zone"===i.level?n.thresholdsService.calculateThresholds(i,e,s,t[i.id]):n.thresholdsService.calculateThresholds(i,e,s);var v=e.stock,d=Object.keys(v).reduce(function(e,n){var r=v[n],c=void 0,u=void 0,a=o(s,function(t){return t._id===n});if(f){var d=f[n];if(d){i&&"zone"===i.level&&t&&t[n]&&(d=l(d,t[n])),c="overstock",r<d.min?c="understock":r<d.reOrder?c="re-stock":r<=d.max&&(c="ok");var S=d.max-r;if(u=S,a){var h=S%a.presentation;u=h>0?S+(a.presentation-h):S}}}return e[n]={status:c,amount:r,allocation:u},e},{});return e.stock=d,e},v=function(t){var e=i(t.stock);return t.reStockNeeded=!!(e.understock.length+e["re-stock"].length),t},d=function(t){var e=i(t.stock).unknown.length,r=i(t.stock).understock.length;return t.location&&(r>=n.STOCK_STATUSES.alert.threshold?t.stockLevelStatus=n.STOCK_STATUSES.alert.id:r>=n.STOCK_STATUSES.warning.threshold?t.stockLevelStatus=n.STOCK_STATUSES.warning.id:e?t.stockLevelStatus="unknown":t.stockLevelStatus=n.STOCK_STATUSES.ok.id),t},S=function(t){return t.stock&&Object.keys(t.stock).length},h=function(t){return t.location&&t.location.zone&&!t.location.state},k=function(t){return!h(t)},T=function(t,e){return Object.keys(e).reduce(function(t,n){return t[n]=t[n]||0,t[n]+=e[n].allocation,t},t)},g=function(t){return t.reduce(function(t,e){if(e.location&&e.location.state&&!e.location.lga){var n=e.location.zone;t[n]=t[n]||{},t[n]=T(t[n],e.stock)}return t},{})},p=function(t,e,n){return r=n.lgas,c=n.states,u=n.zones||[],s=n.products,t=t.map(f.bind(null,null)),e=e.map(f.bind(null,g(t))),t.concat(e).map(v).map(d)},y={lgas:this.lgasService.list(),states:this.statesService.list(),products:this.productListService.relevant()};if(t=t.filter(S),!t.length)return this.$q.when(t);var b=t.filter(h),m=t.filter(k);return b.length&&(y.zones=this.zonesService.list()),this.$q.all(y).then(p.bind(null,m,b))}}]),t}();c.$inject=["$q","STOCK_STATUSES","lgasService","statesService","zonesService","thresholdsService","productListService"],t.module("angularNavStateIndicators",["angularNavData","angularNavThresholds"]).service("stateIndicatorsService",c)}(angular);