const ETH_BASE = 1000000000000000000;

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

function renderChart(slotPrice, bidPrice) {
    var ctx = document.getElementById('bids').getContext('2d')
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Slot Price',
                    data: slotPrice,
                    borderColor: 'rgb(6, 62, 136)',
                    fill: false,
                    pointRadius: 2
                },
                {
                    type: 'bubble',
                    label: 'Bid Price',
                    data: bidPrice,
                    borderColor: 'rgb(96, 64, 142)',
                    fill: false
                }
            ]
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
                    type: 'logarithmic',
                    ticks: {
                        callback: function (value, index, values) {
                            if (index % 5 === 0) {
                                return (value / ETH_BASE).toFixed(2) + ' ETH'
                            }
                            else {
                                return ''
                            }
                        }
                    }
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
                        return [`Bid value: ${(point.bidValue / ETH_BASE).toFixed(3)} ETH`, `Slot price: ${(point.slotPrice / ETH_BASE).toFixed(3)} ETH`]
                    }
                }
            }
        }
    })
    Chart.plugins.register({
        afterDatasetsDraw: function (chart) {
            if (chart.tooltip._active && chart.tooltip._active.length) {
                var activePoint1 = chart.active[0],
                    activePoint2 = chart.active[1],
                    ctx = chart.ctx,
                    x = activePoint1.tooltipPosition().x,
                    topY = activePoint1._view.y,
                    bottomY = activePoint2._view.y;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x, topY);
                ctx.lineTo(x, bottomY);
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#07C';
                ctx.stroke();
                ctx.restore();
            }
        }
    });
}

function getAuctionData() {
    // TODO: Change URL
    $.ajax({
        url: 'http://localhost:8090/auction-summary',
        success: function (result) {
            $('#loading-message').html('')
            var bidPrice = []
            var slotPrice = []
            for (const bid of result.bids) {
                bidPrice.push({ address: bid.bidder, bidValue: parseInt(bid.bidValue, 16), slotPrice: parseInt(bid.slotPrice, 16), y: parseInt(bid.bidValue, 16), x: bid.timestamp * 1000 })
                slotPrice.push({ address: bid.bidder, bidValue: parseInt(bid.bidValue, 16), slotPrice: parseInt(bid.slotPrice, 16), y: parseInt(bid.slotPrice, 16), x: bid.timestamp * 1000 })
            }
            if (result.remainingSeconds < 0) {
                $('#loading-message').html('Auction hasn\'t started yet.')
                return
            }
            renderChart(slotPrice, bidPrice)
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