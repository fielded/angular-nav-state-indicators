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

  var lgaStockCounts = [
    {
      location: { zone: 'nc', state: 'kogi', lga: 'a' },
      stock: { 'product:a': 2, 'product:b': 2, 'product:c': 5, 'product:d': 6 },
      store: { type: 'lga' }
    },
    {
      location: { zone: 'nc', state: 'kogi', lga: 'b' },
      stock: { 'product:a': 0, 'product:b': 2, 'product:c': 5, 'product:d': 6 },
      store: { type: 'lga' }
    },
    {
      location: { zone: 'nc', state: 'kogi', lga: 'c' },
      stock: { 'product:a': 0, 'product:b': 0, 'product:c': 0, 'product:d': 6 },
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
      stock: { 'product:a': 0, 'product:b': 2, 'product:c': 5, 'product:d': 6 },
      store: { type: 'state' }
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
    testMod = angular.module('testMod', ['angularNavData', 'angularNavStateIndicators'])
    testMod.constant('STOCK_STATUSES', stockStatusesMock)
  })

  beforeEach(module('testMod'))

  beforeEach(inject(function (_$rootScope_, _lgasService_, _statesService_, _thresholdsService_, _stateIndicatorsService_) {
    $rootScope = _$rootScope_
    thresholdsService = _thresholdsService_
    stateIndicatorsService = _stateIndicatorsService_

    spyOn(thresholdsService, 'calculateThresholds').and.callFake(function (done) {
      return {
        'product:a': {
          min: 1,
          reOrder: 2,
          max: 5
        },
        'product:b': {
          min: 1,
          reOrder: 2,
          max: 5
        },
        'product:c': {
          min: 1,
          reOrder: 2,
          max: 5
        },
        'product:d': {
          min: 1,
          reOrder: 2,
          max: 5
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
            'product:b': { amount: 2, status: 're-stock', allocation: 3 },
            'product:c': { amount: 5, status: 'ok', allocation: 0 },
            'product:d': { amount: 6, status: 'overstock', allocation: -1 }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-ok',
          store: { type: 'lga' }
        },
        {
          location: { zone: 'nc', state: 'kogi', lga: 'b' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5 },
            'product:b': { amount: 2, status: 're-stock', allocation: 3 },
            'product:c': { amount: 5, status: 'ok', allocation: 0 },
            'product:d': { amount: 6, status: 'overstock', allocation: -1 }
          },
          reStockNeeded: true,
          stockLevelStatus: 'kpi-warning',
          store: { type: 'lga' }
        },
        {
          location: { zone: 'nc', state: 'kogi', lga: 'c' },
          stock: {
            'product:a': { amount: 0, status: 'understock', allocation: 5 },
            'product:b': { amount: 0, status: 'understock', allocation: 5 },
            'product:c': { amount: 0, status: 'understock', allocation: 5 },
            'product:d': { amount: 6, status: 'overstock', allocation: -1 }
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
            'product:b': { amount: 2, status: 're-stock', allocation: 3 },
            'product:c': { amount: 5, status: 'ok', allocation: 0 },
            'product:d': { amount: 6, status: 'overstock', allocation: -1 }
          },
          reStockNeeded: true,
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
  })
})
