const ETH_BASE = 1000000000000000000
var chart
var currency = 'ETH'
var currentResult
var remainingSeconds

function renderState() {
    doUpdateState()
    if(remainingSeconds) {
        setInterval(function () {
            remainingSeconds = remainingSeconds - 1
            doUpdateState()
        }, 1000)
    }
}

function calculateRemainingSecondsString() {
    if(!remainingSeconds) {
        return undefined
    }
    const s = remainingSeconds % 60
    const m = Math.floor(remainingSeconds % 3600 / 60)
    const h = Math.floor(remainingSeconds % 86400 / 3600)
    const d = Math.floor(remainingSeconds / 86400)
    return timeString = `${d}d ${h}h ${m}m ${s}s`
}

function doUpdateState() {
    var timeString
    if(currentResult.state === 'Started') {
        timeString = calculateRemainingSecondsString()
    } else {
        timeString = currentResult.state
    }
    $('#remaining-time').html(timeString)
}

function renderSlots() {
    $('#slots-taken').html(currentResult.takenSlotsCount)
    $('#slots-free').html(currentResult.freeSlotsCount)
    $('#slots-max').html(currentResult.maxSlotsCount)
    $('#slots-min').html(currentResult.minSlotsCount)
}

function renderAddress() {
    $('#address').html(currentResult.contractAddress)
}

function renderCurrentPrice() {
    var price
    if (currentResult.state === 'Finished') {
        $('#current-price-desc').html('Lowest Bid Price')
        price = currentResult.lowestBidPriceInWEI
    } else if (currentResult.state === 'Started') {
        $('#current-price-desc').html('Current Price')
        price = currentResult.currentPriceInWEI
    } else if (currentResult.state === 'Not Started') {
        $('#current-price-desc').html('Initial Price')
        price = currentResult.initialPriceInWEI
    } else {
        $('#current-price-desc').hide()
        $('#current-price').hide()
        return;
    }

    var priceString
    if (currency === 'ETH') {
        priceString = (price / ETH_BASE).toFixed(2) + ' ETH'
    } else {
        priceString = price + ' WEI'
    }
    $('#current-price').html(priceString)
}

function getTooltipRow(dataPoint, point) {
    const row = []
    row.push(`${dataPoint.xLabel}:`)
    if (point.address) {
        row.push(`Bidder: ${point.address}`)
    }
    if (currency === 'ETH') {
        row.push(`Slot Price: ${(point.slotPrice / ETH_BASE).toFixed(3)} ETH`)
        if (point.bidValue) {
            row.push(`Bid Price:  ${(point.bidValue / ETH_BASE).toFixed(3)} ETH`)
        }
    } else {
        row.push(`Slot Price: ${point.slotPrice} WEI`)
        if (point.bidValue) {
            row.push(`Bid Price:  ${point.bidValue} WEI`)
        }
    }
    return row
}

