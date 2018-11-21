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

let payload = {};
let url = "";

// After installing the below module, create folder "services" inside "server" folder and
// create paymentsources.json file.

const {Service} = require('service-adapter-prodio');
const paymentAdapter = new Service('payment');
paymentAdapter.init();


const isNull = function (val) {
  if (typeof val === 'string') { val = val.trim(); }
  if (val === undefined || val === null || typeof val === 'undefined' || val === '' || val === 'undefined') {
    return true;
  }
  return false;
};

module.exports = function(Ezpaymerchants) {

    Ezpaymerchants.remoteMethod(
        'testMerchant', {
            http: {
                verb: 'post'
            },
            description: ["It will register the subscriber as merchant into payment gateway."],
            accepts: [
                {
                    arg: 'userInfo',
                    type: 'object',
                    required: true,
                    http: {
                        source: 'body'
                    }
                }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.testMerchant = ( userInfo, cb) => {
        const paymentClass = require('payment-module-prodio');
        const paymentObj = new paymentClass();

        const  payload = {
                "action": "CREATE_MERCHANT", /*(required)*/
                "meta": {
                    "userId":"bb15dc52-86e2-45c0-b5ab-889aebf7a1d6", /*(required)*/
                    "basic": {
                        "firstName": "Shashikant",
                        "lastName": "Sharma",
                        "email": "shashikant@prodio.in",
                        "password": "shashikant23",
                        "mobileNumber": "8097487977",
                        "dateOfBirth": "MM-DD-YYYY",
                        "ssn": ""
                    },
                    "business": {
                        "businessName": "BeingExpert Inc.",
                        "dbaName": "BeingExpert Inc.",
                        "taxId": "",
                        "contactEmail": "shashikant@prodio.in",
                        "contactNumber": "8097487977",
                        "addressSameAsUser": "true",
                        "address": {
                            "country": "",
                            "state": "",
                            "city": "",
                            "streetAddress": "",
                            "zipCode": ""
                        }
                    },
                    "billing": {
                        "cardHolderName": "Shashikant Sharma",
                        "creditCardNo": "4356234589794567",
                        "expiryDate": "12/2020",
                        "cvv": "345",
                        "saveCard": "false",
                        "addressSameAsBusiness": "false",
                        "address": {
                            "country": "",
                            "state": "",
                            "city": "",
                            "streetAddress": "",
                            "zipCode": ""
                        }
                    },
                    "payees": [{
                            "firstName": "Pawan",
                            "lastName": "Wagh",
                            "email": "pawan@prodio.in",
                            "mobileNumber": "12312443222",
                            "address": "test address",
                            "paymentMethod": "CREDIT_CARD"
                        },
                        {
                            "firstName": "Anurag",
                            "lastName": "Tiwari",
                            "email": "anurag@prodio.in",
                            "mobileNumber": "12312443222",
                            "address": "test address",
                            "paymentMethod": "CREDIT_CARD"
                        },
                        {
                            "firstName": "Vatsal",
                            "lastName": "Shah",
                            "email": "vatsal@prodio.in",
                            "mobileNumber": "123893222",
                            "address": "test address",
                            "paymentMethod": "CREDIT_CARD"
                        }
                    ]
                }
            };

        paymentObj.execute(payload, function (response) {
            if (!isNull(response.data.error.message)) {
                //Error
                //cb(null,response.response.data.error.message);
                cb(new HttpErrors.InternalServerError(response.data.error.message, {
                    expose: false
                }));
            } else {
                cb(null,response.data);
            }
        });
    }



    Ezpaymerchants.remoteMethod(
        'createMerchant', {
            http: {
                verb: 'post'
            },
            description: ["It will register the subscriber as merchant into payment gateway."],
            accepts: [{
                    arg: 'userId',
                    type: 'string',
                    required: true,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'userInfo',
                    type: 'object',
                    required: true,
                    http: {
                        source: 'body'
                    }
                }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.createMerchant = (userId, userInfo, cb) => {


        let payloadJson = userInfo;
        if(!isNull(userInfo["meta"])){
            payloadJson = userInfo["meta"];
        }

        let resInfo = paymentAdapter.createMerchant(payloadJson);

        const {
                user_id = "",
                basic = {},
                business = {},
                payees = {},
                billing = {}
        } = payloadJson;
        //print("23123412");
        //TODO : Integrating actual Payment Gateway API

        Ezpaymerchants.findOne({
            where: {
                "userId": userId
            }
        }).then(user => {

            if (isValidObject(user)) {
                funAddUpdatePayees(payees, user["merchantId"]);
                return cb(new HttpErrors.NotFound('user already exist', { expose: false }));
            } else {
                let saveMerchant = {
                    "userId": userId,
                    "paymentGateway": "INTEGRITY",
                    "userInfo": basic,
                    "businessInfo": business,
                    "billingInfo": billing,
                    "isActive": true,
                    "isApprovedByGateway":false,
                    "isDeleted": false,
                    "createdAt": new Date(),
                    "updatedAt": new Date()
                };

                Ezpaymerchants.create(saveMerchant).then(merchantObj => {
                    funAddUpdatePayees(payees, merchantObj["id"]);
                    return cb(null, merchantObj);
                }).catch(error => {
                    print(error);
                    return cb(new HttpErrors.InternalServerError('Db connection failed', {
                        expose: false
                    }));
                });
            }

        }).catch(error => {
            print(error);
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                expose: false
            }));
        });
    }

    function funAddUpdatePayees(payees, merchantId) {
        if (payees.length) {
            async.each(payees, function(payeeInfo, clb) {
                let savePayee = {
                    "firstName": isValid(payeeInfo["firstName"]) ? payeeInfo["firstName"] : "",
                    "lastName": isValid(payeeInfo["lastName"]) ? payeeInfo["lastName"] : "",
                    "email": isValid(payeeInfo["email"]) ? String(payeeInfo["email"]).toLowerCase() : "",
                    "mobileNumber": isValid(payeeInfo["mobileNumber"]) ? payeeInfo["mobileNumber"] : "",
                    "address": isValid(payeeInfo["address"]) ? payeeInfo["address"] : "",
                    "paymentMethod": isValid(payeeInfo["paymentMethod"]) ? payeeInfo["paymentMethod"] : "",
                    "isActive": true,
                    "createdAt": new Date(),
                    "updatedAt": new Date()
                };

                Ezpaymerchants.app.models.ezpayPayees.findOne({
                    where: {
                        "email": savePayee["email"]
                    }
                }).then(payeeData => {
                    if (isValidObject(payeeData)) {
                        clb();
                        funCreateMerchantPayeeRelation(merchantId,payeeData["payeeId"]);
                        //return cb(new HttpErrors.NotFound('user already exist', { expose: false }));
                    } else {
                        Ezpaymerchants.app.models.ezpayPayees.create(savePayee).then(payeeObj => {
                            //return cb(null, merchantObj);
                            funCreateMerchantPayeeRelation(merchantId,payeeObj["payeeId"]);
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
            }, function() {
                print("all payee added..");
            });
        } else {
            print("no payee data available");
        }
    }


    function funCreateMerchantPayeeRelation(merchantId,payeeId){
        Ezpaymerchants.app.models.merchantPayeesRelation.findOne({
              where: {
                  "merchantId": merchantId,"payeeId": payeeId
              }
          }).then(payeeData => {
              if (isValidObject(payeeData)) {

              }else{

                let savePayee = {
                    "merchantId": merchantId,
                    "payeeId":payeeId,
                    "isActive":true,
                    "createdAt": new Date(),
                };

                Ezpaymerchants.app.models.merchantPayeesRelation.create(savePayee).then(payeeObj => {
                    //return cb(null, merchantObj);
                }).catch(error => {
                    print(error);
                    //return cb(new HttpErrors.InternalServerError('Db connection failed', { expose: false }));
                });

              }
          }).catch(error => {
              clb();
              print(error);
              //return cb(new HttpErrors.InternalServerError('Db connection failed', { expose: false }));
          });
    }


    Ezpaymerchants.remoteMethod(
        'getPayeesListing', {
            http: {
                verb: 'post'
            },
            description: ["It will return the list of payees added by the merchant."],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true
            }],
            returns: {
                type: 'array',
                root: true
            }
        }
    );


    Ezpaymerchants.getPayeesListing = (merchantId, cb) => {
        Ezpaymerchants.app.models.merchantPayeesRelation.find({
           include:[{relation:'Payee'}],
            where: {"merchantId": merchantId,"isActive":true},
        }).then(payees => {
            //print(payees);
            if (isValidObject(payees)) {
                return cb(null, payees);
            } else {
                return cb(null, payees);
            }
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                expose: false
            }));
        });
    }


    Ezpaymerchants.remoteMethod(
        'getMerchantActivationStatus', {
            http: {
                verb: 'post'
            },
            description: ["It will return the merchant activation status as per payment gateway."],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.getMerchantActivationStatus = (merchantId, cb) => {
        Ezpaymerchants.findById(merchantId).then(merchantInfo => {
            
            if (isValidObject(merchantInfo)) {
                return cb(null, {"activationStatus": merchantInfo["isApprovedByGateway"] });
            } else {
                return cb(null, {"activationStatus":false});
            }
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                expose: false
            }));
        });
    }

    Ezpaymerchants.remoteMethod(
        'getMerchantProfile', {
            http: {
                verb: 'post'
            },
            description: ["It will return merchant basic details"],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.getMerchantProfile = (merchantId, cb) => {
        Ezpaymerchants.findById(merchantId).then(merchantInfo => {
            
            if (isValidObject(merchantInfo)) {
                return cb(null, merchantInfo);
            } else {
                return cb(null, merchantInfo);
            }
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                expose: false
            }));
        });
    }

    Ezpaymerchants.remoteMethod(
        'deactivateMerchant', {
            http: {
                verb: 'post'
            },
            description: ["It will deactivate the given merchant account."],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.deactivateMerchant = (merchantId, cb) => {
        Ezpaymerchants.findById(merchantId).then(merchantInfo => {
            
            if (isValidObject(merchantInfo)) {
                
                merchantInfo.updateAttributes({"isActive":false},function(err,res){
                  if(err){
                    return cb(new HttpErrors.InternalServerError('Db connection failed', {
                        expose: false
                    }));
                  }else{
                    cb(null,{"success":true});
                  }
                });
            } else {
                return cb(new HttpErrors.InternalServerError('Invalid merchant id.', {
                    expose: false
                }));
            }
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                expose: false
            }));
        });
    }


    Ezpaymerchants.remoteMethod(
        'removeMerchant', {
            http: {
                verb: 'post'
            },
            description: ["It will remove the given merchant account from payment gateway."],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.removeMerchant = (merchantId, cb) => {
        Ezpaymerchants.findById(merchantId).then(merchantInfo => {
            
            if (isValidObject(merchantInfo)) {
                
                merchantInfo.updateAttributes({"isDeleted":true},function(err,res){
                  if(err){
                    return cb(new HttpErrors.InternalServerError('Db connection failed', {
                        expose: false
                    }));
                  }else{
                    cb(null,{"success":true});
                  }
                });
            } else {
                return cb(new HttpErrors.InternalServerError('Invalid merchant id.', {
                    expose: false
                }));
            }
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                expose: false
            }));
        });
    }


    Ezpaymerchants.remoteMethod(
        'getMerchantFromUserId', {
            http: {
                verb: 'post'
            },
            description: ["It will fetch merchant info from user id."],
            accepts: [{
                arg: 'userId',
                type: 'string',
                required: true
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.getMerchantFromUserId = (userId, cb) => {
        Ezpaymerchants.findOne({
            where: {
                "userId": userId
            }
        }).then(user => {
             if (isValidObject(user)) {
                cb(null,user);
            } else {
                return cb(new HttpErrors.NotFound('User id does not exists', { expose: false }));
            }
        }).catch(error=>{
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                        expose: false
                    }));
        });
    }



};