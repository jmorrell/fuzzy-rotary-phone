const gc = (require('gc-stats'))();
const request = require('request');

// pauseNS is the cumulative GC pause of the node program between GC runs.
// This is reset every metrics submission run.
let pauseNS = 0;

// usedHeapSize is the number of bytes in the heap that are actively being used.
let usedHeapSize = 0;

// totalHeapSize is the total number of bytes in the heap.
let totalHeapSize = 0;

// heapSizeLimit is the maximum size of the heap.
let heapSizeLimit = 0;

// gcCount is the number of garbage collections that have been observed between
// metrics runs. This is reset every metrics submission run.
let gcCount = 0;

// metricsURL is where the runtime metrics will be posted to. This is added
// to dynos by runtime iff the app is opped into the heroku runtime metrics
// beta.
const metricsURL = process.env.HEROKU_METRICS_URL;

// metricsInterval is the amount of time between metrics submissions.
const metricsInterval = 20000; // 20 seconds

// on every garbage collection, update the statistics.
gc.on('stats', function (stats) {
    gcCount++;

    pauseNS = pauseNS + stats.pause;
    usedHeapSize = stats.after.usedHeapSize;
    totalHeapSize = stats.after.totalHeapSize;
    heapSizeLimit = stats.after.heapSizeLimit;
});

// every 20 seconds, submit a metrics payload to metricsURL.
setInterval(function() {
    // the metrics data collected above.
    data = {
        counters: {
            "node.gc.collections": gcCount,
            "node.gc.pause.ns": pauseNS
        },
        gauges: {
            "node.heap.inuse.bytes": usedHeapSize,
            "node.heap.total.bytes": totalHeapSize,
            "node.heap.limit.bytes": heapSizeLimit
        }
    };

    // post data to metricsURL
    options = {
        method: "POST",
        uri: metricsURL,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
        timeout: 100 // at max stops customer app for 100 ms
    };

    let cb = function(error, resp, body) {
        if (error != null) {
            console.log("[fuzzy-rotary-phone] error when trying to submit data: ", error);
            return;
        }

        if (resp.statusCode != 200) {
            console.log("[fuzzy-rotary-phone] expected 200 when trying to submit data, got:", resp.statusCode);
            console.log("[fuzzy-rotary-phone] body:", body);
            return;
        }
    };

    request(options, cb);

    pauseNS = 0;
    gcCount = 0;
}, 20000); // 20 seconds
