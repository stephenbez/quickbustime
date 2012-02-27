var http = require('http');
var parser = require('xml2json');
var util = require('util');
var express = require('express');
var _ = require('underscore');
var config = require("./config");
var bustime = require('./bustime').init(config.apiKey);
require("datejs");

String.format = function() {
  var s = arguments[0];
  for (var i = 0; i < arguments.length - 1; i++) {       
    var reg = new RegExp("\\{" + i + "\\}", "gm");             
    s = s.replace(reg, arguments[i + 1]);
  }

  return s;
}

var app = express.createServer();

app.set('view options', { layout: false });

app.get('/', function(req, res) {
    res.render('index.handlebars');
});

function getCurrentTimeString() {
   return new Date().toString("hh:mm tt"); 
}

function parseCtaTimeString(timeString) {
    var d = Date.parseExact(timeString, "yyyyMMdd HH:mm");

    return d;
}

function getMinutesAway(arrivalTime) {
    var now = new Date(new Date().setSeconds(0,0));

    console.log("diff", now, arrivalTime);

    var diff = new Date(arrivalTime - now);

    console.log(diff);

    return diff.getMinutes();
}

app.get('/s/:id', function(req, res) {
    bustime.request("getpredictions", { stpid: req.params.id }, function(result) {
        var stringResult = util.inspect(result, false, null);
        console.log(stringResult);        
// TODO: check for errors

        var buses = result["bustime-response"].prd;

        var stopName = "";
        var routeDirection = "";
        var lines = [];

        var handleBus = function(bus) {
            stopName = bus.stpnm;
            routeDirection = bus.rtdir;

            var arrivalTime = parseCtaTimeString(bus.prdtm);
            var minutesAway = getMinutesAway(arrivalTime); 
            var arrivalTimeString = arrivalTime.toString("hh:mm tt");

            lines.push(String.format("#{0} to {1}, {2} min, {3}", bus.rt, bus.des, minutesAway, arrivalTimeString));
        };

        if (_.isArray(buses)) {
            _.forEach(buses, handleBus);           
        } else {
            handleBus(buses);
        }

        var context = {
            stopNameAndDirection: stopName + " " + routeDirection,
            predictions: lines,
            currentTime: getCurrentTimeString()
        };

        console.log(context);

        res.render('buses.handlebars', context);
    });   
});

var port = 3000;
app.listen(3000);

console.log("Open up a browser to localhost:" + port + "/s/<stop id>");
