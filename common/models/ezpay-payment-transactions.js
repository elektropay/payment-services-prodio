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

        //console.log("savePayment", savePayment);
        Ezpaypaymenttransactions.create(savePayment).then(transactionInfo => {
            //console.log("transactionInfo", transactionInfo);
            if(isNull(paymentInfo["paymentFrequency"])){
                switch(paymentInfo["paymentFrequency"]){
                    case "ONETIME":
                    break;
                    case "INSTALLMENTS":
                        funCreateInstallments(transactionInfo["transactionId"],paymentInfo["installmentItems"],savePayment["totalAmount"]);
                    break;
                    case "RECURRING":
                        funCreateRecurringPlan(transactionInfo["transactionId"],paymentInfo["recurringItems"],savePayment["totalAmount"]);
                    break;
                }
            }
            cb(null, { "success": true,"transactionId": transactionInfo["transactionId"]});
        }).catch(error => {
            console.log("error", error);
            cb(new HttpErrors.InternalServerError('Error while creating new payment transaction.', {
                expose: false
            }));
        });
    }

    function funCreateInstallments(refTransactionId,installmentItems,totalAmount){
        let saveJson = {};
        async.each(installmentItems["installments"],function(item,clb){
            saveJson = {
                "refTransactionId":refTransactionId,
                "installmentLabel": item["label"],
                "amount":item["amount"],
                "dueDate":item["dueDate"],
                "paymentType":"INSTALLMENT",
                "paymentStatus":"PENDING",
                "metaData":{},
                "createdAt": new Date()
            };

            Ezpaypaymenttransactions.app.models.PaymentInstallments.create(saveJson).then(transInfo=>{
                //TODO : Use agenda and set event
            }).catch(err=>{

            });

        },function(){

        });
    }

    function funGetNextPaymentDate(startDate,intervalType,intervalNumber){
        switch(String(intervalType).toUpperCase()){
            case "MONTHLY":
                startDate.setDate(startDate.getDate());
                startDate.setMonth(startDate.getMonth() + intervalNumber);
                //startDate.setDate(startDate.getDate());
            break;
            case "DAILY":
                startDate.setDate(startDate.getDate() + 1);
            break;
            case "QUATERLY":
                startDate.setDate(startDate.getDate());
                startDate.setMonth(startDate.getMonth() + (3 * intervalNumber) );
            break;
            case "HALFYEARLY":
                startDate.setDate(startDate.getDate());
                startDate.setMonth(startDate.getMonth() + (6 * intervalNumber) );
            break;
            case "YEARLY":
                startDate.setFullYear(startDate.getFullYear() + 1);
            break;
        }

        startDate = new Date(startDate);

        return getPaddedComp(startDate.getMonth())+"/"+getPaddedComp(startDate.getDate())+"/"+startDate.getFullYear();
    }

    function getPaddedComp(comp) {
        return (((parseInt(comp) < 10) && comp.length != 2) ? ('0' + comp) : comp);
    }

    function funCreateRecurringPlan(refTransactionId,recurringItems,totalAmount){
        let saveJson = {};
        let downPayment = recurringItems["downPayment"];
        let recurringInterval =  recurringItems["recurringInterval"];
        let recurringAmount = recurringItems["recurringAmount"];

        let amountPending = parseFloat(totalAmount) - parseFloat(downPayment);
        let recurringStartDate = new Date();
        //Calculate total EMI duration
        //let totalMonths = parseFloat(amountPending) / parseFloat(recurringItems["recurringAmount"]);
        //let _count = totalMonths;
        let recurringArr = []; let _amt = amountPending;
        let recurrPay = 0;
        for(i=0;i<parseInt(recurringItems["recurringIntervalCount"]);i++){
            _amt = parseFloat(_amt) - parseFloat(recurringAmount);
            if(parseFloat(_amt) > parseFloat(recurringAmount) ){
                recurringArr.push({"recurringAmount":parseFloat(recurringAmount),"dueDate": funGetNextPaymentDate(recurringStartDate,recurringInterval, (i+1) ) });
            }else{
                if( parseFloat(_amt) > 0 ){
                    recurringArr.push({"recurringAmount":parseFloat(_amt),"dueDate": funGetNextPaymentDate(recurringStartDate,recurringInterval, (i+1) ) });
                }
            }   
        }


        async.each(recurringArr,function(item,clb){
            saveJson = {
                "refTransactionId":refTransactionId,
                "installmentLabel": "",
                "amount": item["recurringAmount"],
                "dueDate":item["dueDate"],
                "paymentType":"RECURRING",
                "paymentStatus":"PENDING",
                "metaData":{},
                "createdAt": new Date()
            };

            Ezpaypaymenttransactions.app.models.PaymentInstallments.create(saveJson).then(transInfo=>{
                //TODO : Use agenda and set event
            }).catch(err=>{

            });

        },function(){

        });
    }

    async function funMakePaymentInGateway(payload) {
        return await paymentAdapter.makePayment(payload);
    }

    async function funMakeDirectPaymentInGateway(payload) {
        return await paymentAdapter.makeDirectPayment(payload);
    }

    async function funVerifyCardOE(payload) {
        return await paymentAdapter.verifyCreditCard(payload);
    }

    async function funGetOrderDetails(payload) {
        return await paymentAdapter.getOrderDetails(payload);
    }

    async function funPayWithSavedCard(payload) {
        return await paymentAdapter.payDirectlyWithSavedCard(payload);
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
            },
            {
                arg: 'hostBaseURL',
                type: 'string',
                required: false,
                http: {
                    source: 'query'
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

    function funNormalizeStr(str){
        return str.replace("//", "/").replace("//", "/").replace("http:/", "http://").replace("https:/", "https://");
    }

    function funGetBaseUrl(hostBaseURL,req){
        let url = "";
        if (!isNull(hostBaseURL)) {
            url = hostBaseURL;
        } else {
            if (!isNull(req)) {
                req = JSON.parse(CircularJSON.stringify(req));
                url = req.headers.origin;
            }
        }  

        if(isNull(url)){
            url = "http://dev.getezpay.com:3010/";
        } 
        return url;
    }

    Ezpaypaymenttransactions.processPayment = (transactionId, payerId, cardId, cardInfo,hostBaseURL,req, cb) => {
        let transactionPayload = cardInfo;
        // console.log("transactionPayload",cardInfo.meta);
        if(isNull(cardInfo)){cardInfo={"meta":{}};}
        if (!isNull(cardInfo["meta"])) {
            cardInfo = cardInfo.meta.cardInfo ? cardInfo.meta.cardInfo : {};
        }

        let url = funGetBaseUrl(hostBaseURL,req);
             

        Ezpaypaymenttransactions.app.models.ezpayPayees.findById(payerId).then(payeeInfo => {
            if (isValidObject(payeeInfo)) {
                Ezpaypaymenttransactions.findById(transactionId).then(transInfo => {
                    //console.log(transactionId);
                    //console.log(transInfo);
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

                                    let _surl = url + "/api/ezpayPaymentTransactions/receiveOpenEdgeWebhooks?successUrl=" + funEncodeBase64Str(successUrl) + "&transactionId="+transInfo.transactionId+"&failureUrl="+funEncodeBase64Str(failureUrl);
                                    _surl = funNormalizeStr(_surl);
                                    

                                    if (!isNull(paymentReturnUrl)) {
                                        transInfo.return_url = _surl;
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
                })
                // .catch(error => {
                //     cb(new HttpErrors.InternalServerError('Server Error', {
                //         expose: false
                //     }));
                // });
            } else {
                cb(new HttpErrors.InternalServerError('Invalid Payee ID.', {
                    expose: false
                }));
            }
        })
        // .catch(error => {
        //     cb(new HttpErrors.InternalServerError('Server Error', {
        //         expose: false
        //     }));
        // });
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
            }, ],
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
                        {merchantId:merchantId},
                        {"transactionStatus": "PENDING"}
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
                "$project":{
                    "_id":1,
                    "grand_total":1,
                    "Payer":1
                }
            }
        
        ], function (err, res) {
            console.log(res);
            if(res.length){
                
                async.each(res,function(item,callbk){
                    allPayerArr[item["_id"]["id"]] = item["grand_total"];
                    //allPayerArr.push({"payeeId":item["_id"]["id"],"grand_total":item["grand_total"]});
                    allPayerIds.push(item["_id"]["id"]);
                    callbk();
                },function(){
                    //console.log(allPayerArr); console.log(allPayerIds);
                    Ezpaypaymenttransactions.app.models.ezpayPayees.find({"where":{"payeeId":{"inq": allPayerIds }}}).then(allPayers=>{
                        //let resultArr = [allPayers, allPayerArr].reduce((a, b) => a.map((c, i) => Object.assign({}, c, b[i])));
                        //let resultArr = mergeRecursive(allPayers,allPayerArr);
                        let tmpArr = []; let tmpObj = {};
                        allPayers = JSON.parse(JSON.stringify(allPayers));
                        async.each(allPayers,function(itemP,cllbk){
                            tmpObj = {};
                            tmpObj = itemP;
                            tmpObj["totalAmount"] = allPayerArr[itemP["payeeId"]];
                            tmpArr.push(tmpObj);
                            cllbk();
                        },function(){
                            
                            cb(null, tmpArr);
                        });                        
                    }).catch(err=>{
                        console.log(err)
                    });
                });
            }else{
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


    Ezpaypaymenttransactions.receivePayUWebhooks = (data, redirectUrl, merchantId, res, next) => {

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
        'receiveOpenEdgeWebhooks', {
            http: {
                verb: 'get'
            },
            description: ["This request will provide transaction details"],
            accepts: [
            { arg: 'successUrl', type: 'string', required: false,  http: { source: 'query' }},
            { arg: 'failureUrl', type: 'string', required: false,  http: { source: 'query' }},
            { arg: 'transactionId', type: 'string', required: false,  http: { source: 'query' }},
            { arg: 'order_id', type: 'string', required: false,  http: { source: 'query' }},
             {
                arg: 'response_code',
                type: 'string',
                required: false,
                http: {
                    source: 'query'
                }
            },
            {
                arg: 'secondary_response_code',
                type: 'string',
                required: false,
                http: {
                    source: 'query'
                }
            },{
                arg: 'response_code_text',
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
            }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    function funEncodeBase64Str(str){
        return  (new Buffer(str)).toString('base64');
    }

    function funDecodeBase64Str(encoded_str){
        return  (new Buffer(encoded_str, 'base64')).toString();
    }

    //https://stackoverflow.com/questions/2820249/base64-encoding-and-decoding-in-client-side-javascript

    Ezpaypaymenttransactions.receiveOpenEdgeWebhooks = (successUrl,failureUrl,transactionId, order_id,response_code,secondary_response_code,response_code_text,res, cb) => {

        successUrl = funDecodeBase64Str(successUrl);
        failureUrl = funDecodeBase64Str(failureUrl);

        let gatewayResponse = {
            "order_id": order_id,
            "response_code": response_code,
            "secondary_response_code": secondary_response_code,
            "response_code_text": response_code_text
        }

        let paymentStatus = "FAILED";
        if(response_code==1){
            paymentStatus = "PAID";
        }
        
        Ezpaypaymenttransactions.findById(transactionId).then(transactionInfo => {
            if (transactionInfo !== null) {
                let savePayment = {
                    "merchantId": transactionInfo.merchantId,
                    "payerId": transactionInfo.payerId,
                    "totalAmount": parseFloat(transactionInfo.totalAmount),
                    "isRecurring": false,
                    "payableDate": new Date(),
                    "transactionStatus": paymentStatus,
                    "gatewayResponse": gatewayResponse,
                    "isActive": true,
                    "createdAt": new Date()
                };
                transactionInfo.updateAttributes(savePayment).then(updatedTransaction => {

                    if (updatedTransaction.transactionStatus == 'PAID') {
                        res.redirect(successUrl);
                    }
                    else {
                        res.redirect(failureUrl);
                    }

                }).catch(error => {
                        res.redirect(failureUrl);
                });

            }
        });
    }

    async function funMakeRefundInGateway(payload) {
        //console.log("paymentAdapy", paymentAdapter);
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
        if (!isNull(data["meta"])) {
            _payload = data["meta"];
        }
        //console.log("refund payload", _payload);
        funMakeRefundInGateway({
            "paymentInfo": _payload
        }).then(sdkResponse => {

            if(sdkResponse.response_code == 1){

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
            }else{
                cb(new HttpErrors.InternalServerError(sdkResponse.response_code_text, {
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

    Ezpaypaymenttransactions.remoteMethod(
        'receiveCardDataOE', {
            http: {
                verb: 'get'
            },
            description: ["This request will provide transaction details"],
            accepts: [
            { arg: 'successUrl', type: 'string', required: false,  http: { source: 'query' }},
            { arg: 'failureUrl', type: 'string', required: false,  http: { source: 'query' }},
            { arg: 'merchantId', type: 'string', required: false,  http: { source: 'query' }},
            { arg: 'payerId', type: 'string', required: false,  http: { source: 'query' }},
            { arg: 'order_id', type: 'string', required: false,  http: { source: 'query' }},
            { arg: 'response_code', type: 'string', required: false,  http: { source: 'query' }},
            {
                arg: 'res',
                type: 'object',
                http: ctx => {
                    return ctx.res;
                }
            }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    
    Ezpaypaymenttransactions.receiveCardDataOE = (successUrl,failureUrl,merchantId,payerId, order_id,response_code,res, cb) => {

        successUrl = funDecodeBase64Str(successUrl);
        failureUrl = funDecodeBase64Str(failureUrl);

        Ezpaypaymenttransactions.getOrderDetails({"order_id":order_id},function(err,response){
            if(err){
                let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                cb(new HttpErrors.InternalServerError(_msg, {
                    expose: false
                })); 

            }else{
            
                let insertJson = {
                    "payerId":payerId,
                    "order_id": order_id,
                    "payer_identifier":response["payer_identifier"],
                    "expire_month":response["expire_month"],
                    "expire_year":response["expire_year"],
                    "span":response["span"],
                    "card_brand":response["card_brand"],
                    "card_type":response["card_type"],
                    "gatewayResponse": response
                };

                Ezpaypaymenttransactions.app.models.savedCardsMetaData.addEditUserCards(insertJson,function(err,cardRes){
                    if(err){
                        console.log("error");
                        res.redirect(failureUrl);
                    }else{
                        console.log("corrct");
                        if(parseInt(response_code)==1){
                            res.redirect(successUrl);
                        }else{
                            console.log("error22");
                            res.redirect(failureUrl);
                        }
                    }
                })
            }
        });
    }

    

    Ezpaypaymenttransactions.remoteMethod(
        'paymentWithSavedCard', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [
                { arg: 'paymentInfo', type: 'object', 'http': { 'source': 'body' }, 'required': false },
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.paymentWithSavedCard = (paymentInfo, cb) => {
        Ezpaypaymenttransactions.app.models.savedCardsMetaData.findById(paymentInfo["cardId"]).then(cardInfo=>{
            if(isValidObject(cardInfo)){
                funPayWithSavedCard({"cardInfo":cardInfo,"paymentInfo":paymentInfo}).then(sdkResponse=>{
                    if(parseInt(sdkResponse.response_code) == 1){
                        cb(null,sdkResponse);
                    }else{
                       cb(new HttpErrors.InternalServerError(sdkResponse.response_code_text, {
                            expose: false
                        })); 
                    }
                }).catch(error=>{
                    let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                    cb(new HttpErrors.InternalServerError(_msg, {
                        expose: false
                    }));
                })
            }else{
               cb(new HttpErrors.InternalServerError("Invalid card Id.", {
                    expose: false
                })); 
            }
        }).catch(error=>{
            let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
            cb(new HttpErrors.InternalServerError(_msg, {
                expose: false
            }));
        });
    }


    Ezpaypaymenttransactions.remoteMethod(
        'getOrderDetails', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [
                { arg: 'orderData', type: 'object', 'http': { 'source': 'body' }, 'required': false },
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.getOrderDetails = (orderData, cb) => {
        let _payload = orderData;
        if (!isNull(orderData["meta"])) {
            _payload = orderData["meta"];
        }

        funGetOrderDetails({"order_id":_payload["order_id"]}).then(sdkResponse=>{
            cb(null,sdkResponse);
        }).catch(error => {
            console.error(error);
            let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
            cb(new HttpErrors.InternalServerError(_msg, {
                expose: false
            }));
        })
    }


    Ezpaypaymenttransactions.remoteMethod(
        'verifyCreditCardOE', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [
                { arg: 'cardData', type: 'object', 'http': { 'source': 'body' }, 'required': false },
                {
                    arg: 'req',
                    type: 'object',
                    http: ctx => {
                        return ctx.res;
                    }
                }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.verifyCreditCardOE = (cardData,req, cb) => {

        let _payload = cardData;
        if (!isNull(cardData["meta"])) {
            _payload = cardData["meta"];
        }

        let url = funGetBaseUrl(_payload["hostBaseURL"],req);

        let successUrl = _payload.successUrl ? _payload.successUrl : '';
        let failureUrl = _payload.failureUrl ? _payload.failureUrl : '';

        let _surl = url + "/api/ezpayPaymentTransactions/receiveCardDataOE?successUrl=" + funEncodeBase64Str(successUrl) + "&merchantId="+_payload.merchantId+"&failureUrl="+funEncodeBase64Str(failureUrl)+"&payerId="+_payload.payerId;
        _surl = funNormalizeStr(_surl);

        _payload["return_url"] = _surl;


        funVerifyCardOE({
            "paymentInfo":_payload
        }).then(sdkResponse => {
            console.log(sdkResponse);
            sdkResponse = JSON.parse(JSON.stringify(sdkResponse));
            cb(null,sdkResponse);
            
            
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
    //http://dev.getezpay.com:3010/api/ezpayPaymentTransactions/receiveCardDataOE?successUrl=aHR0cDovL2Rldi5nZXRlenBheS5jb20vP3N1Y2Nlc3M9dHJ1ZQ==&merchantId=22e47c6d-3d2a-4688-ad95-b75f1c1c4ed1&failureUrl=aHR0cDovL2Rldi5nZXRlenBheS5jb20vP3N1Y2Nlc3M9ZmFsc2U=&order_id=1551427510159&response_code=1&secondary_response_code=0&response_code_text=Successful%20transaction:%20The%20transaction%20completed%20successfully.

    Ezpaypaymenttransactions.dummyPayment = (data, cb) => {

        let json = {
                "transactionId":"f4cfd5c2-b55b-4d82-96fd-58f9911ac6d9", /*(optional,You can get this transactionId from payment request transaction)*/  
                "buyerId":"",
                "amount":"10.00",
                "transaction_type":"CREDIT_CARD"
            };

        const processPayload = {
            'action': "MAKE_REFUND",
            'meta': json
        };
        paymentObj.execute(processPayload, response => {
            console.log("response", response.status);
            console.log("response data", response.data);
            return cb(null, response.data);
        })
    }
};