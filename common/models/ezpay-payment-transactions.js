'use strict';
//https://prodiodev.justoutdoor.in/payment.html?24310b0c-694c-43dd-aa2a-7ddc03900e96&https://prodiodev.justoutdoor.in&https://prodiodev.justoutdoor.in&order_id=24310b0c&response_code=6&secondary_response_code=0&response_code_text=Invalid%20Reference%20Error:%20Returns%20must%20reference%20approved%20Sales,%20Authorizations,%20or%20Captures
const HttpErrors = require('http-errors');
const async = require('async');
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

const CircularJSON = require('circular-json');
const paymentClass = require('payment-module-prodio');
const paymentObj = new paymentClass('http://localhost:3010/api/');
const isNull = function (val) {
    if (typeof val === 'string') {
        val = val.trim();
    }
    if (val === undefined || val === null || typeof val === 'undefined' || val === '' || val === 'undefined') {
        return true;
    }
    return false;
};
// let paymentHtmlUrl = 'https://prodiodev.justoutdoor.in/payment.html';
module.exports = function (Ezpaypaymenttransactions) {

    Ezpaypaymenttransactions.remoteMethod(
        'requestPayment', {
            http: {
                verb: 'post'
            },
            description: ["This request will initiate a payment request transaction"],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'paymentInfo',
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

    Ezpaypaymenttransactions.requestPayment = (merchantId, paymentInfo, cb) => {
        if (!isNull(paymentInfo["meta"])) {
            paymentInfo = paymentInfo["meta"];
        }

        const paymentDetails = paymentInfo;
        let totalAmount = '';
        if (paymentDetails.total) {
            totalAmount = paymentDetails.total.amount ? paymentDetails.total.amount.value : '';
        }
        else {
            cb(new HttpErrors.InternalServerError('Please provide total amount for payment.', {
                expose: false
            }));
        }
        let savePayment = {
            "merchantId": merchantId,
            "payerId": paymentInfo.payerId ? paymentInfo.payerId : '',
            "title": paymentInfo.title ? paymentInfo.title : '',
            "invoiceNumber": paymentInfo.invoiceNumber ? paymentInfo.invoiceNumber : '',
            "invoiceDate": paymentInfo.invoiceDate ? paymentInfo.invoiceDate : '',
            "totalAmount": parseFloat(totalAmount) ? parseFloat(totalAmount) : '',
            "isRecurring": paymentInfo.isRecurring ? paymentInfo.isRecurring : '',
            "payableDate": paymentInfo.payableDate ? paymentInfo.payableDate : '',
            "transactionStatus": "PENDING",
            "isActive": true,
            "createdAt": new Date()
        };

        delete paymentDetails["payerId"];
        delete paymentDetails["title"];
        delete paymentDetails["invoiceNumber"];
        delete paymentDetails["invoiceDate"];
        delete paymentDetails["amount"];
        delete paymentDetails["isRecurring"];
        delete paymentDetails["payableDate"];


        savePayment["metaData"] = paymentDetails;
        console.log("savePayment", savePayment);
        Ezpaypaymenttransactions.create(savePayment).then(transactionInfo => {
            console.log("transactionInfo", transactionInfo);
            cb(null, {
                "success": true,
                "transactionId": transactionInfo["transactionId"]
            });
        }).catch(error => {
            console.log("error", error);
            cb(new HttpErrors.InternalServerError('Error while creating new payment transaction.', {
                expose: false
            }));
        });
    }

    async function funMakePaymentInGateway(payload) {


        return await paymentAdapter.makePayment(payload);
    }

    async function funMakeDirectPaymentInGateway(payload) {
        return await paymentAdapter.makeDirectPayment(payload);
    }

    Ezpaypaymenttransactions.remoteMethod(
        'directPayment', {
            http: {
                verb: 'post'
            },
            description: ["This request will initiate a payment request transaction"],
            accepts: [{
                arg: 'paymentInfo',
                type: 'object',
                required: false,
                http: {
                    source: 'body'
                }
            },
            {
                arg: 'req',
                type: 'object',
                http: ctx => {
                    return ctx.req;
                }
            },
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.directPayment = (paymentInfo, req, cb) => {

        let url = "";
        if (!isNull(paymentInfo["BASE_URL"])) {
            url = paymentInfo["BASE_URL"];
        } else {
            if (!isNull(req)) {
                req = JSON.parse(CircularJSON.stringify(req));
                url = req.headers.origin;
            }
        }

        if (!isNull(paymentInfo["meta"])) {
            paymentInfo = paymentInfo["meta"];
        }
        let _surl = url + "/ezpayPaymentTransactions/receivePayUWebhooks?redirectUrl=" + paymentInfo["successUrl"] + "&success=true";
        let _furl = url + "/ezpayPaymentTransactions/receivePayUWebhooks?redirectUrl=" + paymentInfo["failureUrl"] + "&success=false";

        _furl = _furl.replace("//", "/");
        _surl = _surl.replace("//", "/");

        paymentInfo["successUrl"] = _surl;
        paymentInfo["failureUrl"] = _furl;

        let cardId = "";
        if (!isNull(paymentInfo["cardId"])) {
            cardId = paymentInfo["cardId"];
        }

        let transactionId = "";
        if (!isNull(paymentInfo["transactionId"])) {
            transactionId = paymentInfo["transactionId"];
        }
        //console.log(" \n \n paymentInfo==>"+JSON.stringify(paymentInfo));
        Ezpaypaymenttransactions.findById(transactionId).then(transInfo => {
            if (isValidObject(transInfo)) {
                if (transInfo["transactionStatus"] == "PAID") {
                    cb(new HttpErrors.InternalServerError('You have Already Paid for the transaction!', {
                        expose: false
                    }));
                } else {

                    funMakeDirectPaymentInGateway({
                        "paymentInfo": paymentInfo
                    }).then(sdkResponse => {
                        console.log(sdkResponse);

                        transInfo.updateAttributes({
                            "transactionStatus": "PAID",
                            "paymentDate": new Date()
                        }).then(updatedCount => {
                            cb(null, updatedCount);
                        }).catch(error => {
                            cb(new HttpErrors.InternalServerError('Server Error', {
                                expose: false
                            }));
                        });

                    }).catch(error => {

                        // transInfo.updateAttributes({
                        //     "transactionStatus": "FAILED",
                        //     "paymentDate": new Date()
                        // }).then(updatedCount => {
                        //     console.error(error);
                        //     let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                        //     cb(new HttpErrors.InternalServerError(_msg, {
                        //         expose: false
                        //     }));
                        // }).catch(error => {
                        //     cb(new HttpErrors.InternalServerError('Server Error', {
                        //         expose: false
                        //     }));
                        // });

                        console.error(error);
                        let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                        cb(new HttpErrors.InternalServerError(_msg, {
                            expose: false
                        }));


                    })



                }
            } else {
                cb(new HttpErrors.InternalServerError('Invalid Transaction ID.', {
                    expose: false
                }));
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        });




        // {
        //     "meta": {
        //     "orderTitle": "test name",
        //     "orderNumber": "123",
        //     "amount": "200",
        //     "email":"shashikant@prodio.in",
        //     "phone":"809757778",
        //     "firstname":"shashikant",
        //     "lastname":"sharma",
        //     "successUrl": "https://alpha.kinektapp.com/success", 
        //     "failureUrl": "https://alpha.kinektapp.com/failure",
        //     }
        // }


    }

    Ezpaypaymenttransactions.remoteMethod(
        'processPayment', {
            http: {
                verb: 'post'
            },
            description: ["This request will initiate a payment request transaction"],
            accepts: [{
                arg: 'transactionId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'payerId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'cardId',
                type: 'string',
                required: false,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'cardInfo',
                type: 'object',
                required: false,
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

    Ezpaypaymenttransactions.processPayment = (transactionId, payerId, cardId, cardInfo, cb) => {
        let transactionPayload = cardInfo;
        // console.log("transactionPayload",cardInfo.meta);
        console.log("cardInfo",cardInfo);
        if (!isNull(cardInfo["meta"])) {
            cardInfo = cardInfo.meta.cardInfo ? cardInfo.meta.cardInfo :''
        }

        Ezpaypaymenttransactions.app.models.ezpayPayees.findById(payerId).then(payeeInfo => {
            if (isValidObject(payeeInfo)) {
                Ezpaypaymenttransactions.findById(transactionId).then(transInfo => {
                    if (isValidObject(transInfo)) {
                        if (transInfo["transactionStatus"] == "PAID") {
                            cb(new HttpErrors.InternalServerError('You have Already Paid for the transaction!', {
                                expose: false
                            }));
                        } else {

                            if (!isNull(cardId)) {
                                //direct take payment from card id
                                Ezpaypaymenttransactions.app.models.savedCardsMetaData.findById(cardId).then(cardDataInfo => {
                                    let _payload = {
                                        "cardInfo": cardDataInfo,
                                        "payerInfo": payeeInfo,
                                        "paymentInfo": transInfo
                                    };
                                    funMakePaymentInGateway(_payload).then(sdkResponse => {
                                        transInfo.updateAttributes({
                                            "gatewayTransactionId": sdkResponse["body"]["gatewayTransactionId"],
                                            "cardId": cardId,
                                            "transactionStatus": "PAID",
                                            "paymentDate": new Date()
                                        }).then(updatedCount => {
                                            cb(null, updatedCount);
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
                                }).catch(error => {
                                    cb(new HttpErrors.InternalServerError('Server Error', {
                                        expose: false
                                    }));
                                });

                            } else {
                                //check if user wants to save card or not
                                console.log("cardInfo",cardInfo);
                                if (cardInfo.saveCard) {
                                    //first save card and then take payment from card id
                                    let _payload = {
                                        "cardInfo": cardInfo,
                                        "payerInfo": payeeInfo,
                                        "paymentInfo": transInfo
                                    };
                                    funMakePaymentInGateway(_payload).then(sdkResponse => {
                                        transInfo.updateAttributes({
                                            "gatewayTransactionId": sdkResponse["body"]["gatewayTransactionId"],
                                            "cardId": cardId,
                                            "transactionStatus": "PAID",
                                            "paymentDate": new Date()
                                        }).then(updatedCount => {
                                            cb(null, updatedCount);
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
                                    console.log("paymenturl_successs", transactionPayload.meta.successUrl);
                                    let successUrl = transactionPayload.meta.successUrl ? transactionPayload.meta.successUrl : '';
                                    let failureUrl = transactionPayload.meta.failureUrl ? transactionPayload.meta.failureUrl : '';
                                    let paymentReturnUrl = '';
                                    if (successUrl) {
                                        console.log("entererdddd", successUrl);
                                        paymentReturnUrl = `${transactionPayload.meta.returnUrl}?${transInfo.transactionId}&${successUrl}&${failureUrl}`;
                                    }
                                    else {

                                        cb(new HttpErrors.InternalServerError('Please provide success url', {
                                            expose: false
                                        }));
                                    }

                                    if (!isNull(paymentReturnUrl)) {
                                        transInfo.postback_url = "https://1kfkd7w1qi.execute-api.us-west-2.amazonaws.com/dev/users/dummy";
                                        transInfo.return_url = paymentReturnUrl;
                                    }

                                    //take direct payment using card info
                                    let _payload = {
                                        "cardInfo": cardInfo,
                                        "payerInfo": payeeInfo,
                                        "paymentInfo": transInfo
                                    };
                                    funMakePaymentInGateway(_payload).then(sdkResponse => {

                                        if (sdkResponse.body) {
                                            transInfo.updateAttributes({
                                                "gatewayTransactionId": sdkResponse.body.gatewayTransactionId ? sdkResponse.body.gatewayTransactionId : '',
                                                "paymentUrl": sdkResponse.body.payRedirectUrl ? sdkResponse.body.payRedirectUrl : '',
                                                "cardId": cardId,
                                                "transactionStatus": sdkResponse.body.gatewayTransactionId ? "PAID" : "PENDING",
                                                "paymentDate": new Date()
                                            }).then(updatedCount => {
                                                cb(null, updatedCount);
                                            }).catch(error => {
                                                cb(new HttpErrors.InternalServerError('Server Error', {
                                                    expose: false
                                                }));
                                            });
                                        } else {
                                            cb(new HttpErrors.InternalServerError('Transaction failed', {
                                                expose: false
                                            }));
                                        }

                                    }).catch(error => {
                                        console.error(error);
                                        let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                                        cb(new HttpErrors.InternalServerError(_msg, {
                                            expose: false
                                        }));
                                    })

                                }
                            }
                        }
                    } else {
                        cb(new HttpErrors.InternalServerError('Invalid Transaction ID.', {
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


    Ezpaypaymenttransactions.remoteMethod(
        'getTransactionsListing', {
            http: {
                verb: 'post'
            },
            description: ["This request will initiate a payment request transaction"],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'pageNo',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'filterCriteria',
                type: 'object',
                required: false,
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

    Ezpaypaymenttransactions.getTransactionsListing = (merchantId, pageNo, filterCriteria, cb) => {
        if (!isNull(filterCriteria["meta"])) {
            filterCriteria = filterCriteria["meta"]["filterCriteria"];
        }

        Ezpaypaymenttransactions.find({
            "where": {
                "merchantId": merchantId
            },
            "include": [{
                relation: 'Payer'
            }, {
                relation: 'Merchant',
                scope: {
                    "fields": ["merchantId", "userId", "userInfo", "businessInfo"]
                }
            }],
            "order": "createdAt desc"
        }).then(transactions => {
            if (isValidObject(transactions)) {
                cb(null, transactions);
            } else {
                cb(null, transactions);
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        })
    }

    Ezpaypaymenttransactions.remoteMethod(
        'getPayersTransactions', {
            http: {
                verb: 'post'
            },
            description: ["This request will initiate a payment request transaction"],
            accepts: [{
                arg: 'payerId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'pageNo',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'filterCriteria',
                type: 'object',
                required: false,
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

    Ezpaypaymenttransactions.getPayersTransactions = (payerId, pageNo, filterCriteria, cb) => {
        console.log(filterCriteria);
        if (!isNull(filterCriteria["meta"])) {
            filterCriteria = filterCriteria["meta"]["filterCriteria"];
        }

        let filterObj = {};
        filterObj["payerId"] = payerId;
        if (!isNull(filterCriteria)) {
            if (!isNull(filterCriteria["merchantId"])) {
                filterObj["merchantId"] = filterCriteria["merchantId"];
            }
        }

        Ezpaypaymenttransactions.find({
            "where": filterObj,
            "include": [{
                relation: 'Payer'
            }, {
                relation: 'Merchant',
                scope: {
                    "fields": ["merchantId", "userId", "userInfo", "businessInfo"]
                }
            }],
            "order": "createdAt desc"
        }).then(transactions => {
            if (isValidObject(transactions)) {
                cb(null, transactions);
            } else {
                cb(null, transactions);
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        })
    }



    Ezpaypaymenttransactions.remoteMethod(
        'getNonPayersListing', {
            http: {
                verb: 'post'
            },
            description: ["This request will initiate a payment request transaction"],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.getNonPayersListing = (merchantId, cb) => {

        Ezpaypaymenttransactions.find({
            "where": {
                "merchantId": merchantId,
                "transactionStatus": "PENDING"
            },
            "include": [{
                relation: 'Payer'
            }],
            "order": "createdAt desc"
        }).then(transactions => {
            if (isValidObject(transactions)) {
                cb(null, transactions);
            } else {
                cb(null, transactions);
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        })
    }


    Ezpaypaymenttransactions.remoteMethod(
        'getTransactionDetails', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [{
                arg: 'transactionId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.getTransactionDetails = (transactionId, cb) => {
        console.log("transactionId=>" + transactionId)
        Ezpaypaymenttransactions.findOne({
            "where": {
                "transactionId": transactionId
            },
            "include": [{
                relation: 'Payer'
            }, {
                relation: 'Merchant'
            }]
        }).then(transObj => {
            if (isValidObject(transObj)) {
                cb(null, transObj);
            } else {
                cb(null, transObj);
            }
        }).catch(error => {
            cb(new HttpErrors.InternalServerError('Server Error', {
                expose: false
            }));
        });
    }


    Ezpaypaymenttransactions.remoteMethod(
        'getPayerTransactionStats', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [{
                arg: 'payerId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'merchantId',
                type: 'string',
                required: false,
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

    Ezpaypaymenttransactions.getPayerTransactionStats = (payerId, merchantId, cb) => {

        let condArr = [];
        condArr.push({
            "payerId": payerId
        });
        if (!isNull(merchantId)) {
            condArr.push({
                "merchantId": merchantId
            });
        }
        var rewardCollection = Ezpaypaymenttransactions.getDataSource().connector.collection(Ezpaypaymenttransactions.modelName);
        var cursorTest = rewardCollection.aggregate([{
            $match: {
                $and: condArr
            }
        },
        {
            "$group": {
                "_id": {
                    transactionStatus: "$transactionStatus",
                },
                "grand_total": {
                    "$sum": "$totalAmount"
                },

            }
        }
        ], function (err, cursor) {
            if (err) {
                cb(new HttpErrors.InternalServerError(err, {
                    expose: false
                }));
            } else {

                let retJson = {
                    "amountPending": "0.00",
                    "totalCollections": "0.00"
                };

                async.each(cursor, function (item, callbk) {
                    if (item["_id"]["transactionStatus"] == "DONE" || item["_id"]["transactionStatus"] == "PAID") {
                        retJson["totalCollections"] = item["grand_total"]
                    }
                    if (item["_id"]["transactionStatus"] == "PENDING") {
                        retJson["amountPending"] = item["grand_total"];
                    }
                    callbk();

                }, function () {
                    cb(null, retJson);
                });


            }
        });

    }


    Ezpaypaymenttransactions.remoteMethod(
        'getTransactionStats', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [{
                arg: 'merchantId',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.getTransactionStats = (merchantId, cb) => {

        var rewardCollection = Ezpaypaymenttransactions.getDataSource().connector.collection(Ezpaypaymenttransactions.modelName);
        var cursorTest = rewardCollection.aggregate([{
            $match: {
                $and: [{
                    "merchantId": merchantId
                },]
            }
        },
        {
            "$group": {
                "_id": {
                    transactionStatus: "$transactionStatus",
                },
                "grand_total": {
                    "$sum": "$totalAmount"
                },

            }
        }
        ], function (err, cursor) {
            if (err) {
                cb(new HttpErrors.InternalServerError(err, {
                    expose: false
                }));
            } else {

                let retJson = {
                    "amountPending": "0.00",
                    "totalCollections": "0.00"
                };

                async.each(cursor, function (item, callbk) {
                    if (item["_id"]["transactionStatus"] == "DONE" || item["_id"]["transactionStatus"] == "PAID") {
                        retJson["totalCollections"] = item["grand_total"]
                    }
                    if (item["_id"]["transactionStatus"] == "PENDING") {
                        retJson["amountPending"] = item["grand_total"];
                    }
                    callbk();

                }, function () {
                    cb(null, retJson);
                });


            }
        });

    }

    Ezpaypaymenttransactions.remoteMethod(
        'receivePayUWebhooks', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [{
                arg: 'data',
                type: 'object',
                required: true,
                http: {
                    source: 'body'
                }
            },
            {
                arg: 'redirectUrl',
                type: 'string',
                required: true,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'merchantId',
                type: 'string',
                required: false,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'res',
                type: 'object',
                http: ctx => {
                    return ctx.res;
                }
            },
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    function funCreateTransactionAndRedirect(savePayment, res, redirectUrl) {
        Ezpaypaymenttransactions.create(savePayment).then(transactionInfo => {
            // cb(null, {
            //     "success": true,
            //     "transactionId": transactionInfo["transactionId"],
            //     "gatewayTransactionId": data["txnid"]
            // });
            res.redirect(redirectUrl);
        }).catch(error => {
            res.redirect(redirectUrl);
        });
    }


    function funCheckTransactionStatus(data, merchantId, payeeInfo, res, redirectUrl) {
        if ((!isNull(data["status"])) && (data["status"] == "success")) {
            let savePayment = {
                "merchantId": merchantId,
                "payerId": payeeInfo["payerId"],
                "totalAmount": parseFloat(data["amount"]),
                "isRecurring": false,
                "payableDate": new Date(),
                "transactionStatus": "PAID",
                "metaData": data,
                "isActive": true,
                "createdAt": new Date()
            };
            funCreateTransactionAndRedirect(savePayment, res, redirectUrl);
        } else {
            let savePayment = {
                "merchantId": merchantId,
                "payerId": payeeInfo["payerId"],
                "totalAmount": parseFloat(data["amount"]),
                "isRecurring": false,
                "payableDate": new Date(),
                "transactionStatus": "FAILED",
                "metaData": data,
                "isActive": true,
                "createdAt": new Date()
            };
            funCreateTransactionAndRedirect(savePayment, res, redirectUrl);
        }
    }

    Ezpaypaymenttransactions.receivePayUWebhooks = (data, redirectUrl, merchantId, res, next) => {
        console.log("datttttttttttttttt", data);
        console.log("")

        Ezpaypaymenttransactions.app.models.ezpayPayees.findOne({
            "where": {
                "email": data["email"]
            }
        }).then(payeeInfo => {
            if (isValidObject(payeeInfo)) {
                funCheckTransactionStatus(data, merchantId, payeeInfo, res, redirectUrl);

            } else {
                //create new payee

                let savePayee = {
                    "merchantId": merchantId,
                    "firstName": isValid(data["firstname"]) ? data["firstname"] : "",
                    "lastName": isValid(data["lastname"]) ? data["lastname"] : "",
                    "email": isValid(data["email"]) ? String(data["email"]).toLowerCase() : "",
                    "mobileNumber": isValid(data["phone"]) ? data["phone"] : "",
                    "address": isValid(data["address1"]) ? data["address1"] : "",
                    "paymentMethod": "CREDIT_CARD",
                    "isActive": true,
                    "createdAt": new Date(),
                    "updatedAt": new Date()
                };

                Ezpaypaymenttransactions.app.models.ezpayPayees.create(savePayee).then(payeeInfo => {
                    //create transaction
                    funCheckTransactionStatus(data, merchantId, payeeInfo, res, redirectUrl);

                }).catch(error => {
                    res.redirect(redirectUrl);
                });
            }
        }).catch(error => {
            res.redirect(redirectUrl);
        });
    }

    Ezpaypaymenttransactions.remoteMethod(
        'openEdgeWebhooks', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [{
                arg: 'data',
                type: 'object',
                required: true,
                http: {
                    source: 'body'
                }
            },
            {
                arg: 'redirectUrl',
                type: 'string',
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


    Ezpaypaymenttransactions.openEdgeWebhooks = (data, redirectUrl, cb) => {
        const transQuery = {
            "where": {
                "transactionId": data.transactionId
            }
        };
        Ezpaypaymenttransactions.findById(data.transactionId).then(transactionInfo => {
            if (transactionInfo !== null) {
                let savePayment = {
                    "merchantId": transactionInfo.merchantId,
                    "payerId": transactionInfo.payerId,
                    "totalAmount": parseFloat(transactionInfo.totalAmount),
                    "isRecurring": false,
                    "payableDate": new Date(),
                    "transactionStatus": data.paymentStatus ? 'PAID' : 'PENDING',
                    "isActive": true,
                    "createdAt": new Date()
                };
                transactionInfo.updateAttributes(savePayment).then(updatedTransaction => {

                    if (updatedTransaction.transactionStatus == 'PENDING') {
                        return cb(null, { 'msg': 'Transaction Pending', 'data': null, 'status': 1 });
                    }
                    else {
                        return cb(null, { 'msg': 'Transaction Successful.', 'data': null, 'status': 1 });
                    }

                    // res.redirect(redirectUrl);
                }).catch(error => {
                    return cb(null, { 'msg': 'Please try again.', 'data': null, 'status': 0 });
                });

            }
        });
    }




    async function funMakeRefundInGateway(payload) {
        console.log("paymentAdapy", paymentAdapter);
        return await paymentAdapter.makeRefund(payload);
    }


    Ezpaypaymenttransactions.remoteMethod(
        'makeRefund', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [{
                arg: 'data',
                type: 'object',
                required: true,
                http: {
                    source: 'body'
                }
            },],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.makeRefund = (data, cb) => {
        let _payload = data;
        if (!isNull(payloadJson["meta"])) {
            _payload = payloadJson["meta"];
        }
        console.log("refund payload", _payload);
        funMakeRefundInGateway({
            "paymentInfo": _payload
        }).then(sdkResponse => {
            let savePayment = {
                "merchantId": _payload["merchantId"],
                "payerId": _payload["payerId"],
                "totalAmount": parseFloat(_payload["amount"]),
                "isRecurring": false,
                "payableDate": new Date(),
                "transactionStatus": "REFUND",
                "metaData": _payload,
                "isActive": true,
                "createdAt": new Date()
            };

            Ezpaypaymenttransactions.create(savePayment).then(res => {
                cb(null, res);
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

    }
    Ezpaypaymenttransactions.remoteMethod(
        'dummyPayment', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [
                { arg: 'data', type: 'object', 'http': { 'source': 'body' }, 'required': false }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.dummyPayment = (data, cb) => {

        const processPayload = {
            'action': "PROCESS_PAYMENT",
            'meta': data.meta
        };
        paymentObj.execute(processPayload, response => {
            console.log("response", response.status);
            console.log("response data", response.data);
            return cb(null, { "status": 0, "msg": "failed", "data": null });;
        })
    }
};