var fs = require('fs');

var stopIdToStopName = {};

var stopsCsv = fs.readFileSync("etc/stops.txt", "utf8");

var lines = stopsCsv.split("\n");

// Remove first header row
lines.shift();

lines.forEach(function(line) {
    if (line) {
        var split = line.split(",");
        var stopId = split[0];
        var stopName = split[2];
        stopName = stopName.replace(/"/g, '');

        stopIdToStopName[stopId] = stopName;
    }
});

var numStopsLoaded = Object.keys(stopIdToStopName).length;
console.log("Loaded " + numStopsLoaded + " stops");

if (numStopsLoaded == 0) {
    throw "No loaded stops!";
}

module.exports = stopIdToStopName;