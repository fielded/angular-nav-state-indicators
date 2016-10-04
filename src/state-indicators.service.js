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

    const addRequiredAllocations = (thresholds, requiredAllocation) => {
      return Object.keys(thresholds).reduce((withAllocations, threshold) => {
        withAllocations[threshold] += requiredAllocation
        return withAllocations
      }, thresholds)
    }

    const decorateStockField = (requiredAllocations, stockCount) => {
      const location = getLocation(lgas, states, zones, stockCount)
      let locationThresholds
      if (location && location.level === 'zone') {
        locationThresholds = this.thresholdsService.calculateThresholds(location, stockCount, products, requiredAllocations[location.id])
      } else {
        locationThresholds = this.thresholdsService.calculateThresholds(location, stockCount, products)
      }
      const stock = stockCount.stock

      const decoratedStock = Object.keys(stock).reduce((decorated, product) => {
        let amount = stock[product]
        let status
        let allocation
        let productThresholds
        let selectedProduct = find(products, (prod) => {
          return prod._id === product
        })

        if (locationThresholds) {
          productThresholds = locationThresholds[product]

          if (productThresholds) {
            if (location && location.level === 'zone' && requiredAllocations && requiredAllocations[product]) {
              productThresholds = addRequiredAllocations(productThresholds, requiredAllocations[product])
            }

            status = 'overstock'
            if (amount < productThresholds.min) {
              status = 'understock'
            } else if (amount < productThresholds.reOrder) {
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
          allocation: allocation,
          thresholds: productThresholds
        }

        return decorated
      }, {})

      stockCount.stock = decoratedStock
      return stockCount
    }

    const addReStockField = (stockCount) => {
      const addAllocationIfPositive = (sum, productId) => {
        if (stockCount.stock[productId].allocation > 0) {
          sum = sum + stockCount.stock[productId].allocation
        }
        return sum
      }

      if (stockCount.location && stockCount.location.lga) {
        const groupedByStatus = productsGroupedByStatus(stockCount.stock)
        stockCount.reStockNeeded = !!(groupedByStatus.understock.length + groupedByStatus['re-stock'].length)
      } else { // states and zones
        if (stockCount.stock) {
          const sumOfPositiveAllocations = Object.keys(stockCount.stock).reduce(addAllocationIfPositive, 0)
          stockCount.reStockNeeded = sumOfPositiveAllocations > 0
        }
      }
      return stockCount
    }

    const addStockLevelStatusField = (stockCount) => {
      const unknownProducts = productsGroupedByStatus(stockCount.stock).unknown.length
      const understockedProducts = productsGroupedByStatus(stockCount.stock).understock.length

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

    const isZoneStockCount = (stockCount) => {
      return (stockCount.location && stockCount.location.zone && !stockCount.location.state)
    }

    const isNonZoneStockCount = (stockCount) => {
      return !isZoneStockCount(stockCount)
    }

    const sumAllocations = (sum, stock) => {
      return Object.keys(stock).reduce((total, product) => {
        total[product] = total[product] || 0
        total[product] += stock[product].allocation
        return total
      }, sum)
    }

    const zoneRequiredAllocations = (stockCounts) => {
      return stockCounts.reduce((allocations, stockCount) => {
        if (stockCount.location && stockCount.location.state && !stockCount.location.lga) {
          const zone = stockCount.location.zone
          allocations[zone] = allocations[zone] || {}
          allocations[zone] = sumAllocations(allocations[zone], stockCount.stock)
        }
        return allocations
      }, {})
    }

    const decorateStockCounts = (nonZoneStockCounts, zoneStockCounts, promiseResults) => {
      lgas = promiseResults.lgas
      states = promiseResults.states
      zones = promiseResults.zones || [] // not available for the state dashboard
      products = promiseResults.products

      nonZoneStockCounts = nonZoneStockCounts.map(decorateStockField.bind(null, null))
      zoneStockCounts = zoneStockCounts.map(decorateStockField.bind(null, zoneRequiredAllocations(nonZoneStockCounts)))

      return nonZoneStockCounts.concat(zoneStockCounts)
              .map(addReStockField)
              .map(addStockLevelStatusField)
    }

    let promises = {
      lgas: this.lgasService.list(),
      states: this.statesService.list(),
      products: this.productListService.relevant()
    }

    stockCounts = stockCounts.filter(hasNonEmptyStock)

    if (!stockCounts.length) {
      return this.$q.when(stockCounts)
    }

    let zoneStockCounts = stockCounts.filter(isZoneStockCount)
    let nonZoneStockCounts = stockCounts.filter(isNonZoneStockCount)

    if (zoneStockCounts.length) {
      promises.zones = this.zonesService.list()
    }

    return this.$q
            .all(promises)
            .then(decorateStockCounts.bind(null, nonZoneStockCounts, zoneStockCounts))
  }
}

StateIndicatorsService.$inject = ['$q', 'STOCK_STATUSES', 'lgasService', 'statesService', 'zonesService', 'thresholdsService', 'productListService']

export default StateIndicatorsService
