const find = (list, match) => {
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      return list[i]
    }
  }
  return undefined
}

const productsGroupedByStatus = (stock) => {
  return Object.keys(stock).reduce((grouped, product) => {
    const status = stock[product].status
    if (status) {
      grouped[status].push(product)
    }
    return grouped
  }, { understock: [], 're-stock': [], ok: [], overstock: [] })
}

// TODO: make sure stock_statuses is availalbe
class StateIndicatorsService {
  constructor (
    $q,
    STOCK_STATUSES,
    lgasService,
    statesService,
    thresholdsService
  ) {
    this.$q = $q
    this.STOCK_STATUSES = STOCK_STATUSES
    this.lgasService = lgasService
    this.statesService = statesService
    this.thresholdsService = thresholdsService
  }

  decorateWithIndicators (stockCounts) {
    let lgas
    let states

    const getLocation = (lgas, states, stockCount) => {
      const lga = stockCount.location.lga
      if (lga) {
        return find(lgas, (lgaDoc) => lgaDoc.id === lga)
      } else {
        const state = stockCount.location.state
        return find(states, (stateDoc) => stateDoc.id === state)
      }
    }

    const decorateStockField = (stockCount) => {
      const location = getLocation(lgas, states, stockCount)
      const locationThresholds = this.thresholdsService.calculateThresholds(location, stockCount)
      const stock = stockCount.stock

      const decoratedStock = Object.keys(stock).reduce((decorated, product) => {
        let amount = stock[product]
        let status
        let allocation

        if (locationThresholds) {
          var productThresholds = locationThresholds[product]

          if (productThresholds) {
            status = 'overstock'
            if (amount <= productThresholds.min) {
              status = 'understock'
            } else if (amount <= productThresholds.reOrder) {
              status = 're-stock'
            } else if (amount <= productThresholds.max) {
              status = 'ok'
            }

            allocation = productThresholds.max - amount
          }
        }

        decorated[product] = {
          status: status,
          amount: amount,
          allocation: allocation
        }

        return decorated
      }, {})

      stockCount.stock = decoratedStock
      return stockCount
    }

    const addReStockField = (stockCount) => {
      const groupedByStatus = productsGroupedByStatus(stockCount.stock)
      stockCount.reStockNeeded = !!(groupedByStatus.understock.length + groupedByStatus['re-stock'].length)
      return stockCount
    }

    const addStockLevelStatusField = (stockCount) => {
      var understockedProducts = productsGroupedByStatus(stockCount.stock).understock.length

      if (stockCount.store && stockCount.store.type === 'lga') {
        if (understockedProducts >= this.STOCK_STATUSES.alert.threshold) {
          stockCount.stockLevelStatus = this.STOCK_STATUSES.alert.id
        } else if (understockedProducts >= this.STOCK_STATUSES.warning.threshold) {
          stockCount.stockLevelStatus = this.STOCK_STATUSES.warning.id
        } else {
          stockCount.stockLevelStatus = this.STOCK_STATUSES.ok.id
        }
      }

      return stockCount
    }

    const hasNonEmptyStock = (stockCount) => {
      return (stockCount.stock && Object.keys(stockCount.stock).length)
    }

    const decorateStockCounts = (promiseResults) => {
      lgas = promiseResults.lgas
      states = promiseResults.states

      return stockCounts
              .filter(hasNonEmptyStock)
              .map(decorateStockField)
              .map(addReStockField)
              .map(addStockLevelStatusField)
    }

    let promises = {
      lgas: this.lgasService.list(),
      states: this.statesService.list()
    }

    return this.$q
            .all(promises)
            .then(decorateStockCounts)
  }
}

StateIndicatorsService.$inject = ['$q', 'STOCK_STATUSES', 'lgasService', 'statesService', 'thresholdsService']

export default StateIndicatorsService
