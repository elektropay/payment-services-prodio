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

const {paymentAdapter} = require('../../server/moduleImporter');


const isNull = function(val) {
    if (typeof val === 'string') {
        val = val.trim();
    }
    if (val === undefined || val === null || typeof val === 'undefined' || val === '' || val === 'undefined') {
        return true;
    }
    return false;
};

const convertObjectIdToString = function(objectID) {
    return objectID.toString().substring(0,8);
};

module.exports = function(Ezpaymerchants) {

    Ezpaymerchants.remoteMethod(
        'testMerchant', {
            http: {
                verb: 'post'
            },
            description: ["It will register the subscriber as merchant into payment gateway."],
            accepts: [{
                arg: 'userID',
                type: 'string',
                required: false,
                http: {
                    source: 'query'
                }
            }],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.testMerchant = (userID, cb) => {
        const paymentClass = require('payment-module-prodio');
        const paymentObj = new paymentClass('http://app.ezpay-dental.com:3010/api/');
        let payload = {
                "action": "GET_MERCHANTS_OF_PAYER",
                "meta":{
                    "payerId":"99018cdb-4627-4900-803c-07bb7401d056"
                }
            };

        paymentObj.execute(payload, function(response) {
            if(typeof response == "string" || typeof response === "string"){
            	response = JSON.parse(response);
            }

            console.log(response);
            
            if (!isNull(response.data)) {
            	let serverResponse = response["data"];
        		if(typeof serverResponse == "string" || typeof serverResponse === "string"){
        			serverResponse = JSON.parse(response["data"]);
        		}

                if (!isNull(serverResponse.error)) {
                    //Error
                    //cb(null,response.response.data.error.message);
                    cb(new HttpErrors.InternalServerError(response.data.error.message, {
                        expose: false
                    }));
                } else {
                    cb(null, response.data);
                }
            } else {
            	if (!isNull(response["response"])) {
            		let serverResponse = response["response"]["data"];
            		if(typeof serverResponse == "string" || typeof serverResponse === "string"){
            			serverResponse = JSON.parse(response["response"]["data"]);
            		}

            		let serverResponseError = serverResponse["error"];
            		if(typeof serverResponseError == "string" || typeof serverResponseError === "string"){
            			serverResponseError = JSON.parse(serverResponseError["error"]);
            		}

            		let _msg = isNull(serverResponseError["message"]) ? 'Internal Server Error' : serverResponseError["message"];
	                cb(new HttpErrors.InternalServerError(_msg, {
	                    expose: false
	                }));
            	}else{
	                let _msg = isNull(response["data"]["message"]) ? 'Internal Server Error' : response["data"]["message"];
	                cb(new HttpErrors.InternalServerError(_msg, {
	                    expose: false
	                }));
	            }
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

    async function createMerchantPG(payload) {
        return await paymentAdapter.createMerchant(payload);
    }

    Ezpaymerchants.createMerchant = (userId, userInfo, cb) => {
        let payloadJson = userInfo;
        if (!isNull(userInfo["meta"])) {
            payloadJson = userInfo["meta"];
        }
        try {
            const {
                user_id = "",
                basic = {},
                business = {},
                payees = {},
                billing = {}
            } = payloadJson;
            //console.log("payees==>"+JSON.stringify(payees));
            //TODO : Integrating actual Payment Gateway API

            Ezpaymerchants.findOne({
                where: {
                    "userId": convertObjectIdToString(userId)
                }
            }).then(user => {
                if (isValidObject(user)) {
                    funAddUpdatePayees(payees, user["merchantId"]);
                    const err = new HttpErrors.NotFound('user already exist', {
                        expose: false
                    });
                    cb(err);

                } else {
                    createMerchantPG(payloadJson).then(sdkResponse => {
                        //paymentAdapter.createMerchant(payloadJson, function (sdkResponse) {
                        let resInfo = sdkResponse;

                        let saveMerchant = {
                            "userId": convertObjectIdToString(userId),
                            "paymentGateway": "INTEGRITY",
                            "userInfo": basic,
                            "businessInfo": business,
                            "billingInfo": billing,
                            "gatewayMerchantInfo":resInfo["body"],
                            "gatewayMerchantId":resInfo["body"]["merchant"]["mid"],
                            "isActive": true,
                            "isApprovedByGateway": false,
                            "isDeleted": false,
                            "createdAt": new Date(),
                            "updatedAt": new Date()
                        };

                        Ezpaymerchants.create(saveMerchant).then(merchantObj => {
                            funAddUpdatePayees(payees, merchantObj["id"]);
                            const rr = {
                                "merchantId": merchantObj["id"],
                                "data": resInfo["body"],
                            };
                            return cb(null, rr);
                        }).catch(error => {
                            let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                            const err = new HttpErrors.InternalServerError(_msg, {
                                expose: false
                            });
                            return cb(err);
                        });
                    }).catch(error => {
                        console.error(error);
                        let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                        cb(new HttpErrors.InternalServerError(_msg, {
                            expose: false
                        }));
                    })
                }

            }).catch(error => {
                let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                const err = new HttpErrors.InternalServerError(_msg, {
                    expose: false
                });
                return cb(err);
            });

        } catch (error) {
            let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
            cb(new HttpErrors.InternalServerError(_msg, {
                expose: false
            }));
        }
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
                        funCreateMerchantPayeeRelation(merchantId, payeeData["payeeId"]);
                        //return cb(new HttpErrors.NotFound('user already exist', { expose: false }));
                    } else {
                        Ezpaymerchants.app.models.ezpayPayees.create(savePayee).then(payeeObj => {
                            //return cb(null, merchantObj);
                            funCreateMerchantPayeeRelation(merchantId, payeeObj["payeeId"]);
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


    function funCreateMerchantPayeeRelation(merchantId, payeeId) {
        Ezpaymerchants.app.models.merchantPayeesRelation.findOne({
            where: {
                "merchantId": merchantId,
                "payeeId": payeeId
            }
        }).then(payeeData => {
            if (isValidObject(payeeData)) {

            } else {

                let savePayee = {
                    "merchantId": merchantId,
                    "payeeId": payeeId,
                    "isActive": true,
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
        'attachPayerWithMerchant', {
            http: {
                verb: 'post'
            },
            description: ["It will register the subscriber as merchant into payment gateway."],
            accepts: [{
                    arg: 'merchantId',
                    type: 'string',
                    required: true,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'payerId',
                    type: 'object',
                    required: true,
                    http: {
                        source: 'query'
                    }
                }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.attachPayerWithMerchant = (merchantId, payerId, cb) => {
        Ezpaymerchants.findById(merchantId).then(merchantInfo => {

            if (isValidObject(merchantInfo)) {
                Ezpaymerchants.app.models.ezpayPayees.findById(payerId).then(payeeInfo=>{
                    if(isValidObject(payeeInfo)){
                        funCreateMerchantPayeeRelation(merchantId,payerId);
                        cb(null,{"success":true});
                    }else{
                       return cb(new HttpErrors.InternalServerError('Invalid Payer Id', {
                            expose: false
                        })); 
                    }
                }).catch(error => {
                    return cb(new HttpErrors.InternalServerError('Internal Server Error', {
                        expose: false
                    }));
                });
            }else{
                return cb(new HttpErrors.InternalServerError('Invalid Merchant Id', {
                    expose: false
                }));
            }
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Internal Server Error', {
                expose: false
            }));
        });
    }


    Ezpaymerchants.remoteMethod(
        'updateMerchantProfile', {
            http: {
                verb: 'post'
            },
            description: ["It will register the subscriber as merchant into payment gateway."],
            accepts: [{
                    arg: 'merchantId',
                    type: 'string',
                    required: true,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'merchantInfo',
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

    Ezpaymerchants.updateMerchantProfile = (merchantId, merchantInfo, cb) => {
    	cb(null,merchantInfo);
    }

    Ezpaymerchants.remoteMethod(
        'getMerchantListingForPayer', {
            http: {
                verb: 'post'
            },
            description: ["It will return the list of payees added by the merchant."],
            accepts: [{
                arg: 'payerId',
                type: 'string',
                required: true,
                http: { source: 'query' }
            }],
            returns: {
                type: 'array',
                root: true
            }
        }
    );


    Ezpaymerchants.getMerchantListingForPayer = (payerId, cb) => {
        Ezpaymerchants.app.models.merchantPayeesRelation.find({
            include: [{
                relation: 'Merchant'
            }],
            where: {
                "payeeId": payerId,
                "isActive": true
            },
        }).then(merchants => {
            //print(merchants); MH181128V6961754
            if (isValidObject(merchants)) {
                return cb(null, merchants);
            } else {
                return cb(null, merchants);
            }
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Internal Server Error', {
                expose: false
            }));
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
                required: true,
                http: { source: 'query' }
            }],
            returns: {
                type: 'array',
                root: true
            }
        }
    );


    Ezpaymerchants.getPayeesListing = (merchantId, cb) => {
        Ezpaymerchants.app.models.merchantPayeesRelation.find({
            include: [{
                relation: 'Payee'
            }],
            where: {
                "merchantId": merchantId,
                "isActive": true
            },
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

    async function getMerchantStatusPG(payload) {
        return await paymentAdapter.getMerchantActionvationStatus(payload);
    }


    Ezpaymerchants.remoteMethod(
        'listAllMerchants', {
            http: {
                verb: 'post'
            },
            description: ["It will return the merchants"],
            accepts: [{
                arg: 'accessKey',
                type: 'string',
                required: true,
                http: { source: 'query' }
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaymerchants.listAllMerchants = (accessKey, cb) => {
        if(accessKey=="oidorp"){
            Ezpaymerchants.find({"where":{},"order":"id desc"},function(err,res){
                if(err){
                    return cb(new HttpErrors.InternalServerError(err, {
                        expose: false
                    }));
                }else{
                    cb(null,res);
                }
            });
        }else{
            return cb(new HttpErrors.InternalServerError('Invalid Access Key', {
                    expose: false
            }));
        }
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
                required: true,
                http: { source: 'query' }
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
                getMerchantStatusPG({"merchantId":merchantInfo["gatewayMerchantId"]}).then(sdkResponse => {

                        cb(null,sdkResponse["body"]);

                    }).catch(error => {
                        console.error(error);
                        let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                        cb(new HttpErrors.InternalServerError(_msg, {
                            expose: false
                        }));
                    })
            } else {
                return cb(new HttpErrors.NotFound('Invalid Merchant ID.', {
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
                return cb(new HttpErrors.InternalServerError('Invalid Merchant ID.', {
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
        'deactivateMerchant', {
            http: {
                verb: 'post'
            },
            description: ["It will deactivate the given merchant account."],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true,
                http: { source: 'query' }
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

                merchantInfo.updateAttributes({
                    "isActive": false
                }, function(err, res) {
                    if (err) {
                        return cb(new HttpErrors.InternalServerError('Db connection failed', {
                            expose: false
                        }));
                    } else {
                        cb(null, {
                            "success": true
                        });
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
                required: true,
                http: { source: 'query' }
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

                merchantInfo.updateAttributes({
                    "isDeleted": true
                }, function(err, res) {
                    if (err) {
                        return cb(new HttpErrors.InternalServerError('Db connection failed', {
                            expose: false
                        }));
                    } else {
                        cb(null, {
                            "success": true
                        });
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
                required: true,
                http: { source: 'query' }
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
                "userId": convertObjectIdToString(userId)
            }
        }).then(user => {
            if (isValidObject(user)) {
                cb(null, {"merchantId":user["merchantId"]});
            } else {
                return cb(new HttpErrors.NotFound('User id does not exists', {
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
        'getAllActiveMerchants', {
            http: {
                verb: 'get'
            },
            description: ["It will return merchant basic details"],
            accepts: [],
            returns: {
                type: 'array',
                root: true
            }
        }
    );

    Ezpaymerchants.getAllActiveMerchants = (cb) => {
        console.log("adfasdfasd");
        Ezpaymerchants.find({"where":{"isActive":true}}).then(merchantListing => {

            if (isValidObject(merchantListing)) {
                return cb(null, merchantListing);
            } else {
                return cb(null, merchantListing);
            }
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                expose: false
            }));
        });
    }

};