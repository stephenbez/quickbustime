var maxPerPeriod = 3;
var timePeriodSecs = 60;

var commandsRun = 0;

setInterval(function() {
    commandsRun = 0;
}, timePeriodSecs * 1000);

exports.tryRunCommand = function(command) {
    commandsRun += 1;

    if (commandsRun <= maxPerPeriod) {
        command();
        return true;
    } else {
        return false
    }
};