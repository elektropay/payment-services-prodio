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

	Ezpaymerchants.createMerchant = (userId, userInfo, cb) => {
          const { 
               user_id = '', 
               payees = {}, 
               billing = {} 
          } = userInfo;
          print(payees);
          //TODO : Integrating actual Payment Gateway API

          Ezpaymerchants.findOne({where: {"userId":userId}}).then(user => {

               if(isValidObject(user)){
                    return cb(new HttpErrors.NotFound('user already exist', { expose: false }));
               }else{
               		let saveMerchant = {
               			"userId": userId,
               			"paymentGateway":"CAYAN",
               			"isActive": true,
               			"createdAt": new Date(),
               			"updatedAt": new Date()
               		};
               		
               		Ezpaymerchants.create(saveMerchant).then(merchantObj => {
                          return cb(null, merchantObj);
                     }).catch(error => {
                          print(error);
                          return cb(new HttpErrors.InternalServerError('Db connection failed', { expose: false }));
                     });
               }
               
          }).catch(error => {
               print(error);
               return cb(new HttpErrors.InternalServerError('Db connection failed', { expose: false }));
          });
    }

};
