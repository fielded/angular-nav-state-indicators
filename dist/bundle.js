(function (angular) {
  'use strict';

  angular = 'default' in angular ? angular['default'] : angular;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var find = function find(list, match) {
    for (var i = 0; i < list.length; i++) {
      if (match(list[i])) {
        return list[i];
      }
    }
    return undefined;
  };

  var productsGroupedByStatus = function productsGroupedByStatus(stock) {
    return Object.keys(stock).reduce(function (grouped, product) {
      var status = stock[product].status;
      if (status) {
        grouped[status].push(product);
      } else {
        grouped['unknown'].push(product);
      }
      return grouped;
    }, { understock: [], 're-stock': [], ok: [], overstock: [], unknown: [] });
  };

  var sumAllocations = function sumAllocations(sum, stock) {
    return Object.keys(stock).reduce(function (total, product) {
      total[product] = total[product] || 0;
      if (stock[product].allocation > 0) {
        total[product] += stock[product].allocation;
      }
      return total;
    }, sum);
  };

  // TODO: make sure stock_statuses is availalbe

  var StateIndicatorsService = function () {
    function StateIndicatorsService($q, smartId, STOCK_STATUSES, lgasService, statesService, zonesService, thresholdsService, productListService) {
      classCallCheck(this, StateIndicatorsService);

      this.$q = $q;
      this.smartId = smartId;
      this.STOCK_STATUSES = STOCK_STATUSES;
      this.lgasService = lgasService;
      this.statesService = statesService;
      this.zonesService = zonesService;
      this.thresholdsService = thresholdsService;
      this.productListService = productListService;
    }

    createClass(StateIndicatorsService, [{
      key: 'stateRequiredAllocationsByZone',
      value: function stateRequiredAllocationsByZone(stockCounts) {
        var _this = this;

        return stockCounts.reduce(function (allocations, stockCount) {
          if (stockCount.location && stockCount.location.state && !stockCount.location.lga && stockCount.reStockNeeded) {
            var zone = _this.smartId.idify({ zone: stockCount.location.zone }, 'locationId');
            allocations[zone] = allocations[zone] || {};
            allocations[zone] = sumAllocations(allocations[zone], stockCount.stock);
          }
          return allocations;
        }, {});
      }
    }, {
      key: 'decorateWithIndicators',
      value: function decorateWithIndicators(stockCounts) {
        var _this2 = this;

        var lgas = void 0;
        var states = void 0;
        var zones = void 0;
        var products = void 0;

        var getLocation = function getLocation(lgas, states, zones, stockCount) {
          var lga = stockCount.location.lga;
          var state = stockCount.location.state;
          if (lga) {
            return find(lgas, function (lgaDoc) {
              return lgaDoc.id === lga;
            });
          } else if (state) {
            return find(states, function (stateDoc) {
              return stateDoc.id === state;
            });
          } else {
            var _ret = function () {
              var zone = stockCount.location.zone;
              return {
                v: find(zones, function (zoneDoc) {
                  return zoneDoc.id === zone;
                })
              };
            }();

            if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
          }
        };

        var decorateStockField = function decorateStockField(requiredAllocations, stockCount) {
          var location = getLocation(lgas, states, zones, stockCount);
          var locationThresholds = void 0;
          if (location && location.level === 'zone') {
            locationThresholds = _this2.thresholdsService.calculateThresholds(location, stockCount, products, requiredAllocations[location._id]);
          } else {
            locationThresholds = _this2.thresholdsService.calculateThresholds(location, stockCount, products);
          }
          var stock = stockCount.stock;

          var decoratedStock = Object.keys(stock).reduce(function (decorated, product) {
            var amount = stock[product];
            var status = void 0;
            var allocation = void 0;
            var productThresholds = void 0;
            var selectedProduct = find(products, function (prod) {
              return prod._id === product;
            });

            if (locationThresholds) {
              productThresholds = locationThresholds[product];

              if (productThresholds) {
                status = 'overstock';
                if (amount < productThresholds.min) {
                  status = 'understock';
                } else if (amount < productThresholds.reOrder) {
                  status = 're-stock';
                } else if (amount <= productThresholds.max) {
                  status = 'ok';
                }

                var productBalance = productThresholds.max - amount;
                allocation = productBalance;
                if (selectedProduct) {
                  var unitBalance = productBalance % selectedProduct.presentation;
                  allocation = unitBalance > 0 ? productBalance + (selectedProduct.presentation - unitBalance) : productBalance;
                }
              }
            }

            decorated[product] = {
              status: status,
              amount: amount,
              allocation: allocation,
              thresholds: productThresholds
            };

            return decorated;
          }, {});

          stockCount.stock = decoratedStock;
          return stockCount;
        };

        var addReStockField = function addReStockField(stockCount) {
          var addAllocationIfPositive = function addAllocationIfPositive(sum, productId) {
            if (stockCount.stock[productId].allocation > 0) {
              sum = sum + stockCount.stock[productId].allocation;
            }
            return sum;
          };

          if (stockCount.location && stockCount.location.lga) {
            var groupedByStatus = productsGroupedByStatus(stockCount.stock);
            stockCount.reStockNeeded = !!(groupedByStatus.understock.length + groupedByStatus['re-stock'].length);
          } else {
            // states and zones
            if (stockCount.stock) {
              var sumOfPositiveAllocations = Object.keys(stockCount.stock).reduce(addAllocationIfPositive, 0);
              stockCount.reStockNeeded = sumOfPositiveAllocations > 0;
            }
          }
          return stockCount;
        };

        var addStockLevelStatusField = function addStockLevelStatusField(stockCount) {
          var unknownProducts = productsGroupedByStatus(stockCount.stock).unknown.length;
          var understockedProducts = productsGroupedByStatus(stockCount.stock).understock.length;

          if (stockCount.location) {
            if (understockedProducts >= _this2.STOCK_STATUSES.alert.threshold) {
              stockCount.stockLevelStatus = _this2.STOCK_STATUSES.alert.id;
            } else if (understockedProducts >= _this2.STOCK_STATUSES.warning.threshold) {
              stockCount.stockLevelStatus = _this2.STOCK_STATUSES.warning.id;
            } else if (unknownProducts) {
              stockCount.stockLevelStatus = 'unknown';
            } else {
              stockCount.stockLevelStatus = _this2.STOCK_STATUSES.ok.id;
            }
          }

          return stockCount;
        };

        var hasNonEmptyStock = function hasNonEmptyStock(stockCount) {
          return stockCount.stock && Object.keys(stockCount.stock).length;
        };

        var isZoneStockCount = function isZoneStockCount(stockCount) {
          return stockCount.location && stockCount.location.zone && !stockCount.location.state;
        };

        var isNonZoneStockCount = function isNonZoneStockCount(stockCount) {
          return !isZoneStockCount(stockCount);
        };

        var decorateStockCounts = function decorateStockCounts(nonZoneStockCounts, zoneStockCounts, promiseResults) {
          lgas = promiseResults.lgas;
          states = promiseResults.states;
          zones = promiseResults.zones || []; // not available for the state dashboard
          products = promiseResults.products;

          nonZoneStockCounts = nonZoneStockCounts.map(decorateStockField.bind(null, null)).map(addReStockField);
          zoneStockCounts = zoneStockCounts.map(decorateStockField.bind(null, _this2.stateRequiredAllocationsByZone(nonZoneStockCounts))).map(addReStockField);

          return nonZoneStockCounts.concat(zoneStockCounts).map(addStockLevelStatusField);
        };

        var promises = {
          lgas: this.lgasService.list(),
          states: this.statesService.list(),
          products: this.productListService.relevant()
        };

        stockCounts = stockCounts.filter(hasNonEmptyStock);

        if (!stockCounts.length) {
          return this.$q.when(stockCounts);
        }

        var zoneStockCounts = stockCounts.filter(isZoneStockCount);
        var nonZoneStockCounts = stockCounts.filter(isNonZoneStockCount);

        if (zoneStockCounts.length) {
          promises.zones = this.zonesService.list();
        }

        return this.$q.all(promises).then(decorateStockCounts.bind(null, nonZoneStockCounts, zoneStockCounts));
      }
    }]);
    return StateIndicatorsService;
  }();

  StateIndicatorsService.$inject = ['$q', 'smartId', 'STOCK_STATUSES', 'lgasService', 'statesService', 'zonesService', 'thresholdsService', 'productListService'];

  angular.module('angularNavStateIndicators', ['ngSmartId', 'angularNavData', 'angularNavThresholds']).service('stateIndicatorsService', StateIndicatorsService);

}(angular));