var querystring = require("querystring");
var http = require('http');
var parser = require('xml2json');

function httpGetWholeResponse(options, callback) {
    http.get(options, function(res) {
        var wholeResponse = "";
        res.on('data', function(chunk) {
            wholeResponse += chunk;
        });

        res.on('end', function() {
            callback(wholeResponse);
        });
    });
}

var startingRequests = 4000;

exports.init = function(apikey) {
    var host = "ctabustracker.com";
    var basePath = "/bustime/api/v1/";
    var requests = startingRequests;

    return {
        request: function(command, parameters, callback) {
            requests -= 1;

            if (requests <= 0) {
                callback({ error: "Too many requests" });
                return;
            }
 
            parameters.key = apikey;
            var path = basePath + command + "?" + querystring.stringify(parameters);

            var options = {
                host: host,
                path: path
            };

            httpGetWholeResponse(options, function(response) {
                var obj = parser.toJson(response, { object: true, sanitize: true});
                callback(obj["bustime-response"]);
            });
        },

        resetRequests: function() {
            requests = startingRequests;
        },

        getRequestsLeft: function() {
            return requests;
        },

        startingRequests: function() {
            return startingRequests;
        }
    }
};
