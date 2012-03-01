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

exports.init = function(apikey) {
    var host = "ctabustracker.com";
    var basePath = "/bustime/api/v1/";

    return {
        request: function(command, parameters, callback) {
            parameters.key = apikey;
            var path = basePath + command + "?" + querystring.stringify(parameters);

            var options = {
                host: host,
                path: path
            };

            httpGetWholeResponse(options, function(response) {
                var obj = parser.toJson(response, { object: true });
                callback(obj["bustime-response"]);
            });
        }
    }
};
