import angular from 'angular'

import StateIndicatorsService from './state-indicators.service'

angular
  .module('angularNavStateIndicators', [
    'ngSmartId',
    'angularNavData',
    'angularNavThresholds'
  ])
  .service('stateIndicatorsService', StateIndicatorsService)
