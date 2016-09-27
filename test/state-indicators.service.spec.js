'use strict'

describe('state indicators service', function () {
  var stateIndicatorsService
  var thresholdsService
  var $rootScope
  var angularNavDataMock // eslint-disable-line
  var testMod // eslint-disable-line

  var lgas = [
    { _id: 'zone:nc:state:kogi:lga:a', id: 'a', level: 'lga' },
    { _id: 'zone:nc:state:kogi:lga:b', id: 'b', level: 'lga' },
    { _id: 'zone:nc:state:kogi:lga:c', id: 'c', level: 'lga' }
  ]

  var states = [
    { _id: 'zone:nc:state:kogi', id: 'kogi', level: 'state' }
  ]

  var zones = [
    { _id: 'zone:nc', id: 'nc', level: 'zone' }
  ]

  var lgaStockCounts = [
    {
      location: { zone: 'nc', state: 'kogi', lga: 'a' },
      stock: { 'product:a': 1, 'product:b': 3, 'product:c': 10, 'product:d': 36 },
      store: { type: 'lga' }
    },
    {
      location: { zone: 'nc', state: 'kogi', lga: 'b' },
      stock: { 'product:a': 0, 'product:b': 0, 'product:c': 11, 'product:d': 30 },
      store: { type: 'lga' }
    },
    {
      location: { zone: 'nc', state: 'kogi', lga: 'c' },
      stock: { 'product:a': 0, 'product:b': 0, 'product:c': 0, 'product:d': 75 },
      store: { type: 'lga' }
    },
    {
      location: { zone: 'nc', state: 'kogi', lga: 'd' },
      stock: {},
      store: { type: 'lga' }
    },
    {
      location: { zone: 'nc', state: 'kogi', lga: 'e' },
      store: { type: 'lga' }
    }
  ]

  var stateStockCounts = [
    {
      location: { zone: 'nc', state: 'kogi' },
      stock: { 'product:a': 0, 'product:b': 1, 'product:c': 10, 'product:d': 40 },
      store: { type: 'state' }
    }
  ]

  var zoneStockCounts = [
    {
      location: { zone: 'nc' },
      stock: { 'product:a': 0, 'product:b': 11, 'product:c': 20, 'product:d': 40 },
      store: { type: 'zone' }
    }
  ]

  var stockStatusesMock = {
    ok: {
      id: 'kpi-ok'
    },
    warning: {
      id: 'kpi-warning',
      threshold: 1
    },
    alert: {
      id: 'kpi-alert',
      threshold: 3
    },
    unknown: {
      id: 'kpi-unknown'
    }
  }

  var products = [
    {
      _id: 'product:a',
      code: 'a',
      presentation: 1
    },
    {
      _id: 'product:b',
      code: 'b',
      presentation: 5
    },
    {
      _id: 'product:c',
      code: 'c',
      presentation: 10
    },
    {
      _id: 'product:d',
      code: 'd',
      presentation: 15
    }
  ]

  var thresholds = {
    'product:a': {
      min: 1,
      reOrder: 2,
      max: 5
    },
    'product:b': {
      min: 1,
      reOrder: 2,
      max: 10
    },
    'product:c': {
      min: 1,
      reOrder: 2,
      max: 20
    },
    'product:d': {
      min: 1,
      reOrder: 2,
      max: 30
    }
  }

  beforeEach(function () {
    angularNavDataMock = angular.module('angularNavData', [])
      .service('lgasService', function ($q) {
        this.list = function () {
          return $q.when(lgas)
        }
      })
      .service('statesService', function ($q) {
        this.list = function () {
          return $q.when(states)
        }
      })
      .service('zonesService', function ($q) {
        this.list = function () {
          return $q.when(zones)
        }
      })
      .service('productListService', function ($q) {
        this.relevant = function () {
          return $q.when(products)
        }
      })
    testMod = angular.module('testMod', ['angularNavData', 'angularNavStateIndicators'])
    testMod.constant('STOCK_STATUSES', stockStatusesMock)
  })

  beforeEach(module('testMod'))

  beforeEach(inject(function (
    _$rootScope_,
    _lgasService_,
    _statesService_,
    _thresholdsService_,
    _stateIndicatorsService_,
    _productListService_
  ) {
    $rootScope = _$rootScope_
    thresholdsService = _thresholdsService_
    stateIndicatorsService = _stateIndicatorsService_

    spyOn(thresholdsService, 'calculateThresholds').and.callFake(function (location, stockCount, products, requiredStateAllocation) {
      if (!location) {
        return
      }
      if (location.level === 'zone') {
        return Object.keys(thresholds).reduce(function (zoneThresholds, product) {
          zoneThresholds[product] = Object.keys(thresholds[product]).reduce(function (productThresholds, threshold) {
            productThresholds[threshold] = thresholds[product][threshold] + requiredStateAllocation[product]
            return productThresholds
          }, {})
          return zoneThresholds
        }, {})
      }
      return thresholds
    })
  }))

  describe('decorate with indicators', function () {
    it('works with lga stock counts', function (done) {
      var stockCounts = angular.copy(lgaStockCounts)
      var expected = [
        {
          location: { zone: 'nc', state: 'kogi', lga: 'a' },
          stock: {
            'product:a': { amount: 1, status: 're-stock', allocation: 4, thresholds: thresholds['product:a'] },
            'product:b': { amount: 3, status: 'ok', allocation: 10, thresholds: thresholds['product:b'] },
            'product:c': { amount: 10, status: 'ok', allocation: 10, thresholds: thresholds['product:c'] },
            'product:d': { amount: 36, status: 'overstock', allocation: -6, thresholds: thresholds['product:d'] }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-ok',
          store: { type: 'lga' }
        },
        {
          location: { zone: 'nc', state: 'kogi', lga: 'b' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5, thresholds: thresholds['product:a'] },
            'product:b': { amount: 0, status: 'understock', allocation: 10, thresholds: thresholds['product:b'] },
            'product:c': { amount: 11, status: 'ok', allocation: 10, thresholds: thresholds['product:c'] },
            'product:d': { amount: 30, status: 'ok', allocation: 0, thresholds: thresholds['product:d'] }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-warning',
          store: { type: 'lga' }
        },
        {
          location: { zone: 'nc', state: 'kogi', lga: 'c' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5, thresholds: thresholds['product:a'] },
            'product:b': { amount: 0, status: 'understock', allocation: 10, thresholds: thresholds['product:b'] },
            'product:c': { amount: 0, status: 'understock', allocation: 20, thresholds: thresholds['product:c'] },
            'product:d': { amount: 75, status: 'overstock', allocation: -45, thresholds: thresholds['product:d'] }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-alert',
          store: { type: 'lga' }
        }
      ]
      stateIndicatorsService.decorateWithIndicators(stockCounts)
        .then(function (decoratedStockCounts) {
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(lgas[0], stockCounts[0], products)
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(lgas[1], stockCounts[1], products)
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(lgas[2], stockCounts[2], products)
          expect(decoratedStockCounts).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
    it('works with state stock counts', function (done) {
      var stockCounts = angular.copy(stateStockCounts)
      var expected = [
        {
          location: { zone: 'nc', state: 'kogi' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5, thresholds: thresholds['product:a'] },
            'product:b': { amount: 1, status: 're-stock', allocation: 10, thresholds: thresholds['product:b'] },
            'product:c': { amount: 10, status: 'ok', allocation: 10, thresholds: thresholds['product:c'] },
            'product:d': { amount: 40, status: 'overstock', allocation: -10, thresholds: thresholds['product:d'] }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-warning',
          store: { type: 'state' }
        }
      ]
      stateIndicatorsService.decorateWithIndicators(stockCounts)
        .then(function (decoratedStockCounts) {
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(states[0], stockCounts[0], products)
          expect(decoratedStockCounts).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
    it('works with zone stock counts', function (done) {
      // The required allocation for zones is the one provided by the thresholds plus
      // the required allocation to zone state stores
      var stockCounts = stateStockCounts.concat(zoneStockCounts)
      var requiredByState = {
        'product:a': 5,
        'product:b': 10,
        'product:c': 10,
        'product:d': -10
      }
      var expectedZoneThresholds = {
        'product:a': { min: 6, reOrder: 7, max: 10 },
        'product:b': { min: 11, reOrder: 12, max: 20 },
        'product:c': { min: 11, reOrder: 12, max: 30 },
        'product:d': { min: -9, reOrder: -8, max: 20 }
      }
      var expected = [
        {
          location: { zone: 'nc', state: 'kogi' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5, thresholds: thresholds['product:a'] },
            'product:b': { amount: 1, status: 're-stock', allocation: 10, thresholds: thresholds['product:b'] },
            'product:c': { amount: 10, status: 'ok', allocation: 10, thresholds: thresholds['product:c'] },
            'product:d': { amount: 40, status: 'overstock', allocation: -10, thresholds: thresholds['product:d'] }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-warning',
          store: { type: 'state' }
        },
        {
          location: { zone: 'nc' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 10, thresholds: expectedZoneThresholds['product:a'] },
            'product:b': { amount: 11, status: 're-stock', allocation: 10, thresholds: expectedZoneThresholds['product:b'] },
            'product:c': { amount: 20, status: 'ok', allocation: 10, thresholds: expectedZoneThresholds['product:c'] },
            'product:d': { amount: 40, status: 'overstock', allocation: -20, thresholds: expectedZoneThresholds['product:d'] }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-warning',
          store: { type: 'zone' }
        }
      ]
      stateIndicatorsService.decorateWithIndicators(stockCounts)
        .then(function (decoratedStockCounts) {
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(states[0], stockCounts[0], products)
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(zones[0], stockCounts[1], products, requiredByState)
          expect(decoratedStockCounts).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
    it('uses no default stockLevelStatus, status, allocation or thresholds', function (done) {
      var unknownLgaStockCount = {
        location: { zone: 'nc', state: 'kogi', lga: 'unknown' },
        stock: { 'product:a': 2, 'product:b': 3, 'product:c': 10, 'product:d': 20 },
        store: { type: 'lga' }
      }
      var expected = [
        {
          location: { zone: 'nc', state: 'kogi', lga: 'unknown' },
          stock: {
            'product:a': { amount: 2, status: undefined, allocation: undefined, thresholds: undefined },
            'product:b': { amount: 3, status: undefined, allocation: undefined, thresholds: undefined },
            'product:c': { amount: 10, status: undefined, allocation: undefined, thresholds: undefined },
            'product:d': { amount: 20, status: undefined, allocation: undefined, thresholds: undefined }
          },
          reStockNeeded: false,
          stockLevelStatus: 'unknown',
          store: { type: 'lga' }
        }
      ]

      stateIndicatorsService.decorateWithIndicators([unknownLgaStockCount])
        .then(function (decoratedStockCounts) {
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(undefined, unknownLgaStockCount, products)
          expect(decoratedStockCounts).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
  })
})
