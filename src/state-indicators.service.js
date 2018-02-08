const find = (list, match) => {
  for (let i = 0; i < list.length; i++) {
    if (match(list[i])) {
      return list[i]
    }
  }
  return undefined
}

const productsGroupedByStatus = (stock, products) => {
  return Object.keys(stock).reduce((grouped, productId) => {
    const isRelevant = !!find(products, (product) => product._id === productId)
    const status = stock[productId].status
    if (!isRelevant) {
      return grouped
    }
    if (status) {
      grouped[status].push(productId)
    }
    return grouped
  }, { understock: [], 're-stock': [], ok: [], overstock: [] })
}

const sumAllocations = (sum, stock) => {
  return Object.keys(stock).reduce((total, product) => {
    total[product] = total[product] || 0
    if (stock[product].allocation > 0) {
      total[product] += stock[product].allocation
    }
    return total
  }, sum)
}

// TODO: make sure stock_statuses is availalbe
class StateIndicatorsService {
  constructor (
    $q,
    smartId,
    STOCK_STATUSES,
    lgasService,
    statesService,
    zonesService,
    locationsService,
    thresholdsService,
    productListService
  ) {
    this.$q = $q
    this.smartId = smartId
    this.STOCK_STATUSES = STOCK_STATUSES
    this.lgasService = lgasService
    this.statesService = statesService
    this.zonesService = zonesService
    this.locationsService = locationsService
    this.thresholdsService = thresholdsService
    this.productListService = productListService
  }

  stateRequiredAllocationsByZone (stockCounts) {
    return stockCounts.reduce((allocations, stockCount) => {
      if (stockCount.location && stockCount.location.state && !stockCount.location.lga && stockCount.reStockNeeded) {
        const zone = this.smartId.idify({ zone: stockCount.location.zone }, 'locationId')
        allocations[zone] = allocations[zone] || {}
        allocations[zone] = sumAllocations(allocations[zone], stockCount.stock)
      }
      return allocations
    }, {})
  }

  decorateWithIndicators (stockCounts, opts = {}) {
    let lgas
    let states
    let zones
    let products
    let national

    const getLocation = (lgas, states, zones, stockCount) => {
      if (!stockCount.location) {
        return
      }
      const locationId = this.smartId.idify(stockCount.location, 'locationId')

      let locations = zones
      if (stockCount.location.state) {
        locations = stockCount.location.lga ? lgas : states
      }
      return find(locations, (locationDoc) => locationDoc._id === locationId)
    }

    const decorateStockField = (stockCount, requiredAllocations) => {
      let location
      if (stockCount.location.national) {
        location = national
      } else {
        location = getLocation(lgas, states, zones, stockCount)
      }

      let locationThresholds
      if (location && location.level === 'zone' && requiredAllocations) {
        locationThresholds = this.thresholdsService.calculateThresholds(location, stockCount, products, requiredAllocations[location._id])
      } else {
        locationThresholds = this.thresholdsService.calculateThresholds(location, stockCount, products)
      }
      const stock = stockCount.stock

      const decoratedStock = Object.keys(stock).reduce((decorated, product) => {
        // v2 stock count report
        let amount = stock[product].amount
        let status
        let allocation
        let productThresholds
        let selectedProduct = find(products, (prod) => {
          return prod._id === product
        })

        if (locationThresholds) {
          productThresholds = locationThresholds[product]

          if (productThresholds) {
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
        const groupedByStatus = productsGroupedByStatus(stockCount.stock, products)
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
      const grouped = productsGroupedByStatus(stockCount.stock, products)
      const understockedProducts = grouped.understock.length
      const totalGrouped = Object.keys(grouped).reduce((sum, group) => sum + grouped[group].length, 0)

      stockCount.stockLevelStatus = 'unknown'
      if (stockCount.location) {
        if (understockedProducts >= this.STOCK_STATUSES.alert.threshold) {
          stockCount.stockLevelStatus = this.STOCK_STATUSES.alert.id
        } else if (understockedProducts >= this.STOCK_STATUSES.warning.threshold) {
          stockCount.stockLevelStatus = this.STOCK_STATUSES.warning.id
        } else if (totalGrouped > 0) {
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

    const isNationalStockCount = (stockCount) => {
      return (stockCount.location && stockCount.location.national)
    }

    const decorateStockCounts = (nonZoneStockCounts, zoneStockCounts, promiseResults) => {
      lgas = promiseResults.lgas
      states = promiseResults.states
      zones = promiseResults.zones || [] // not available for the state dashboard
      products = promiseResults.products
      national = promiseResults.national || {}

      nonZoneStockCounts = nonZoneStockCounts
                            .map(nonZoneStockCount => decorateStockField(nonZoneStockCount))
                            .map(addReStockField)
      zoneStockCounts = zoneStockCounts
                            .map(zoneStockCount => {
                              if (opts.requireChildAllocations === false) {
                                return decorateStockField(zoneStockCount)
                              }
                              return decorateStockField(zoneStockCount, this.stateRequiredAllocationsByZone(nonZoneStockCounts))
                            })
                            .map(addReStockField)

      return nonZoneStockCounts.concat(zoneStockCounts)
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
    let nationalStockCounts = stockCounts.filter(isNationalStockCount)

    if (zoneStockCounts.length) {
      promises.zones = this.zonesService.list()
    }

    if (nationalStockCounts.length) {
      promises.national = this.locationsService.get('national')
    }

    return this.$q
            .all(promises)
            .then(decorateStockCounts.bind(null, nonZoneStockCounts, zoneStockCounts))
  }
}

StateIndicatorsService.$inject = ['$q', 'smartId', 'STOCK_STATUSES', 'lgasService', 'statesService', 'zonesService', 'locationsService', 'thresholdsService', 'productListService']

export default StateIndicatorsService
