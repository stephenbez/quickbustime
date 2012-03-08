var nodemailer = require("nodemailer");
var config = require("./config");
var log4js = require('log4js');
var logger = log4js.getLogger("email");

var smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
        user: config.gmailAddress,
        pass: config.gmailPassword
    }
});

exports.sendEmail = function(subject, body) {
    smtpTransport.sendMail({
        from: config.gmailAddress,
        to: config.toAddress,
        subject: subject,
        text: body
    }, function(err, res) {
        if (err) {
            logger.error(err);
        } else {
            logger.info("Message sent: " + res.message);
        }

        smtpTransport.close(); // shut down the connection pool, no more messages
    });
};
