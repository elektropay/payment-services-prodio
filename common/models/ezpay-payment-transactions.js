'use strict';
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

const isNull = function (val) {
    if (typeof val === 'string') {
        val = val.trim();
    }
    if (val === undefined || val === null || typeof val === 'undefined' || val === '' || val === 'undefined') {
        return true;
    }
    return false;
};

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
            totalAmount = '';
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
        console.log("cardInfi", cardInfo);
        if (!isNull(cardInfo["meta"])) {
            cardInfo = cardInfo["meta"]["cardInfo"];
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
                                if (cardInfo["saveCard"]) {
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

                                    console.log("transInfo", transInfo);
                                    var success_url = `https://prodiodev.justoutdoor.in/payment.html?${transInfo.transactionId}`;
                                    transInfo.return_url = success_url;
                                    console.log("return url", transInfo.return_url);
                                    //take direct payment using card info
                                    let _payload = {
                                        "cardInfo": cardInfo,
                                        "payerInfo": payeeInfo,
                                        "paymentInfo": transInfo
                                    };
                                    funMakePaymentInGateway(_payload).then(sdkResponse => {
                                        console.log("sdkResponse", sdkResponse);

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

        let allPayerArr = []; let allPayerIds = [];
        var rewardCollection = Ezpaypaymenttransactions.getDataSource().connector.collection(Ezpaypaymenttransactions.modelName);
        var cursorTest = rewardCollection.aggregate([
            {
                $match: {
                    $and: [
                        { merchantId: merchantId },
                        { "transactionStatus": "PENDING" }
                    ]
                }
            },
            {
                "$group": {
                    "_id": {
                        id: "$payerId"
                    },
                    "grand_total": {
                        "$sum": "$totalAmount"
                    },

                }
            },
            {
                "$project": {
                    "_id": 1,
                    "grand_total": 1,
                    "Payer": 1
                }
            }

        ], function (err, res) {
            console.log(res);
            if (res.length) {

                async.each(res, function (item, callbk) {
                    allPayerArr[item["_id"]["id"]] = item["grand_total"];
                    //allPayerArr.push({"payeeId":item["_id"]["id"],"grand_total":item["grand_total"]});
                    allPayerIds.push(item["_id"]["id"]);
                    callbk();
                }, function () {
                    //console.log(allPayerArr); console.log(allPayerIds);
                    Ezpaypaymenttransactions.app.models.ezpayPayees.find({ "where": { "payeeId": { "inq": allPayerIds } } }).then(allPayers => {
                        //let resultArr = [allPayers, allPayerArr].reduce((a, b) => a.map((c, i) => Object.assign({}, c, b[i])));
                        //let resultArr = mergeRecursive(allPayers,allPayerArr);
                        let tmpArr = []; let tmpObj = {};
                        allPayers = JSON.parse(JSON.stringify(allPayers));
                        async.each(allPayers, function (itemP, cllbk) {
                            tmpObj = {};
                            tmpObj = itemP;
                            tmpObj["totalAmount"] = allPayerArr[itemP["payeeId"]];
                            tmpArr.push(tmpObj);
                            cllbk();
                        }, function () {

                            cb(null, tmpArr);
                        });
                    }).catch(err => {
                        console.log(err)
                    });
                });
            } else {
                cb(null, res);
            }
        });
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
        console.log(data);
        // Successful Transaction
        //step1 . get merchant id
        //step2 . create payer if not already get payer 1
        //step3. create transaction with success
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


        //cb(null,data);

        //success
        /*

      {
  "mihpayid": "202615",
  "mode": "CC",
  "status": "success",
  "unmappedstatus": "captured",
  "key": "4lgAWlPq",
  "txnid": "123",
  "amount": "200.00",
  "addedon": "2018-12-03 19:01:37",
  "productinfo": "test name",
  "firstname": "shashi",
  "lastname": "",
  "address1": "",
  "address2": "",
  "city": "",
  "state": "",
  "country": "",
  "zipcode": "",
  "email": "shashikant@prodio.in",
  "phone": "1234141332",
  "udf1": "",
  "udf2": "",
  "udf3": "",
  "udf4": "",
  "udf5": "",
  "udf6": "",
  "udf7": "",
  "udf8": "",
  "udf9": "",
  "udf10": "",
  "hash": "04f1cba32b979d7733850f5e9992f3afcabd352b344a7b94d639f1021f475c5ccf8e6089dd25d56e0a5355426664a58b3e4d0d1e93a5cb489a7d4c8372dfbb67",
  "field1": "979151",
  "field2": "234707",
  "field3": "203003",
  "field4": "MC",
  "field5": "290468988898",
  "field6": "00",
  "field7": "0",
  "field8": "3DS",
  "field9": " Verification of Secure Hash Failed: E700 -- Approved -- Transaction Successful -- Unable to be determined--E000",
  "PG_TYPE": "AXISPG",
  "encryptedPaymentId": "7B7F50631F0E66683AECF2C3B3ED29F9",
  "bank_ref_num": "979151",
  "bankcode": "VISA",
  "error": "E000",
  "error_Message": "No Error",
  "name_on_card": "Test",
  "cardnum": "401200XXXXXX1112",
  "cardhash": "This field is no longer supported in postback params.",
  "amount_split": "{\"PAYU\":\"200.0\"}",
  "payuMoneyId": "399577",
  "discount": "0.00",
  "net_amount_debit": "200"
}

      */
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
                type: 'string',
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

};