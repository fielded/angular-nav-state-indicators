'use strict'

describe('state indicators service', function () {
  var stateIndicatorsService
  var thresholdsService
  var $rootScope
  var angularNavDataMock // eslint-disable-line
  var testMod // eslint-disable-line

  var lgas = [
    { _id: 'zone:nc:state:kogi:lga:a', id: 'a' },
    { _id: 'zone:nc:state:kogi:lga:b', id: 'b' },
    { _id: 'zone:nc:state:kogi:lga:c', id: 'c' }
  ]

  var states = [
    { _id: 'zone:nc:state:kogi', id: 'kogi' }
  ]

  var zones = [
    { _id: 'zone:nc', id: 'nc' }
  ]

  var lgaStockCounts = [
    {
      location: { zone: 'nc', state: 'kogi', lga: 'a' },
      stock: { 'product:a': 2, 'product:b': 3, 'product:c': 10, 'product:d': 36 },
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
      stock: { 'product:a': 0, 'product:b': 2, 'product:c': 10, 'product:d': 40 },
      store: { type: 'state' }
    }
  ]

  var zoneStockCounts = [
    {
      location: { zone: 'nc' },
      stock: { 'product:a': 0, 'product:b': 2, 'product:c': 10, 'product:d': 40 },
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

    spyOn(thresholdsService, 'calculateThresholds').and.callFake(function (location) {
      if (!location) {
        return
      }
      return {
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
    })
  }))

  describe('decorate with indicators', function () {
    it('works with lga stock counts', function (done) {
      var expected = [
        {
          location: { zone: 'nc', state: 'kogi', lga: 'a' },
          stock: {
            'product:a': { amount: 2, status: 're-stock', allocation: 3 },
            'product:b': { amount: 3, status: 'ok', allocation: 10 },
            'product:c': { amount: 10, status: 'ok', allocation: 10 },
            'product:d': { amount: 36, status: 'overstock', allocation: -6 }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-ok',
          store: { type: 'lga' }
        },
        {
          location: { zone: 'nc', state: 'kogi', lga: 'b' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5 },
            'product:b': { amount: 0, status: 'understock', allocation: 10 },
            'product:c': { amount: 11, status: 'ok', allocation: 10 },
            'product:d': { amount: 30, status: 'ok', allocation: 0 }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-warning',
          store: { type: 'lga' }
        },
        {
          location: { zone: 'nc', state: 'kogi', lga: 'c' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5 },
            'product:b': { amount: 0, status: 'understock', allocation: 10 },
            'product:c': { amount: 0, status: 'understock', allocation: 20 },
            'product:d': { amount: 75, status: 'overstock', allocation: -45 }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-alert',
          store: { type: 'lga' }
        }
      ]
      stateIndicatorsService.decorateWithIndicators(lgaStockCounts)
        .then(function (decoratedStockCounts) {
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(lgas[0], lgaStockCounts[0])
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(lgas[1], lgaStockCounts[1])
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(lgas[2], lgaStockCounts[2])
          expect(decoratedStockCounts).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
    it('works with state stock counts', function (done) {
      var expected = [
        {
          location: { zone: 'nc', state: 'kogi' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5 },
            'product:b': { amount: 2, status: 're-stock', allocation: 10 },
            'product:c': { amount: 10, status: 'ok', allocation: 10 },
            'product:d': { amount: 40, status: 'overstock', allocation: -10 }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-warning',
          store: { type: 'state' }
        }
      ]
      stateIndicatorsService.decorateWithIndicators(stateStockCounts)
        .then(function (decoratedStockCounts) {
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(states[0], stateStockCounts[0])
          expect(decoratedStockCounts).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
    it('works with zone stock counts', function (done) {
      var expected = [
        {
          location: { zone: 'nc' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5 },
            'product:b': { amount: 2, status: 're-stock', allocation: 10 },
            'product:c': { amount: 10, status: 'ok', allocation: 10 },
            'product:d': { amount: 40, status: 'overstock', allocation: -10 }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-warning',
          store: { type: 'zone' }
        }
      ]
      stateIndicatorsService.decorateWithIndicators(zoneStockCounts)
        .then(function (decoratedStockCounts) {
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(zones[0], zoneStockCounts[0])
          expect(decoratedStockCounts).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
    it('uses no default stockLevelStatus, status or allocation', function (done) {
      var unknownLgaStockCount = {
        location: { zone: 'nc', state: 'kogi', lga: 'unknown' },
        stock: { 'product:a': 2, 'product:b': 3, 'product:c': 10, 'product:d': 20 },
        store: { type: 'lga' }
      }
      var expected = [
        {
          location: { zone: 'nc', state: 'kogi', lga: 'unknown' },
          stock: {
            'product:a': { amount: 2, status: undefined, allocation: undefined },
            'product:b': { amount: 3, status: undefined, allocation: undefined },
            'product:c': { amount: 10, status: undefined, allocation: undefined },
            'product:d': { amount: 20, status: undefined, allocation: undefined }
          },
          reStockNeeded: false,
          stockLevelStatus: 'unknown',
          store: { type: 'lga' }
        }
      ]

      stateIndicatorsService.decorateWithIndicators([unknownLgaStockCount])
        .then(function (decoratedStockCounts) {
          expect(thresholdsService.calculateThresholds).toHaveBeenCalledWith(undefined, unknownLgaStockCount)
          expect(decoratedStockCounts).toEqual(expected)
        })
      $rootScope.$digest()
      done()
    })
  })
})
