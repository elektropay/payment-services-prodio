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

const {
    paymentAdapter
} = require('../../server/moduleImporter');
const async = require('async');

const convertObjectIdToString = function(objectID) {
    return objectID.toString().substring(0,8);
};

const isNull = function(val) {
    if (typeof val === 'string') {
        val = val.trim();
    }
    if (val === undefined || val === null || typeof val === 'undefined' || val === '' || val === 'undefined') {
        return true;
    }
    return false;
};

module.exports = function(Ezpaypayees) {

    Ezpaypayees.remoteMethod(
        'addPayee', {
            http: {
                verb: 'post'
            },
            description: ["Add Payee"],
            accepts: [{
                    arg: 'merchantId',
                    type: 'string',
                    required: false,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'payeeInfo',
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

    Ezpaypayees.addPayee = (merchantId, payeeInfo, cb) => {

        let userId = "";
        if (!isNull(payeeInfo["meta"])) {
            payeeInfo = payeeInfo["meta"]["payerInfo"];
            userId = payeeInfo["userId"];
        }

        let whereCond = {"where": { "email": String(payeeInfo["email"]).toLowerCase() }};

        if(!isNull(userId)){
            whereCond = {"where": { "userId": convertObjectIdToString(userId) }};
        }

        if(isNull(merchantId)){
          
          Ezpaypayees.findOne(whereCond, function(err, payeeData) {
                if (err) {
                    cb(new HttpErrors.InternalServerError('Query Error', {
                        expose: false
                    }));
                } else {
                    if (isValidObject(payeeData)) {
                        //Check if this payer already attached with any merchant or not.
                        //if yes, send valid success response
                        //if not
                        if(isNull(payeeData["merchantId"])){
                            // cb(new HttpErrors.InternalServerError('Payee Id already exists.', {
                            //     expose: false
                            // }));
                            cb(null,{"success":true,"isAlreadyExists":true,"payerId":payeeData["payeeId"]});
                        }else{
                            cb(null,{"success":true,"isAlreadyExists":true,"payerId":payeeData["payeeId"]});
                        }
                        
                    } else {

                        let savePayee = {
                            "merchantId": merchantId,
                            "userId": convertObjectIdToString(userId),
                            "firstName": isValid(payeeInfo["firstName"]) ? payeeInfo["firstName"] : "",
                            "lastName": isValid(payeeInfo["lastName"]) ? payeeInfo["lastName"] : "",
                            "email": isValid(payeeInfo["email"]) ? String(payeeInfo["email"]).toLowerCase() : "",
                            "mobileNumber": isValid(payeeInfo["mobileNumber"]) ? payeeInfo["mobileNumber"] : "",
                            "address": (payeeInfo["address"]) ? payeeInfo["address"] : "",
                            "paymentMethod": isValid(payeeInfo["paymentMethod"]) ? payeeInfo["paymentMethod"] : "",
                            "isActive": true,
                            "createdAt": new Date(),
                            "updatedAt": new Date()
                        };

                        let _payload = {
                            "payeeInfo": savePayee,
                            "merchantInfo": {}
                        };

                        Ezpaypayees.create(savePayee).then(payeeObj => {
                                //funCreateMerchantPayeeRelation(merchantId, payeeObj["payeeId"], cb);
                            cb(null,{"success":true,"isAlreadyExists":false,"payerId":payeeObj["payeeId"]});
                        }).catch(error => {
                            cb(new HttpErrors.InternalServerError('Error while creating new payee.', {
                                expose: false
                            }));
                        });
                    }
                }
            })
        }else{
          Ezpaypayees.app.models.ezpayMerchants.findById(merchantId, function(err, merchantInfo) {
              if (err) {
                  cb(new HttpErrors.InternalServerError('Query Error.', {
                      expose: false
                  }));
              } else {
                  if (isValidObject(merchantInfo)) {
                      Ezpaypayees.findOne(whereCond, function(err, payeeData) {
                          if (err) {
                              cb(new HttpErrors.InternalServerError('Query Error', {
                                  expose: false
                              }));
                          } else {
                              if (isValidObject(payeeData)) {
                                  funCreateMerchantPayeeRelation(merchantId, payeeData["payeeId"], cb);
                              } else {

                                  let savePayee = {
                                      "merchantId": merchantId,
                                      "userId": convertObjectIdToString(userId),
                                      "firstName": isValid(payeeInfo["firstName"]) ? payeeInfo["firstName"] : "",
                                      "lastName": isValid(payeeInfo["lastName"]) ? payeeInfo["lastName"] : "",
                                      "email": isValid(payeeInfo["email"]) ? String(payeeInfo["email"]).toLowerCase() : "",
                                      "mobileNumber": isValid(payeeInfo["mobileNumber"]) ? payeeInfo["mobileNumber"] : "",
                                      "address": (payeeInfo["address"]) ? payeeInfo["address"] : "",
                                      "paymentMethod": isValid(payeeInfo["paymentMethod"]) ? payeeInfo["paymentMethod"] : "",
                                      "isActive": true,
                                      "createdAt": new Date(),
                                      "updatedAt": new Date()
                                  };

                                  let _payload = {
                                      "payeeInfo": savePayee,
                                      "merchantInfo": merchantInfo
                                  };

                                  funCreatePayerInGateway(_payload).then(sdkResponse => {

                                      savePayee["gatewayBuyerId"] = sdkResponse["body"]["gatewayBuyerId"];
                                      Ezpaypayees.create(savePayee).then(payeeObj => {

                                          funCreateMerchantPayeeRelation(merchantId, payeeObj["payeeId"], cb);
                                          //cb(null,{"success":true,"isAlreadyExists":false,"payerId":payeeObj["payeeId"]});
                                      }).catch(error => {
                                          cb(new HttpErrors.InternalServerError('Error while creating new payee.', {
                                              expose: false
                                          }));
                                      });
                                  }).catch(error => {
                                      console.error(error);
                                      let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                                      cb(new HttpErrors.InternalServerError(_msg, {
                                          expose: false
                                      }));
                                  })

                                  // Ezpaypayees.findOne({"where":{"mobileNumber":payeeInfo["mobileNumber"]}},function(err,payeeData){
                                  //      if(err){
                                  //           cb(new HttpErrors.InternalServerError('Query Error', {expose: false}));
                                  //      }else{
                                  //           if (isValidObject(payeeData)) {
                                  //                funCreateMerchantPayeeRelation(merchantId,payeeData["payeeId"],cb);
                                  //           }else{

                                  //           }
                                  //      }
                                  // });
                              }
                          }
                      })
                  } else {
                      cb(new HttpErrors.NotFound('Merchant Not Found!!', {
                          expose: false
                      }));
                  }
              }
          });
        }
    }


    async function funCreatePayerInGateway(payload) {
        return await paymentAdapter.createPayer(payload);
    }

    function funCreateMerchantPayeeRelation(merchantId, payeeId, cb) {
        Ezpaypayees.app.models.merchantPayeesRelation.findOne({
            where: {
                "merchantId": merchantId,
                "payeeId": payeeId
            }
        }).then(payeeData => {
            if (isValidObject(payeeData)) {
                cb(null, {
                    "success": true,
                    "isAlreadyExists": true,
                    "payerId": payeeId
                });
            } else {

                let savePayee = {
                    "merchantId": merchantId,
                    "payeeId": payeeId,
                    "isActive": true,
                    "createdAt": new Date(),
                };

                Ezpaypayees.app.models.merchantPayeesRelation.create(savePayee).then(payeeObj => {
                    //return cb(null, merchantObj);
                    cb(null, {
                        "success": true,
                        "isAlreadyExists": true,
                        "payerId": payeeId
                    });
                }).catch(error => {
                    print(error);
                    cb(new HttpErrors.InternalServerError('Server Error While Adding Payee.', {
                        expose: false
                    }));
                });

            }
        }).catch(error => {
            print(error);
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        });
    }


    async function funEditPayerInGateway(payload) {
        return await paymentAdapter.editPayer(payload);
    }

    Ezpaypayees.remoteMethod(
        'editPayee', {
            http: {
                verb: 'post'
            },
            description: ["Add Payee"],
            accepts: [{
                    arg: 'payerId',
                    type: 'string',
                    required: true,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'payeeInfo',
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

    Ezpaypayees.editPayee = (payerId, payeeInfo, cb) => {

        if (!isNull(payeeInfo["meta"])) {
            payeeInfo = payeeInfo["meta"]["payerInfo"];
        }

        Ezpaypayees.findById(payerId).then(payeeObj => {
            if (isValidObject(payeeObj)) {
                let payeeJson = {
                    "firstName": isValid(payeeInfo["firstName"]) ? payeeInfo["firstName"] : "",
                    "lastName": isValid(payeeInfo["lastName"]) ? payeeInfo["lastName"] : "",
                    "email": isValid(payeeInfo["email"]) ? String(payeeInfo["email"]).toLowerCase() : "",
                    "mobileNumber": isValid(payeeInfo["mobileNumber"]) ? payeeInfo["mobileNumber"] : "",
                    "address": (payeeInfo["address"]) ? payeeInfo["address"] : "",
                    "paymentMethod": isValid(payeeInfo["paymentMethod"]) ? payeeInfo["paymentMethod"] : "",
                    "updatedAt": new Date()
                };
                if (!isNull(payeeObj["gatewayBuyerId"])) {
                    payeeJson["gatewayBuyerId"] = payeeObj["gatewayBuyerId"];
                }
                let _payload = {
                    "payeeInfo": payeeJson,
                    "merchantInfo": {}
                }; //TODO, Need Merchant Info here
                funEditPayerInGateway(_payload).then(sdkResponse => {
                    payeeJson["gatewayBuyerId"] = sdkResponse["body"]["gatewayBuyerId"];
                    payeeObj.updateAttributes(payeeJson).then(updatedPayeeInfo => {
                        cb(null, {
                            "success": true
                        });
                    }).catch(error => {
                        cb(new HttpErrors.InternalServerError('Server Error, ' + JSON.stringify(error), {
                            expose: false
                        }));
                    });
                }).catch(error => {
                    console.error(error);
                    let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                    cb(new HttpErrors.InternalServerError(_msg, {
                        expose: false
                    }));
                })

            } else {
                cb(new HttpErrors.InternalServerError('Invalid Payee Id.', {
                    expose: false
                }));
            }
        }).catch(error => {
            print(error);
            cb(new HttpErrors.InternalServerError('Server Error, ' + JSON.stringify(error), {
                expose: false
            }));
        });
    }


    Ezpaypayees.remoteMethod(
        'getPayerProfileByEmail', {
            http: {
                verb: 'post'
            },
            description: ["Add Payee"],
            accepts: [{
                arg: 'payerEmail',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypayees.getPayerProfileByEmail = (payerEmail, cb) => {
        Ezpaypayees.findOne({"where":{"email": payerEmail }}).then(payeeObj => {
            if (isValidObject(payeeObj)) {
                cb(null, payeeObj);
            } else {
                cb(new HttpErrors.InternalServerError('Invalid Payee ID.', {
                    expose: false
                }));
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        });
    }



    Ezpaypayees.remoteMethod(
        'getPayerProfile', {
            http: {
                verb: 'post'
            },
            description: ["Add Payee"],
            accepts: [{
                arg: 'payerId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypayees.getPayerProfile = (payerId, cb) => {
        Ezpaypayees.findById(payerId).then(payeeObj => {
            if (isValidObject(payeeObj)) {
                cb(null, payeeObj);
            } else {
                cb(new HttpErrors.InternalServerError('Invalid Payee ID.', {
                    expose: false
                }));
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        });
    }


    async function funDeletePayerInGateway(payload) {
        return await paymentAdapter.removePayer(payload);
    }


    Ezpaypayees.remoteMethod(
        'removePayees', {
            http: {
                verb: 'post'
            },
            description: ["Add Payee"],
            accepts: [{
                arg: 'payerIds',
                type: 'array',
                description: "comma seperated array like 1234,84356,3533",
                required: true,
                http: {
                    source: 'query'
                }
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypayees.removePayees = (payerIds, cb) => {
        payerIds = String(payerIds).split(",");
        let isErrorResponse = false;

        async.each(payerIds, function(payerId, callbk) {
            Ezpaypayees.findById(payerId).then(payeeObj => {
                if (isValidObject(payeeObj)) {
                    let _payload = {
                        "payeeInfo": payeeObj,
                        "merchantInfo": {}
                    }; //TODO
                    funDeletePayerInGateway(_payload).then(sdkResponse => {
                        callbk();
                    }).catch(error => {
                        console.error(error);
                        isErrorResponse = true;
                        callbk();
                        let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                        return cb(new HttpErrors.InternalServerError(_msg, {
                            expose: false
                        }));
                    })
                } else {
                    isErrorResponse = true;
                    callbk();
                    return cb(new HttpErrors.InternalServerError('Invalid Payer Id.', {
                        expose: false
                    }))
                }
            }).catch(error => {
                isErrorResponse = true;
                callbk();
                return cb(new HttpErrors.InternalServerError('Server Error', {
                    expose: false
                }));
            });
        }, function() {
            if (!isErrorResponse) {
                cb(null, {
                    "success": true
                });
            }
        });

        // Ezpaypayees.updateAll({"in":payerIds},{"isActive":false}).then(res=>{
        //      cb(null,{"success":true});
        // }).catch(error=>{
        //      cb(new HttpErrors.InternalServerError('Server Error, '+JSON.stringify(error), { expose: false }));
        // })
    }

    Ezpaypayees.remoteMethod(
        'importPayees', {
            http: {
                verb: 'post'
            },
            description: ["Add Payee"],
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

    Ezpaypayees.importPayees = (merchantId, cb) => {
        const fs = require('fs');
        const download = require('download');
        var path = require("path");
        const excelToJson = require('convert-excel-to-json');

        let _url = "https://s3-us-west-2.amazonaws.com/ezpay-contents/template/PayerSample.xlsx";
        let file_name = path.basename(_url);
        let folder_path = 'temp_downloads/' + (new Date()).getTime();

        download(_url, folder_path).then(() => {
            console.log('done!');

            const result = excelToJson({
                sourceFile: folder_path + '/' + file_name
            });
            console.log(result);
            if (result) {
                fs.unlink(folder_path + '/' + file_name, function(error) {
                    if (error) {
                        throw error;
                    }
                    console.log('Deleted filename', file_name);
                });
            }

        });

        return cb(null, {
            "succes": true
        });
    }

    async function funAddCardForPayerInGateway(payload) {
        return await paymentAdapter.saveCardForPayer(payload);
    }

    Ezpaypayees.remoteMethod(
        'addCardForPayee', {
            http: {
                verb: 'post'
            },
            description: ["Add Payee"],
            accepts: [{
                    arg: 'payerId',
                    type: 'string',
                    required: true,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'cardInfo',
                    type: 'object',
                    required: true,
                    http: {
                        source: 'body'
                    }
                },
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypayees.addCardForPayee = (payerId, cardInfo, cb) => {
        // let cardInfo = {
        //      "cardNumber":"",
        //      "cardHolderName":"",
        //      "expDate":"",
        //      "cvv":"",
        //      "cardType":""
        // }

        if (!isNull(cardInfo["meta"])) {
            cardInfo = cardInfo["meta"];
        }
        Ezpaypayees.findById(payerId).then(payeeObj => {
            if (isValidObject(payeeObj)) {

                let _payload = {
                    "payerInfo": payeeObj,
                    "cardInfo": cardInfo,
                    "merchantInfo": {}
                }; //TODO, need merchant info

                var displayCard = String(cardInfo["cardNumber"]).replace(/.(?=.{4})/g, "X" );

                funAddCardForPayerInGateway(_payload).then(sdkResponse => {

                    let filterObj = {
                        "where": {
                            "payerId": payerId,
                            "cardType": cardInfo["cardType"],
                            "cardNumberAlias": displayCard
                        }
                    };

                    Ezpaypayees.app.models.savedCardsMetaData.findOne(filterObj).then(cardData => {
                        if (isValidObject(cardData)) {
                            //already exists
                            cb(null, {
                                "success": true,
                                "cardId": cardData["cardId"],
                                "isNewCard": false
                            });
                        } else {
                            //create new
                            let cardInfoSave = {
                                "payerId": payerId,
                                "cardHolderName": cardInfo["cardHolderName"],
                                "cardNumberAlias": displayCard,
                                "expiryDate": cardInfo["expDate"],
                                "cardType": cardInfo["cardType"],
                                "gatewayCardId": sdkResponse["body"]["gatewayCardId"],
                                "isActive": true,
                                "savedAt": new Date()
                            };

                            Ezpaypayees.app.models.savedCardsMetaData.create(cardInfoSave).then(cardInformation => {
                                cb(null, {
                                    "success": true,
                                    "cardId": cardInformation["cardId"],
                                    "isNewCard": true
                                });
                            }).catch(error => {
                                cb(new HttpErrors.InternalServerError('Server Error', {
                                    expose: false
                                }));
                            })
                        }
                    })
                    .catch(error => {
                        cb(new HttpErrors.InternalServerError('Server Error'+JSON.stringify(error), {
                            expose: false
                        }));
                    });

                }).catch(error => {
                    console.error(error);
                    let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                    cb(new HttpErrors.InternalServerError(_msg, {
                        expose: false
                    }));
                })


            } else {
                //invalid payee
                cb(new HttpErrors.InternalServerError('Invalid Payer ID.', {
                    expose: false
                }));
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        });
    }

    async function funDeleteCardForPayerInGateway(payload) {
        return await paymentAdapter.removeCard(payload);
    }

    Ezpaypayees.remoteMethod(
        'removeCard', {
            http: {
                verb: 'post'
            },
            description: ["Add Payee"],
            accepts: [{
                    arg: 'payerId',
                    type: 'string',
                    required: true,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'cardId',
                    type: 'object',
                    required: true,
                    http: {
                        source: 'query'
                    }
                },
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypayees.removeCard = (payerId, cardId, cb) => {
        Ezpaypayees.findById(payerId).then(payeeInfo => {
            if (isValidObject(payeeInfo)) {
                Ezpaypayees.app.models.savedCardsMetaData.findById(cardId).then(cardInfo => {
                    if (isValidObject(cardInfo)) {

                        let _payload = {"cardInfo":cardInfo,"payerInfo":payeeInfo,"merchantInfo":{}}; //TODO

                        funDeleteCardForPayerInGateway(_payload).then(sdkResponse => {

                          cardInfo.updateAttributes({
                              "isActive": false
                          }).then(updatedCount => {
                              cb(null, {
                                  "success": true
                              });
                          }).catch(error => {
                              cb(new HttpErrors.InternalServerError('Server Error', {
                                  expose: false
                              }));
                          });
                        }).catch(error => {
                            console.error(error);
                            let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                            cb(new HttpErrors.InternalServerError(_msg, {
                                expose: false
                            }));
                        })


                    } else {
                        cb(new HttpErrors.InternalServerError('Invalid Card ID.', {
                            expose: false
                        }));
                    }
                }).catch(error => {
                    cb(new HttpErrors.InternalServerError('Server Error', {
                        expose: false
                    }));
                });
            } else {
                cb(new HttpErrors.InternalServerError('Invalid Payee ID.', {
                    expose: false
                }));
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        });

    }

    Ezpaypayees.remoteMethod(
        'getSavedCards', {
            http: {
                verb: 'post'
            },
            description: ["get listing to cards saved by user."],
            accepts: [{
                arg: 'payerId',
                type: 'string',
                required: true,
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

    Ezpaypayees.getSavedCards = (payerId, cb) => {
        Ezpaymerchants.app.models.savedCardsMetaData.find({
            include: [{
                relation: 'Payee'
            }],
            where: {
                "payerId": payerId,
                "isActive": true
            },
        }).then(userCards => {
            cb(null, userCards);
        }).catch(error => {
            return cb(new HttpErrors.InternalServerError('Db connection failed', {
                expose: false
            }));
        });
    }

};