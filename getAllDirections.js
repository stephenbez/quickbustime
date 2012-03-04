var config = require("./config");
var bustime = require('./bustime').init(config.apiKey);
var _ = require('underscore');
var fs = require('fs');

var routeToRouteName = {};
var routeToDirections = {};

var routesToGet = [];

var numRequests = 0;
var maxRequests = 200;

bustime.request("getroutes", {}, function(result) {
    console.log(result);

    result.route.forEach(function(obj) {
        routeToRouteName[obj.rt] = obj.rtnm;
        routesToGet.push(obj.rt);
    });

    console.log(routeToRouteName);
    console.log(result.route.length);
    getDirections();
});

function getDirections() {
    var route = routesToGet.pop();

    if (route && numRequests < maxRequests) {
        bustime.request("getdirections", { rt: route}, function(result) {
            numRequests += 1;
            console.log(result);

            if (_.isArray(result.dir)) {
                routeToDirections[route] = result.dir;
            } else {
                routeToDirections[route] = [result.dir];
            }

            setTimeout(getDirections, 1000);
        });
    } else {
        console.log(routeToRouteName);
        console.log(routeToDirections);

        fs.writeFile("routeToRouteName.json", JSON.stringify(routeToRouteName, null, 4));
        fs.writeFile("routeToDirections.json", JSON.stringify(routeToDirections, null, 4));
    }
}