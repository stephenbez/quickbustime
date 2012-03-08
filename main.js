var util = require('util');
var express = require('express');
var _ = require('underscore');
var config = require("./config");
var bustime = require('./bustime').init(config.apiKey);
var log4js = require('log4js');
require("datejs");
var cronJob = require('cron').CronJob;

var fs = require('fs');
var isEmptyObject = require("jquery").isEmptyObject;

log4js.addAppender(log4js.fileAppender('/sitelogs/bustime.log'));
var logger = log4js.getLogger();

var banner =
    "\n______           _   _                \n| ___ \\         | | (_)               \n| |_\x2F \x2F_   _ ___| |_ _ _ __ ___   ___ \n| ___ \\ | | \x2F __| __| | \'_ ` _ \\ \x2F _ \\\n| |_\x2F \x2F |_| \\__ \\ |_| | | | | | |  __\x2F\n\\____\x2F \\__,_|___\x2F\\__|_|_| |_| |_|\\___|\n                                      \n";

logger.info(banner);

process.on('uncaughtException', function (err) {
    logger.error('Caught exception: ' + err +  err.stack);
});

function inspect(obj) {
    return util.inspect(obj, false, null);
}

// necessary because xml2json will sometimes return an array, othertimes just
// an object depending on if there are duplicate keys

function iterate(potentialCollection, callback) {
    if (_.isArray(potentialCollection)) {
        potentialCollection.forEach(callback);
    } else {
        callback(potentialCollection);
    }
}

String.format = function() {
  var s = arguments[0];
  for (var i = 0; i < arguments.length - 1; i++) {       
    var reg = new RegExp("\\{" + i + "\\}", "gm");             
    s = s.replace(reg, arguments[i + 1]);
  }

  return s;
};

var routeToRouteNameString = fs.readFileSync("routeToRouteName.json");
var routeToDirectionsString = fs.readFileSync("routeToDirections.json");
var logFile = fs.createWriteStream('/sitelogs/bustimeWeb.log', {flags: 'a'}); //use {flags: 'w'} to open in write mode

var app = express.createServer();

express.logger.token('localTime', function() {
    return new Date().toString("s");
});

app.use(express.logger({
    stream: logFile,
    format: ':req[X-Forwarded-For] - - [:localTime] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
}));

app.set('view options', { layout: false });

app.use('/static', express.static(__dirname + '/static'));

app.get('/robots.txt', function(req, res) {
    express.static(__dirname)(req, res);
});

app.get('/', function(req, res) {
    res.render('index.jade', {
        routeToRouteName: routeToRouteNameString,
        routeToDirections: routeToDirectionsString
    });
});

app.get('/getRequestsLeft', function(req, res) {
    var left = bustime.getRequestsLeft();
    res.send(left + " requests left");
    logger.info("Left", left);
});

app.get('/resetRequests', function(req, res) {
    bustime.resetRequests();
    var current = bustime.getRequestsLeft();
    res.send("Requests reseted. " + current + " requests left");
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

function isError(result) {
    return isEmptyObject(result) || result.error;
}

function handleErrors(req, res, result, message) {
    logger.error("url", req.url, "result", result, "message", message);
    res.render('error.jade', { message: message });
}

app.get('/r/:route?/:direction?', function(req, res) {
    var route = req.params.route;

    if (!route) {
        bustime.request("getroutes", {}, function(result) {
            logger.info("url: " + req.url + "\nresult: " + inspect(result));

            if (isError(result)) {
                handleErrors(req, res, result);
                return;
            }

            res.render('routes.jade', result);
        });
        return;
    }

    if (!req.params.direction) {
        bustime.request("getdirections", { rt: route }, function(result) {
            logger.info("url: " + req.url + "\nresult: " + inspect(result));
            
            if (isError(result)) {
                handleErrors(req, res, result, "Sorry that route doesn't exist");
                return;
            }

            var directions = [];
            iterate(result.dir, function(direction) {
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

            logger.info(context);
            res.render('directions.jade', context);
        });

        return;
    }

    var direction = getDirectionFromCode(req.params.direction);

    bustime.request("getstops", { rt: route, dir: direction }, function(result) {
        logger.info("url: " + req.url + "\nresult: " + inspect(result));

        if (isError(result)) {
            handleErrors(req, res, result, "Could not find any stops for " + route + " " + direction);
            return;
        }

        var stops = [];

        iterate(result.stop, function(stop) {
            stops.push({
                stopId: stop.stpid,
                stopName: stop.stpnm.replace("&", " & ")
            });
        });

        res.render('stops.jade', {
            routeNameAndDirection: route + " " + direction,
            stops: stops 
        });
    });

});

app.get('/s/:id', function(req, res) {
    bustime.request("getpredictions", { stpid: req.params.id }, function(result) {
        logger.info("url: " + req.url + "\nresult: " + inspect(result));

        if (isError(result)) {
            if (result.error && result.error.msg == "No service scheduled") {
                handleErrors(req, res, result, "No service scheduled for this stop at this time");
            } else {
                handleErrors(req, res, result, "Sorry that stop doesn't exist");
            }
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
        var predictions = [];

        var handleBus = function(bus) {
            stopName = bus.stpnm.replace("&", " & ");

            if (selectedRoute && (bus.rt !== selectedRoute)) return;

            var arrivalTime = parseCtaTimeString(bus.prdtm);
            var minutesAway = getMinutesAway(arrivalTime); 
            var arrivalTimeString = arrivalTime.toString("hh:mm tt");

            predictions.push({
                route: bus.rt,
                directionCode: bus.rtdir[0],
                destination: bus.des,
                minutesAway: minutesAway,
                arrivalTimeString: arrivalTimeString
            });
        };

        iterate(buses, handleBus);

        var selectedRouteName;
        var stopNameAndDirection = stopName;
        if (selectedRoute) {
            stopNameAndDirection += " (" + routeDirection + ")";
            selectedRouteName = selectedRouteName + " " + routeDirectionCode;
        }

        var context = {
            // don't include direction for now, since for a given stop there can be multiple directions 
            stopNameAndDirection: stopNameAndDirection,
            predictions: predictions,
            currentTime: getCurrentTimeString(),
            selectedRoute: selectedRoute || "all",
        };

        logger.info(context);

        res.render('buses.jade', context);
    });   
});

// Handle not found, always keep as last route
app.get("*", function(req, res) {
    handleErrors(req, res, {});
});

// at 11:59pm every night, reset requests
cronJob('0 59 23 * * *', function() {
    bustime.resetRequests();
    logger.info("Requests reset");
});

var port = 3000;
app.listen(3000);

logger.info("Open up a browser to localhost:" + port);