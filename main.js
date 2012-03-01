var http = require('http');
var parser = require('xml2json');
var util = require('util');
var express = require('express');
var _ = require('underscore');
var config = require("./config");
var bustime = require('./bustime').init(config.apiKey);
require("datejs");

function superLog() {
    console.log(util.inspect(arguments, false, null));
};

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
    var diff = new Date(arrivalTime - now);
    return diff.getMinutes();
}

function getDirectionFromCode(code) {
    if (code == "N") return "North Bound";
    if (code == "S") return "South Bound";
    if (code == "E") return "East Bound";
    if (code == "W") return "West Bound";
}

app.get('/r/:route?/:direction?', function(req, res) {
    var route = req.params.route

    if (!route) {
        bustime.request("getroutes", {}, function(result) {
            console.log(result);

            if (result.error) {
                handleErrors(res);
                return;
            }

            res.render('routes.handlebars', result);
        });
        return;
    }

    if (!req.params.direction) {
        bustime.request("getdirections", { rt: route }, function(result) {
            superLog(result);
            
            if (result.error) {
                handleErrors(res);
                return;
            }

            var directions = [];
            result.dir.forEach(function(direction) {
                directions.push({
                    route: route,
                    stopDirection: direction[0],
                    directionName: route + " " + direction
                });
            });

            var context = {
                routeName: route,
                directions: directions
            };

            console.log(context);
            res.render('directions.handlebars', context);
        });

        return;
    }

    var direction = getDirectionFromCode(req.params.direction);

    bustime.request("getstops", { rt: route, dir: direction }, function(result) {
        superLog(result);

        if (result.error) {
            handleErrors(res);
            return;
        }

        var stops = [];

        _.forEach(result.stop, function(stop) {
            stops.push({
                stopId: stop.stpid,
                stopName: stop.stpnm.replace("&", " & ")
            });
        });

        res.render('stops.handlebars', {
            routeNameAndDirection: route + " " + direction,
            stops: stops 
        });
    });

});

function handleErrors(res) {
    res.render('error.handlebars');
}

app.get('/s/:id', function(req, res) {
    bustime.request("getpredictions", { stpid: req.params.id }, function(result) {
        superLog(result);

        if (result.error) {
            handleErrors(res);
            return;
        }

        var buses = result.prd;

        if (req.query.rt) {
            var split = req.query.rt.split("_");
            var selectedRoute = split[0];
            var routeDirectionCode = split[1];
            var routeDirection = getDirectionFromCode(split[1]);
        }

        var stopName = "";
        var lines = [];

        var handleBus = function(bus) {
            stopName = bus.stpnm.replace("&", " & ");

            if (selectedRoute && (bus.rt !== selectedRoute)) return;

            var arrivalTime = parseCtaTimeString(bus.prdtm);
            var minutesAway = getMinutesAway(arrivalTime); 
            var arrivalTimeString = arrivalTime.toString("hh:mm tt");

            lines.push(String.format("#{0} {1} to {2}, {3} min, {4}", bus.rt,
                bus.rtdir[0], bus.des, minutesAway, arrivalTimeString));
        };

        if (_.isArray(buses)) {
            _.forEach(buses, handleBus);           
        } else {
            handleBus(buses);
        }

        var selectedRouteName;
        var stopNameAndDirection = stopName;
        if (selectedRoute) {
            stopNameAndDirection += " (" + routeDirection + ")";
            selectedRouteName = selectedRouteName + " " + routeDirectionCode;
        }

        var context = {
            // don't include direction for now, since for a given stop there can be multiple directions 
            stopNameAndDirection: stopNameAndDirection,
            predictions: lines,
            currentTime: getCurrentTimeString(),
            selectedRoute: selectedRoute || "all",
        };

        console.log(context);

        res.render('buses.handlebars', context);
    });   
});

// Handle not found, always keep as last route
app.get("*", function(req, res) {
    handleErrors(res);
});

var port = 3000;
app.listen(3000);

console.log("Open up a browser to localhost:" + port); 
