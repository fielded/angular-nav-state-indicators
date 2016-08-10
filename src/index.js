import angular from 'angular'

import StateIndicatorsService from './state-indicators.service'

angular
  .module('angularNavStateIndicators', [
    'angularNavData',
    'angularNavThresholds',
    'angularNavData.products'
  ])
  .service('stateIndicatorsService', StateIndicatorsService)
