'use strict';
const HttpErrors = require('http-errors');
const { 
     findReplace, 
     unique, 
     isValidObject, 
     isValid, 
     flattenArray,
     clean,
     isArray,
     isObject,
     print,
} = require('../../utility/helper');

module.exports = function(Ezpaymerchants) {
	const enabledRemoteMethods = ["prototype.replaceAttributes"];

	Ezpaymerchants.sharedClass.methods().forEach(method => {
		const methodName = method.stringName.replace(/.*?(?=\.)/, '').substr(1);
		if (enabledRemoteMethods.indexOf(methodName) === -1) {
		  Ezpaymerchants.disableRemoteMethodByName(methodName);
		}
	});

	Ezpaymerchants.remoteMethod(
          'createMerchant', {
               http: {
                    path: '/createMerchant/:userId',
                    verb: 'post'
               },
               description: ["It will register the subscriber as merchant into payment gateway."],
               accepts: [{
                    arg: 'userId',
                    type: 'string',
                    required: true,
                    http: {
                         source: 'path'
                    }
               },{
                    arg: 'userInfo',
                    type: 'object',
                    required: true,
                    http: {
                         source: 'body'
                    }
               }],
               returns: {
                    type: 'object',
                    root: true
               }
          }
     );

	Ezpaymerchants.sendPushNotification = (userId, userInfo, cb) => {
          const { 
               user_id = '', 
               props = {}, 
               payload = {} 
          } = req;
          print(req);
          cb(null,{"status":1});
    }

};
