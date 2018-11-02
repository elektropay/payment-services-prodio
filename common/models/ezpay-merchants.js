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
let async = require('async');

const notificationSdk = require('notification-service-sdk-prodio');
let payload = {};
let url = "";
const notificationApi  = new notificationSdk(payload,url);


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
               basic = {},
               payees = {}, 
               billing = {} 
          } = userInfo;
          print(payees);
          //TODO : Integrating actual Payment Gateway API

          Ezpaymerchants.findOne({where: {"userId":userId}}).then(user => {

               if(isValidObject(user)){
               		funAddUpdatePayees(payees,user["id"]);
                    return cb(new HttpErrors.NotFound('user already exist', { expose: false }));
               }else{
               		let saveMerchant = {
               			"userId": userId,
               			"paymentGateway":"CAYAN",
               			"userInfo": userInfo,
               			"isActive": true,
               			"createdAt": new Date(),
               			"updatedAt": new Date()
               		};
               		 
               		Ezpaymerchants.create(saveMerchant).then(merchantObj => {
               			funAddUpdatePayees(payees,merchantObj["id"]);
               			funSendWelcomeEmail(merchantObj["id"],basic);
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

    function funSendWelcomeEmail(merchantId,createdUser){
    	const meta_info = {
            "name":createdUser.firstName+" "+createdUser.lastName,
            "email":createdUser.email
        }
        const payload = {
            "userId":merchantId,
            "meta_info":meta_info,
            "EVENT_NAME":"CREAT_USER"
        }
        const baseUrl = `https://47ha2doy85.execute-api.us-east-1.amazonaws.com/dev/`;

        let createdUserData = notificationApi.createUser(payload,baseUrl);
    }

    function funAddUpdatePayees(payees,merchantId){
    	if(payees.length){
    		async.each(payees,function(payeeInfo,clb){
    			let savePayee = {
    				"firstName": isValid(payeeInfo["firstName"])?payeeInfo["firstName"]:"",
    				"lastName": isValid(payeeInfo["lastName"])?payeeInfo["lastName"]:"",
    				"email": isValid(payeeInfo["email"])?String(payeeInfo["email"]).toLowerCase():"",
    				"mobileNumber": isValid(payeeInfo["mobileNumber"])?payeeInfo["mobileNumber"]:"",
    				"merchantId": merchantId,
    				"isActive": true,
    				"createdAt": new Date(),
    				"updatedAt": new Date()
    			};

    			Ezpaymerchants.app.models.ezpayPayees.findOne({where: {"email":savePayee["email"]}}).then(payeeData => {
    				 if(isValidObject(payeeData)){
    				 	clb();
                    	//return cb(new HttpErrors.NotFound('user already exist', { expose: false }));
		             }else{
		             	Ezpaymerchants.app.models.ezpayPayees.create(savePayee).then(payeeObj => {
	               			//return cb(null, merchantObj);
	               			clb();
	                    }).catch(error => {
	                        print(error);
	                        clb();
	                          //return cb(new HttpErrors.InternalServerError('Db connection failed', { expose: false }));
	                    });
		             }
    			}).catch(error => {
    				clb();
		            print(error);
		               //return cb(new HttpErrors.InternalServerError('Db connection failed', { expose: false }));
		        });
    		},function(){
    			print("all payee added..");
    		});
    	}else{
    		print("no payee data available");
    	}
    }


    Ezpaymerchants.remoteMethod(
          'getPayeesListing', {
               http: {
                    path: '/getPayees/:merchantId',
                    verb: 'post'
               },
               description: ["It will return the list of payees added by the merchant."],
               accepts: [{
                    arg: 'merchantId',
                    type: 'string',
                    required: true,
                    http: {
                         source: 'path'
                    }
               }],
               returns: {
                    type: 'array',
                    root: true
               }
          }
     );


    Ezpaymerchants.getPayeesListing = (merchantId, cb) => {
    	Ezpaymerchants.app.models.ezpayPayees.find({where: {"merchantId":merchantId}}).then(payees => {
			 print(payees);
			 if(isValidObject(payees)){
			 	return cb(null, payees);
             }else{
             	return cb(null, payees);
             }
		}).catch(error => {
            return cb(new HttpErrors.InternalServerError('Db connection failed', { expose: false }));
        });
    }

};
