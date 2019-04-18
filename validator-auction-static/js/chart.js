function renderRemainingTime(remainingSeconds) {
    doUpdateRemainingTime(remainingSeconds)
    setInterval(function () {
        remainingSeconds = remainingSeconds - 1
        doUpdateRemainingTime(remainingSeconds)
    }, 1000)
}

function doUpdateRemainingTime(remainingSeconds) {
    const s = remainingSeconds % 60
    const m = Math.floor(remainingSeconds % 3600 / 60)
    const h = Math.floor(remainingSeconds % 86400 / 3600)
    const d = Math.floor(remainingSeconds / 86400)
    let timeString = 'Auction is finished'
    if (remainingSeconds > 0) {
        timeString = `Remaining Time: ${d}d ${h}h ${m}m ${s}s`
    }
    $('#remaining-time').html(timeString)
}

function renderSlots(takenSlotsCount, freeSlotsCount) {
    $('#slots-taken').html(`Slots taken: ${takenSlotsCount}`)
    $('#slots-free').html(`Slots free: ${freeSlotsCount}`)
}

function renderAddress(address) {
    $('#address').html(`Contract Address: ${address}`)
}

function renderCurrentPrice(currentPrice) {
    $('#current-price').html(`Current Price: ${currentPrice}`)
}

function renderChart(data) {
    var ctx = document.getElementById('bids').getContext('2d')
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Validator Auction Bids',
                data: data,
                lineTension: 0,
                borderColor: 'rgb(6, 62, 136)',
                fill: false
            }]
        },
        options: {
            scales: {
                xAxes: [{
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            'day': 'MMM DD'
                        }
                    }
                }],
                yAxes: [{
                    type: 'logarithmic'
                }]
            },
            tooltips: {
                displayColors: false,
                callbacks: {
                    label: function (tooltipItem, data) {
                        var point = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index]
                        return `Bid by: ${point.address}`
                    },
                    afterLabel: function (tooltipItem, data) {
                        var point = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index]
                        return [`Bid value: ${point.y}`, `Actual price: ${point.slotPrice}`]
                    }
                }
            }
        }
    })
}

function getAuctionData() {
    // TODO: Change URL
    $.ajax({
        url: 'http://localhost:8090/auction-summary',
        success: function (result) {
            $('#loading-message').html('')
            var data = []
            for (const bid of result.bids) {
                data.push({ address: bid.bidder, slotPrice: parseInt(bid.slotPrice, 16), y: parseInt(bid.bidValue, 16), x: bid.timestamp * 1000 })
            }
            if(result.remainingSeconds < 0) {
                $('#loading-message').html('Auction hasn\'t started yet.')
                return
            }
            renderChart(data)
            renderRemainingTime(result.remainingSeconds)
            renderCurrentPrice(result.currentPrice)
            renderAddress(result.contractAddress)
            renderSlots(result.takenSlotsCount, result.freeSlotsCount)
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