function renderChart(bids, priceFunction, currentBlocktimeInMs, remainingSeconds, state) {
    var verticalLineAnnotation
    if (remainingSeconds === 0 || state !== 'Started') {
        verticalLineAnnotation = {}
    } else {
        verticalLineAnnotation = {
            drawTime: 'afterDatasetsDraw',
            annotations: [{
                type: 'line',
                mode: 'vertical',
                scaleID: 'x-axis-0',
                value: currentBlocktimeInMs,
                borderColor: 'rgb(23,64,120)',
                borderWidth: 2,
                label: {
                    enabled: true,
                    position: 'bottom',
                    content: 'Now'
                }
            }]
        }
    }

    var ctx = document.getElementById('bids').getContext('2d')
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Price Function',
                    data: priceFunction,
                    borderColor: 'rgb(135,75,160)',
                    fill: false,
                    pointRadius: 0,
                    pointHitRadius: 2
                },
                {
                    type: 'bubble',
                    label: 'Bid Price',
                    data: bids,
                    borderColor: 'rgb(116,190,226)',
                    pointHitRadius: 1,
                    fill: false
                }
            ]
        },
        options: {
            legend: {
                display: false
            },
            annotation: verticalLineAnnotation,
            scales: {
                xAxes: [{
                    id: 'x-axis-0',
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            'day': 'MMM DD'
                        }
                    }
                }],
                yAxes: [{
                    id: 'y-axis-0',
                    type: 'logarithmic',
                    ticks: {
                        callback: function (value, index, values) {
                            if (index % 5 === 0) {
                                if (currency === 'ETH') {
                                    return (value / ETH_BASE).toFixed(2) + ' ETH '
                                } else {
                                    return value + ' WEI '
                                }
                            }
                            else {
                                return ''
                            }
                        }
                    }
                }]
            },
            hover: {
                mode: 'point',
                animationDuration: 0
            },
            tooltips: {
                mode: 'point',
                enabled: false,
                custom: function (tooltip) {
                    $(this._chart.canvas).css('cursor', 'pointer')
                    var positionY = this._chart.canvas.offsetTop
                    var positionX = this._chart.canvas.offsetLeft
                    $('.chartjs-tooltip').css({
                        opacity: 0,
                    })
                    if (!tooltip || !tooltip.opacity) {
                        return
                    }
                    if (tooltip.dataPoints.length > 0) {
                        var slotPriceSet = false
                        const tooltipContent = []
                        const offsetY = tooltip.dataPoints[0].y
                        const offsetX = tooltip.dataPoints[0].x
                        for (const dataPoint of tooltip.dataPoints) {
                            var point = this._data.datasets[dataPoint.datasetIndex].data[dataPoint.index]
                            if (!point.address) {
                                if (slotPriceSet) {
                                    continue
                                }
                                slotPriceSet = true
                            }
                            tooltipContent.push(getTooltipRow(dataPoint, point).join('<br/>'))
                        }
                        var $tooltip = $('#tooltip')
                        $tooltip.html(tooltipContent.join('<hr style="border: 1px solid white"/>'))
                        $tooltip.css({
                            opacity: 1,
                            top: positionY + offsetY + 'px',
                            left: positionX + offsetX + 'px',
                        })
                    }
                }
            }
        }
    })
    Chart.defaults.global.defaultFontFamily = 'Gothic A1'
    Chart.defaults.global.defaultFontSize = 16
}

function getAuctionData() {
    $.ajax({
        url: 'http://localhost:8090/auction-summary',
        success: function (result) {
            currentResult = result
            remainingSeconds = currentResult.remainingSeconds
            if (result.state === 'Not Deployed') {
                $('#loading-message').html('Auction hasn\'t started yet')
                $('.chart-table').hide()
                return
            }
            $('#loading-message').html('')
            var bidPrice = []
            var priceFunction = []
            for (const bid of result.bids) {
                bidPrice.push({ address: bid.bidder, bidValue: parseInt(bid.bidValue, 16), slotPrice: parseInt(bid.slotPrice, 16), y: parseInt(bid.bidValue, 16), x: bid.timestamp * 1000 })
            }
            for (const functionPoint of result.priceFunction) {
                priceFunction.push({ slotPrice: parseInt(functionPoint.slotPrice, 16), y: parseInt(functionPoint.slotPrice, 16), x: functionPoint.timestamp * 1000 })
            }
            renderChart(bidPrice, priceFunction, result.currentBlocktimeInMs, result.remainingSeconds, result.state)
            renderState(result.remainingSeconds, result.state)
            renderCurrentPrice()
            renderAddress()
            renderSlots()
            chart.update()
        },
        error: function (err) {
            $('#loading-message').html('Error')
        }
    })
}

$(window).on('load',
    function () {
        getAuctionData()
    }
)

$('#currency-switch').btnSwitch({
    OnText: 'ETH',
    OnValue: 'ETH',
    OnCallback: function (val) {
        currency = val
        renderCurrentPrice()
        chart.update()
    },
    ToggleState: 'ETH',
    OffValue: 'WEI',
    OffText: 'WEI',
    OffCallback: function (val) {
        currency = val
        renderCurrentPrice()
        chart.update()
    }
})