import angular from 'angular'
import 'angular-nav-data'
import 'angular-nav-thresholds'

import StateIndicatorsService from './state-indicators.service'

angular
  .module('angularNavStateIndicators', [
    'angularNavData',
    'angularNavThresholds'
  ])
  .service('stateIndicatorsService', StateIndicatorsService)
