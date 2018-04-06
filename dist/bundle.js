(function (angular) {
  'use strict';

  angular = 'default' in angular ? angular['default'] : angular;

  var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

  var find = function find(list, match) {
    for (var i = 0; i < list.length; i++) {
      if (match(list[i])) {
        return list[i];
      }
    }
    return undefined;
  };

  var productsGroupedByStatus = function productsGroupedByStatus(stock, products) {
    return Object.keys(stock).reduce(function (grouped, productId) {
      var isRelevant = !!find(products, function (product) {
        return product._id === productId;
      });
      var status = stock[productId].status;
      if (!isRelevant) {
        return grouped;
      }
      if (status) {
        grouped[status].push(productId);
      }
      return grouped;
    }, { understock: [], 're-stock': [], ok: [], overstock: [] });
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
    function StateIndicatorsService($q, smartId, STOCK_STATUSES, lgasService, statesService, zonesService, locationsService, thresholdsService, productListService) {
      _classCallCheck(this, StateIndicatorsService);

      this.$q = $q;
      this.smartId = smartId;
      this.STOCK_STATUSES = STOCK_STATUSES;
      this.lgasService = lgasService;
      this.statesService = statesService;
      this.zonesService = zonesService;
      this.locationsService = locationsService;
      this.thresholdsService = thresholdsService;
      this.productListService = productListService;
    }

    _createClass(StateIndicatorsService, [{
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

        var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var lgas = void 0;
        var states = void 0;
        var zones = void 0;
        var products = void 0;
        var national = void 0;

        var getStockAmount = function getStockAmount(stock, product) {
          var amount = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

          if (!isNaN(parseInt(stock[product].amount, 10))) {
            amount = stock[product].amount;
          } else if (!isNaN(parseInt(stock[product], 10))) {
            amount = stock[product];
          }
          return amount;
        };

        var getLocation = function getLocation(lgas, states, zones, stockCount) {
          if (!stockCount.location) {
            return;
          }
          var locationId = _this2.smartId.idify(stockCount.location, 'locationId');

          var locations = zones;
          if (stockCount.location.state) {
            locations = stockCount.location.lga ? lgas : states;
          }
          return find(locations, function (locationDoc) {
            return locationDoc._id === locationId;
          });
        };

        var decorateStockField = function decorateStockField(stockCount, requiredAllocations) {
          var location = void 0;
          if (stockCount.location.national) {
            location = national;
          } else {
            location = getLocation(lgas, states, zones, stockCount);
          }

          var locationThresholds = void 0;
          if (location && location.level === 'zone' && requiredAllocations) {
            locationThresholds = _this2.thresholdsService.calculateThresholds(location, stockCount, products, requiredAllocations[location._id]);
          } else {
            locationThresholds = _this2.thresholdsService.calculateThresholds(location, stockCount, products);
          }
          var stock = stockCount.stock;

          var decoratedStock = Object.keys(stock).reduce(function (decorated, product) {
            // v2 stock count report
            var amount = getStockAmount(stock, product);
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
            var groupedByStatus = productsGroupedByStatus(stockCount.stock, products);
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
          var grouped = productsGroupedByStatus(stockCount.stock, products);
          var understockedProducts = grouped.understock.length;
          var totalGrouped = Object.keys(grouped).reduce(function (sum, group) {
            return sum + grouped[group].length;
          }, 0);

          stockCount.stockLevelStatus = 'unknown';
          if (stockCount.location) {
            if (understockedProducts >= _this2.STOCK_STATUSES.alert.threshold) {
              stockCount.stockLevelStatus = _this2.STOCK_STATUSES.alert.id;
            } else if (understockedProducts >= _this2.STOCK_STATUSES.warning.threshold) {
              stockCount.stockLevelStatus = _this2.STOCK_STATUSES.warning.id;
            } else if (totalGrouped > 0) {
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

        var isNationalStockCount = function isNationalStockCount(stockCount) {
          return stockCount.location && stockCount.location.national;
        };

        var decorateStockCounts = function decorateStockCounts(nonZoneStockCounts, zoneStockCounts, promiseResults) {
          lgas = promiseResults.lgas;
          states = promiseResults.states;
          zones = promiseResults.zones || []; // not available for the state dashboard
          products = promiseResults.products;
          national = promiseResults.national || {};

          nonZoneStockCounts = nonZoneStockCounts.map(function (nonZoneStockCount) {
            return decorateStockField(nonZoneStockCount);
          }).map(addReStockField);
          zoneStockCounts = zoneStockCounts.map(function (zoneStockCount) {
            if (opts.requireChildAllocations === false) {
              return decorateStockField(zoneStockCount);
            }
            return decorateStockField(zoneStockCount, _this2.stateRequiredAllocationsByZone(nonZoneStockCounts));
          }).map(addReStockField);

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
        var nationalStockCounts = stockCounts.filter(isNationalStockCount);

        if (zoneStockCounts.length) {
          promises.zones = this.zonesService.list();
        }

        if (nationalStockCounts.length) {
          promises.national = this.locationsService.get('national');
        }

        return this.$q.all(promises).then(decorateStockCounts.bind(null, nonZoneStockCounts, zoneStockCounts));
      }
    }]);

    return StateIndicatorsService;
  }();

  StateIndicatorsService.$inject = ['$q', 'smartId', 'STOCK_STATUSES', 'lgasService', 'statesService', 'zonesService', 'locationsService', 'thresholdsService', 'productListService'];

  angular.module('angularNavStateIndicators', ['ngSmartId', 'angularNavData', 'angularNavThresholds']).service('stateIndicatorsService', StateIndicatorsService);

}(angular));