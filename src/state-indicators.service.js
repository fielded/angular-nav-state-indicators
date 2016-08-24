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
    } else {
      grouped['unknown'].push(product)
    }
    return grouped
  }, { understock: [], 're-stock': [], ok: [], overstock: [], unknown: [] })
}

// TODO: make sure stock_statuses is availalbe
class StateIndicatorsService {
  constructor (
    $q,
    STOCK_STATUSES,
    lgasService,
    statesService,
    zonesService,
    thresholdsService,
    productListService
  ) {
    this.$q = $q
    this.STOCK_STATUSES = STOCK_STATUSES
    this.lgasService = lgasService
    this.statesService = statesService
    this.zonesService = zonesService
    this.thresholdsService = thresholdsService
    this.productListService = productListService
  }

  decorateWithIndicators (stockCounts) {
    let lgas
    let states
    let zones
    let products

    const getLocation = (lgas, states, zones, stockCount) => {
      const lga = stockCount.location.lga
      const state = stockCount.location.state
      if (lga) {
        return find(lgas, (lgaDoc) => lgaDoc.id === lga)
      } else if (state) {
        return find(states, (stateDoc) => stateDoc.id === state)
      } else {
        const zone = stockCount.location.zone
        return find(zones, (zoneDoc) => zoneDoc.id === zone)
      }
    }

    const decorateStockField = (stockCount) => {
      const location = getLocation(lgas, states, zones, stockCount)
      const locationThresholds = this.thresholdsService.calculateThresholds(location, stockCount)
      const stock = stockCount.stock

      const decoratedStock = Object.keys(stock).reduce((decorated, product) => {
        let amount = stock[product]
        let status
        let allocation
        let selectedProduct = find(products, function (prod) {
          return prod._id === product
        })

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

            const productBalance = productThresholds.max - amount
            allocation = productBalance
            if (selectedProduct) {
              const unitBalance = productBalance % selectedProduct.presentation
              allocation = unitBalance > 0 ? productBalance + (selectedProduct.presentation - unitBalance) : productBalance
            }
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
      var unknownProducts = productsGroupedByStatus(stockCount.stock).unknown.length
      var understockedProducts = productsGroupedByStatus(stockCount.stock).understock.length

      if (stockCount.location) {
        if (understockedProducts >= this.STOCK_STATUSES.alert.threshold) {
          stockCount.stockLevelStatus = this.STOCK_STATUSES.alert.id
        } else if (understockedProducts >= this.STOCK_STATUSES.warning.threshold) {
          stockCount.stockLevelStatus = this.STOCK_STATUSES.warning.id
        } else if (unknownProducts) {
          stockCount.stockLevelStatus = 'unknown'
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
      zones = promiseResults.zones
      products = promiseResults.products

      return stockCounts
              .filter(hasNonEmptyStock)
              .map(decorateStockField)
              .map(addReStockField)
              .map(addStockLevelStatusField)
    }

    let promises = {
      lgas: this.lgasService.list(),
      states: this.statesService.list(),
      zones: this.zonesService.list(),
      products: this.productListService.relevant()
    }

    return this.$q
            .all(promises)
            .then(decorateStockCounts)
  }
}

StateIndicatorsService.$inject = ['$q', 'STOCK_STATUSES', 'lgasService', 'statesService', 'zonesService', 'thresholdsService', 'productListService']

export default StateIndicatorsService
