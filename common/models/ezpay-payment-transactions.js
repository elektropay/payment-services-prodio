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
    isNull,
    convertObjectIdToString
} = require('../../utility/helper');

const {
    paymentAdapter,
    schedular
} = require('../../server/moduleImporter');

const {
    PAYMENT_TERMS
} = require('../../server/constant');

//schedular.syncAllJobs();

//const CircularJSON = require('circular-json');
const {parse, stringify} = require('flatted/cjs');

const paymentClass = require('payment-module-prodio');
const paymentObj = new paymentClass('http://localhost:3010/api/');

// let paymentHtmlUrl = 'https://prodiodev.justoutdoor.in/payment.html';
module.exports = function(Ezpaypaymenttransactions) {

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
                },
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

    Ezpaypaymenttransactions.requestPayment = (merchantId, paymentInfo, req, cb) => {
        if (!isNull(paymentInfo["meta"])) {
            paymentInfo = paymentInfo["meta"];
        }

        const paymentDetails = paymentInfo;
        let totalAmount = '';
        if (paymentDetails.total) {
            totalAmount = paymentDetails.total.amount ? paymentDetails.total.amount.value : '';
        } else {
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
            "totalAmountPaid": 0.00,
            "totalAmountPending": parseFloat(totalAmount) ? parseFloat(totalAmount) : '0.00',
            "totalAmount": parseFloat(totalAmount) ? parseFloat(totalAmount) : '0.00',
            "isRecurring": paymentInfo.isRecurring ? paymentInfo.isRecurring : false,
            "paymentFrequency": paymentInfo.paymentFrequency ? paymentInfo.paymentFrequency : PAYMENT_TERMS['ONETIME'],
            "payableDate": paymentInfo.payableDate ? paymentInfo.payableDate : (paymentInfo.dueDate?paymentInfo.dueDate:''),
            "transactionStatus": PAYMENT_TERMS["PENDING"],
            "isActive": true,
            "createdAt": new Date(),
            "metaData":{}
        };

        if(savePayment["paymentFrequency"]!=PAYMENT_TERMS["ONETIME"]){
            savePayment["downPayment"] = paymentInfo.downPayment ? paymentInfo.downPayment : '0.00';
        }

        delete paymentDetails["payerId"];
        delete paymentDetails["title"];
        delete paymentDetails["invoiceNumber"];
        delete paymentDetails["invoiceDate"];
        delete paymentDetails["amount"];
        delete paymentDetails["isRecurring"];
        delete paymentDetails["payableDate"];

        if(!isNull(paymentDetails["metaData"])){
            savePayment["metaData"] = paymentDetails["metaData"];
        }
        
        savePayment["metaData"]["displayItems"] = paymentDetails["displayItems"];

        if(isNull(totalAmount) || totalAmount=='0.00'){
            cb(new HttpErrors.InternalServerError('Plese provide total amount to be paid.', {
                expose: false
            }));
        }else{

            Ezpaypaymenttransactions.create(savePayment).then(transactionInfo => {
                //console.log("transactionInfo", transactionInfo);
                if (!isNull(savePayment["paymentFrequency"])) {
                    //console.log(savePayment["paymentFrequency"]);
                    switch (savePayment["paymentFrequency"]) {
                        case PAYMENT_TERMS["ONETIME"]:
                            //cb(null, { "success": true,"transactionId": transactionInfo["transactionId"]});
                        break;
                        case PAYMENT_TERMS["INSTALLMENTS"]:
                            funCreateInstallments(transactionInfo["transactionId"], paymentInfo["installmentItems"], savePayment["totalAmount"], paymentInfo["hostBaseURL"], req,transactionInfo["merchantId"],transactionInfo["payerId"]);
                        break;
                        case PAYMENT_TERMS["RECURRING"]:
                            funCreateRecurringPlan(transactionInfo["transactionId"], paymentInfo["recurringItems"], savePayment["totalAmount"], paymentInfo["hostBaseURL"], req,transactionInfo["merchantId"],transactionInfo["payerId"]);
                        break;
                    }
                } else {
                    //cb(null, { "success": true,"transactionId": transactionInfo["transactionId"]});
                }

                funUpsertTransaction(PAYMENT_TERMS["PENDING"],transactionInfo,totalAmount,{});

                cb(null, {
                    "success": true,
                    "transactionId": transactionInfo["transactionId"]
                });

            }).catch(error => {
                //console.log("error", error);
                cb(new HttpErrors.InternalServerError('Error while creating new payment transaction.', {
                    expose: false
                }));
            });
        }
    }

    function funCreateInstallments(refTransactionId, installmentItems, totalAmount, hostBaseURL, req, merchantId, payerId) {
        let saveJson = {};
        let schedulingDone = false;
        //console.log(Date.now());
        installmentItems = JSON.parse(JSON.stringify(installmentItems));
        //console.log(installmentItems["installments"]);
        async.each(installmentItems["installments"], function(item, clb) {

            //console.log(item["dueDate"]+":::::"+new Date(item["dueDate"])+":::::"+new Date(item["dueDate"]+" 02:00"))
            saveJson = {
                "refTransactionId": refTransactionId,
                "merchantId": merchantId,
                "payerId": payerId,
                "installmentLabel": item["label"],
                "amount": item["amount"],
                "dueDate": new Date(item["dueDate"]),
                "paymentType": PAYMENT_TERMS["INSTALLMENT"],
                "paymentStatus": PAYMENT_TERMS["PENDING"],
                "metaData": item["metaData"],
                "createdAt": new Date()
            };

            Ezpaypaymenttransactions.app.models.PaymentInstallments.create(saveJson).then(transInfo => {
                //TODO : Use agenda and set event
                funScheduleJob(transInfo, hostBaseURL, req);
                //http://thecodebarbarian.com/node.js-task-scheduling-with-agenda-and-mongodb.html
                clb();
            }).catch(err => {
                console.log(err);
                clb();
            });

        }, function() {
            // funScheduleNextAllTransactions(refTransactionId,hostBaseURL,req);
            // cb(null, { "success": true,"transactionId": transactionInfo["transactionId"]});
        });
    }

    function funScheduleJob(transInfo, hostBaseURL, req) {
        let url = funGetBaseUrl(hostBaseURL, req);
        let _surl = url + "/api/ezpayPaymentTransactions/autoDeductPayment";
        _surl = funNormalizeStr(_surl);

        let evenObj = {
            "jobTitle": transInfo["installmentLabel"],
            "jobId": transInfo["installmentId"],
            "hostBaseURL": hostBaseURL,
            "apiUrl": _surl,
            "triggerAt": transInfo["dueDate"],
            "refTransactionId": transInfo["refTransactionId"]
        }
        schedular.setEvent(evenObj);
    }

    function funScheduleNextAllTransactions(refTransactionId, hostBaseURL, req) {
        //console.log("202020202020");
        let url = funGetBaseUrl(hostBaseURL, req);
        let _surl = url + "/api/ezpayPaymentTransactions/autoDeductPayment";
        _surl = funNormalizeStr(_surl);

        Ezpaypaymenttransactions.app.models.PaymentInstallments.find({
            "where": {
                "paymentStatus": "PENDING"
            },
            "order": "dueDate ASC"
        }).then(nextTransInfo => {
            if (nextTransInfo.length > 0) {
                async.each(nextTransInfo, function(item, clb) {
                    let evenObj = {
                        "jobTitle": item["installmentLabel"],
                        "jobId": item["installmentId"],
                        "hostBaseURL": hostBaseURL,
                        "apiUrl": _surl,
                        "triggerAt": item["dueDate"],
                        "refTransactionId": item["refTransactionId"]
                    }
                    schedular.setEvent(evenObj);
                    //console.log("scheduling done..."+new Date(item["dueDate"]));
                    clb();
                }, function() {
                    console.log("All scheduled..");
                });

            } else {
                console.log("Nothing to schedule..");
            }

        }).catch(err => {

        });
    }

    function funCreateRecurringPlan(refTransactionId, recurringItems, totalAmount, hostBaseURL, req, merchantId, payerId) {
        let saveJson = {};
        async.each(recurringItems["installments"], function(item, clb) {
            saveJson = {
                "refTransactionId": refTransactionId,
                "merchantId": merchantId,
                "payerId": payerId,
                "installmentLabel": item["label"],
                "amount": item["amount"],
                "dueDate": new Date(item["dueDate"] + " 03:00"),
                "paymentType": PAYMENT_TERMS["RECURRING"],
                "paymentStatus": PAYMENT_TERMS["PENDING"],
                "metaData": item["metaData"],
                "createdAt": new Date()
            };

            Ezpaypaymenttransactions.app.models.PaymentInstallments.create(saveJson).then(transInfo => {
                //TODO : Use agenda and set event
                funScheduleJob(transInfo, hostBaseURL, req);
                clb();
            }).catch(err => {
                clb();
            });

        }, function() {
            //funScheduleNextAllTransactions(refTransactionId,hostBaseURL,req);
        });
    }


    Ezpaypaymenttransactions.remoteMethod(
        'autoDeductPayment', {
            http: {
                verb: 'get'
            },
            description: ["This request will initiate a payment request transaction"],
            accepts: [{
                    arg: 'installmentId',
                    type: 'string',
                    required: true,
                    http: {
                        source: 'query'
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

    function funUpdateNextPayableDate(refTransactionId){
        try{
            Ezpaypaymenttransactions.findById(refTransactionId).then(transInfo=>{
                if(isValidObject(transInfo)){
                    Ezpaypaymenttransactions.app.models.PaymentInstallments.findOne({"where":{"refTransactionId": refTransactionId,"paymentStatus": PAYMENT_TERMS["PENDING"] },"order":"dueDate ASC"}).then(installInfo=>{
                        transInfo.updateAttributes({"payableDate": installInfo["dueDate"] }).then(updated=>{

                        });
                    });
                }
            });
        }catch(err){
            console.log("update failed...");
        }
    }

    Ezpaypaymenttransactions.autoDeductPayment = (installmentId, hostBaseURL, req, cb) => {
        //console.log(installmentId)
        //1. do payment
        //2. update total paid amount
        //3. schedule next transaction
        Ezpaypaymenttransactions.app.models.PaymentInstallments.findOne({
            "where": {
                "installmentId": installmentId
            },
            "include": [{
                relation: 'PaymentTransaction'
            }]
        }).then(installInfo => {
            if (isValidObject(installInfo)) {
                installInfo = JSON.parse(JSON.stringify(installInfo));
                //console.log(installInfo);
                let payerId = installInfo["PaymentTransaction"]["payerId"];
                Ezpaypaymenttransactions.app.models.savedCardsMetaData.findOne({
                    "where": {
                        "payerId": payerId
                    }
                }).then(savedCardInfo => {
                    //console.log(savedCardInfo);
                    if (isValidObject(savedCardInfo)) {
                        savedCardInfo["amount"] = installInfo["amount"];
                        savedCardInfo["ecommerce_indicator"] = "2"; //recurring
                        Ezpaypaymenttransactions.paymentWithSavedCard(savedCardInfo, function(err, successRes) {
                            if (err) {
                                //installment failed
                                let updateMsg = {
                                    "paymentStatus": PAYMENT_TERMS["FAILED"],
                                    "paymentTransactionDate": new Date(),
                                    "metaData": {
                                        "errorMessage": JSON.stringify(err)
                                    }
                                };

                                Ezpaypaymenttransactions.app.models.PaymentInstallments.updateAll({
                                    "installmentId": installmentId
                                }, updateMsg).then(updateInstll => {
                                    //installInfo.updateAttributes().then(updateInstll=>{
                                    //schedule same transaction again
                                    funUpdateNextPayableDate(installInfo["refTransactionId"]);
                                    // funScheduleNextTransaction(installInfo["refTransactionId"],hostBaseURL,req);
                                    cb(null, {
                                        "success": true
                                    });
                                });
                            } else {
                                //now redirect
                                let updateMsg = {
                                    "paymentStatus": PAYMENT_TERMS["PAID"],
                                    "paymentTransactionDate": new Date()
                                };
                                Ezpaypaymenttransactions.app.models.PaymentInstallments.updateAll({
                                    "installmentId": installmentId
                                }, updateMsg).then(updateInstll => {
                                    //installInfo.updateAttributes({"paymentStatus": PAYMENT_TERMS["PAID"],"paymentDate": new Date() }).then(updateInstll=>{
                                    Ezpaypaymenttransactions.findById(installInfo["refTransactionId"]).then(transInfo => {
                                        if (isValidObject(transInfo)) {
                                            let savePayment = {
                                                "totalAmountPaid": (parseFloat(transInfo["downPayment"]) + parseFloat(installInfo["amount"]))
                                            };

                                            savePayment["totalAmountPending"] = (parseFloat(transInfo["totalAmount"]) - parseFloat(savePayment["totalAmountPaid"]));
                                            console.log(transInfo);
                                            if (parseInt(savePayment["totalAmountPending"]) == 0) {
                                                savePayment["transactionStatus"] = PAYMENT_TERMS["PAID"];
                                            }
                                            transInfo.updateAttributes(savePayment).then(updatedTransaction => {
                                                //schedule next payment
                                                funUpdateNextPayableDate(installInfo["refTransactionId"]);
                                                //funScheduleNextTransaction(installInfo["refTransactionId"],hostBaseURL,req);
                                                cb(null, {
                                                    "success": true
                                                });
                                            }).catch(error => {
                                                cb(null, {
                                                    "success": false
                                                });
                                            });
                                        } else {
                                            return cb(null, {
                                                "status": false,
                                                "message": "No Transaction found for the user."
                                            });
                                        }
                                    })
                                }).catch(err => {
                                    return cb(null, {
                                        "status": false,
                                        "message": "Error while updating the installment status."
                                    });
                                });
                            }

                        })
                    } else {
                        return cb(null, {
                            "status": false,
                            "message": "No Credit Card Saved for the user."
                        });
                    }
                }).catch(err => {
                    cb(null, {
                        "success": false,
                        "message": "savedCardsMetaData=>findOne"
                    });
                });

            } else {
                console.log("Invalid ID");
            }
        }).catch(err => {

        });
    }


    function funGetNextPaymentDate(startDate, intervalType, intervalNumber) {
        switch (String(intervalType).toUpperCase()) {
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
                startDate.setMonth(startDate.getMonth() + (3 * intervalNumber));
                break;
            case "HALFYEARLY":
                startDate.setDate(startDate.getDate());
                startDate.setMonth(startDate.getMonth() + (6 * intervalNumber));
                break;
            case "YEARLY":
                startDate.setFullYear(startDate.getFullYear() + 1);
                break;
        }

        startDate = new Date(startDate);

        return getPaddedComp(startDate.getMonth()) + "/" + getPaddedComp(startDate.getDate()) + "/" + startDate.getFullYear();
    }

    function getPaddedComp(comp) {
        return (((parseInt(comp) < 10) && comp.length != 2) ? ('0' + comp) : comp);
    }

    function funCreateRecurringPlanAuto(refTransactionId, recurringItems, totalAmount) {
        let saveJson = {};
        let downPayment = recurringItems["downPayment"];
        let recurringInterval = recurringItems["recurringInterval"];
        let recurringAmount = recurringItems["recurringAmount"];

        let amountPending = parseFloat(totalAmount) - parseFloat(downPayment);
        let recurringStartDate = new Date();
        //Calculate total EMI duration
        //let totalMonths = parseFloat(amountPending) / parseFloat(recurringItems["recurringAmount"]);
        //let _count = totalMonths;
        let recurringArr = [];
        let _amt = amountPending;
        let recurrPay = 0;
        for (i = 0; i < parseInt(recurringItems["recurringIntervalCount"]); i++) {
            _amt = parseFloat(_amt) - parseFloat(recurringAmount);
            if (parseFloat(_amt) > parseFloat(recurringAmount)) {
                recurringArr.push({
                    "recurringAmount": parseFloat(recurringAmount),
                    "dueDate": funGetNextPaymentDate(recurringStartDate, recurringInterval, (i + 1))
                });
            } else {
                if (parseFloat(_amt) > 0) {
                    recurringArr.push({
                        "recurringAmount": parseFloat(_amt),
                        "dueDate": funGetNextPaymentDate(recurringStartDate, recurringInterval, (i + 1))
                    });
                }
            }
        }


        async.each(recurringArr, function(item, clb) {
            saveJson = {
                "refTransactionId": refTransactionId,
                "installmentLabel": "",
                "amount": item["recurringAmount"],
                "dueDate": item["dueDate"],
                "paymentType": PAYMENT_TERMS["RECURRING"],
                "paymentStatus": PAYMENT_TERMS["PENDING"],
                "metaData": {},
                "createdAt": new Date()
            };

            Ezpaypaymenttransactions.app.models.PaymentInstallments.create(saveJson).then(transInfo => {
                //TODO : Use agenda and set event
                clb();
            }).catch(err => {
                clb();
            });

        }, function() {

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
                req = JSON.parse(stringify(req));
                url = req.headers.origin;
            }
        }

        if (!isNull(paymentInfo["meta"])) {
            paymentInfo = paymentInfo["meta"];
        }

        let projectId = "";
        if (!isNull(paymentInfo["projectId"])) {
            projectId = paymentInfo["projectId"];
        }

        let _surl = url + "/ezpayPaymentTransactions/receivePayUWebhooks?redirectUrl=" + paymentInfo["successUrl"] + "&success=true&projectId="+projectId;
        let _furl = url + "/ezpayPaymentTransactions/receivePayUWebhooks?redirectUrl=" + paymentInfo["failureUrl"] + "&success=false&projectId="+projectId;

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
                if (transInfo["transactionStatus"] == PAYMENT_TERMS["PAID"]) {
                    cb(new HttpErrors.InternalServerError('You have Already Paid for the transaction!', {
                        expose: false
                    }));
                } else {

                    funMakeDirectPaymentInGateway({
                        "paymentInfo": paymentInfo
                    }).then(sdkResponse => {
                        console.log(sdkResponse);

                        transInfo.updateAttributes({
                            "transactionStatus": PAYMENT_TERMS["PAID"],
                            "totalAmountPending": 0.00,
                            "totalAmountPaid": transInfo["totalAmount"],
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

    function funNormalizeStr(str) {
        return str.replace("//", "/").replace("//", "/").replace("http:/", "http://").replace("https:/", "https://").replace("/api/api/","/api/");
    }

    function funGetBaseUrl(hostBaseURL, req) {
        let url = "";
        if (!isNull(hostBaseURL)) {
            url = hostBaseURL;
        } else {
            if (!isNull(req)) {
                req = JSON.parse(stringify(req));
                console.log(req.headers);
                url = req.headers.origin;
            }
        }

        if (isNull(url)) {
            url = "http://dev.getezpay.com:3010/";
        }
        return url;
    }

    Ezpaypaymenttransactions.processPayment = (transactionId, payerId, cardId, cardInfo, hostBaseURL, req, cb) => {
        let transactionPayload = cardInfo;
        let cardType = "CREDIT_CARD";
        // console.log("transactionPayload",cardInfo.meta);
        if (isNull(cardInfo)) {
            cardInfo = {
                "meta": {}
            };
        }
        if (!isNull(cardInfo["meta"])) {
            cardType = cardInfo["meta"]["cardType"];
            if (!isNull(cardInfo["meta"]["hostBaseURL"])) {
                hostBaseURL = cardInfo["meta"]["hostBaseURL"];
            }
            cardInfo = cardInfo.meta.cardInfo ? cardInfo.meta.cardInfo : {};
        }


        let url = funGetBaseUrl(hostBaseURL, req);

        Ezpaypaymenttransactions.app.models.ezpayPayees.findById(payerId).then(payeeInfo => {
            if (isValidObject(payeeInfo)) {
                Ezpaypaymenttransactions.findById(transactionId).then(transInfo => {
                    //console.log(transactionId);
                    //console.log(transInfo);
                    if (isValidObject(transInfo)) {
                        if (transInfo["transactionStatus"] == PAYMENT_TERMS["PAID"]) {
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
                                        "paymentInfo": transInfo,
                                        "cardType":cardType
                                    };
                                    funMakePaymentInGateway(_payload).then(sdkResponse => {
                                        transInfo.updateAttributes({
                                            "gatewayTransactionId": sdkResponse["body"]["gatewayTransactionId"],
                                            "cardId": cardId,
                                            "transactionStatus": PAYMENT_TERMS["PAID"],
                                            "totalAmountPending": 0.00,
                                            "totalAmountPaid": transInfo["totalAmount"],
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
                                        "paymentInfo": transInfo,
                                        "cardType":cardType
                                    };
                                    funMakePaymentInGateway(_payload).then(sdkResponse => {
                                        transInfo.updateAttributes({
                                            "gatewayTransactionId": sdkResponse["body"]["gatewayTransactionId"],
                                            "cardId": cardId,
                                            "transactionStatus": PAYMENT_TERMS["PAID"],
                                            "totalAmountPending": 0.00,
                                            "totalAmountPaid": transInfo["totalAmount"],
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
                                    } else {

                                        cb(new HttpErrors.InternalServerError('Please provide success url', {
                                            expose: false
                                        }));
                                    }

                                    let _surl = url + "/api/ezpayPaymentTransactions/receiveOpenEdgeWebhooks?successUrl=" + funEncodeBase64Str(successUrl) + "&transactionId=" + transInfo.transactionId + "&failureUrl=" + funEncodeBase64Str(failureUrl);
                                    _surl = funNormalizeStr(_surl);


                                    if (!isNull(paymentReturnUrl)) {
                                        transInfo.return_url = _surl;
                                    }

                                    //take direct payment using card info
                                    let _payload = {
                                        "cardInfo": cardInfo,
                                        "payerInfo": payeeInfo,
                                        "paymentInfo": transInfo,
                                        "cardType":cardType
                                    };

                                    let _ts = "PAID";
                                    if (!isNull(transInfo["paymentFrequency"])) {
                                        switch (transInfo["paymentFrequency"]) {
                                            case PAYMENT_TERMS["INSTALLMENTS"]:
                                                _ts = PAYMENT_TERMS["PARTIALLY_PAID"];
                                                _payload["paymentInfo"]["totalAmount"] = transInfo["downPayment"];
                                                break;
                                            case PAYMENT_TERMS["RECURRING"]:
                                                _ts = PAYMENT_TERMS["PARTIALLY_PAID"];
                                                _payload["paymentInfo"]["totalAmount"] = transInfo["downPayment"];
                                                break;
                                        }
                                    }

                                    funMakePaymentInGateway(_payload).then(sdkResponse => {

                                        if (sdkResponse.body) {

                                            transInfo.updateAttributes({
                                                "gatewayTransactionId": sdkResponse.body.gatewayTransactionId ? sdkResponse.body.gatewayTransactionId : '',
                                                "paymentUrl": sdkResponse.body.payRedirectUrl ? sdkResponse.body.payRedirectUrl : '',
                                                //"transactionStatus": sdkResponse.body.payRedirectUrl ? _ts : PAYMENT_TERMS["PENDING"],
                                                //"totalAmountPending":0.00,
                                                //"totalAmountPaid": transInfo["totalAmount"],
                                                //"paymentDate": new Date()
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
                },
                {
                    relation: 'Installments'
                },
                {
                    relation: 'Merchant',
                    scope: {
                        "fields": ["merchantId", "userId", "userInfo", "businessInfo"]
                    }
                }
            ],
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

        let allPayerArr = [];
        let allPayerIds = [];
        var rewardCollection = Ezpaypaymenttransactions.getDataSource().connector.collection(Ezpaypaymenttransactions.modelName);
        var cursorTest = rewardCollection.aggregate([{
                $match: {
                    $and: [{
                            merchantId: merchantId
                        },
                        {
                            "transactionStatus": PAYMENT_TERMS["PENDING"]
                        }
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

        ], function(err, res) {
            console.log(res);
            if (res.length) {

                async.each(res, function(item, callbk) {
                    allPayerArr[item["_id"]["id"]] = item["grand_total"];
                    //allPayerArr.push({"payeeId":item["_id"]["id"],"grand_total":item["grand_total"]});
                    allPayerIds.push(item["_id"]["id"]);
                    callbk();
                }, function() {
                    //console.log(allPayerArr); console.log(allPayerIds);
                    Ezpaypaymenttransactions.app.models.ezpayPayees.find({
                        "where": {
                            "payeeId": {
                                "inq": allPayerIds
                            }
                        }
                    }).then(allPayers => {
                        //let resultArr = [allPayers, allPayerArr].reduce((a, b) => a.map((c, i) => Object.assign({}, c, b[i])));
                        //let resultArr = mergeRecursive(allPayers,allPayerArr);
                        let tmpArr = [];
                        let tmpObj = {};
                        allPayers = JSON.parse(JSON.stringify(allPayers));
                        async.each(allPayers, function(itemP, cllbk) {
                            tmpObj = {};
                            tmpObj = itemP;
                            tmpObj["totalAmount"] = allPayerArr[itemP["payeeId"]];
                            tmpArr.push(tmpObj);
                            cllbk();
                        }, function() {

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
            }, ],
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
        ], function(err, cursor) {
            if (err) {
                cb(new HttpErrors.InternalServerError(err, {
                    expose: false
                }));
            } else {

                let retJson = {
                    "amountPending": "0.00",
                    "totalCollections": "0.00"
                };

                async.each(cursor, function(item, callbk) {
                    if (item["_id"]["transactionStatus"] == PAYMENT_TERMS["DONE"] || item["_id"]["transactionStatus"] == PAYMENT_TERMS["PAID"]) {
                        retJson["totalCollections"] = item["grand_total"]
                    }
                    if (item["_id"]["transactionStatus"] == PAYMENT_TERMS["PENDING"]) {
                        retJson["amountPending"] = item["grand_total"];
                    }
                    callbk();

                }, function() {
                    cb(null, retJson);
                });


            }
        });

    }


    Ezpaypaymenttransactions.remoteMethod(
        'getProjectTransactionStats', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide project transaction details"],
            accepts: [
                {
                    arg: 'merchantId',
                    type: 'string',
                    required: true,
                    http: {
                        source: 'query'
                    }
                }, 
                {
                    arg: 'projectId',
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

    Ezpaypaymenttransactions.getProjectTransactionStats = (merchantId,projectId, cb) => {

        var rewardCollection = Ezpaypaymenttransactions.getDataSource().connector.collection(Ezpaypaymenttransactions.modelName);
        var cursorTest = rewardCollection.aggregate([{
                $match: {
                    $and: [{"merchantId": merchantId},{"projectId": convertObjectIdToString(projectId)}]
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
        ], function(err, cursor) {
            if (err) {
                cb(new HttpErrors.InternalServerError(err, {
                    expose: false
                }));
            } else {

                let retJson = {
                    "amountPending": "0.00",
                    "totalCollections": "0.00"
                };

                async.each(cursor, function(item, callbk) {
                    if (item["_id"]["transactionStatus"] == PAYMENT_TERMS["DONE"] || item["_id"]["transactionStatus"] == PAYMENT_TERMS["PAID"]) {
                        retJson["totalCollections"] = item["grand_total"]
                    }
                    if (item["_id"]["transactionStatus"] == PAYMENT_TERMS["PENDING"]) {
                        retJson["amountPending"] = item["grand_total"];
                    }
                    callbk();

                }, function() {
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
            }, ],
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
                    }, ]
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
        ], function(err, cursor) {
            if (err) {
                cb(new HttpErrors.InternalServerError(err, {
                    expose: false
                }));
            } else {

                let retJson = {
                    "amountPending": "0.00",
                    "totalCollections": "0.00"
                };

                async.each(cursor, function(item, callbk) {
                    if (item["_id"]["transactionStatus"] == PAYMENT_TERMS["DONE"] || item["_id"]["transactionStatus"] == PAYMENT_TERMS["PAID"]) {
                        retJson["totalCollections"] = item["grand_total"]
                    }
                    if (item["_id"]["transactionStatus"] == PAYMENT_TERMS["PENDING"]) {
                        retJson["amountPending"] = item["grand_total"];
                    }
                    callbk();

                }, function() {
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
                "transactionStatus": PAYMENT_TERMS["PAID"],
                "metaData": data,
                "isActive": true,
                "createdAt": new Date()
            };

            if(!isNull(data["projectId"])){
                //
                savePayment["projectId"] = convertObjectIdToString(data["projectId"]);
            }
            funCreateTransactionAndRedirect(savePayment, res, redirectUrl);
        } else {
            let savePayment = {
                "merchantId": merchantId,
                "payerId": payeeInfo["payerId"],
                "totalAmount": parseFloat(data["amount"]),
                "isRecurring": false,
                "payableDate": new Date(),
                "transactionStatus": PAYMENT_TERMS["FAILED"],
                "metaData": data,
                "isActive": true,
                "createdAt": new Date()
            };

            if(!isNull(data["projectId"])){
                savePayment["projectId"] = convertObjectIdToString(data["projectId"]);
            }
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
                {
                    arg: 'projectId',
                    type: 'string',
                    required: false,
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


    Ezpaypaymenttransactions.receivePayUWebhooks = (data, redirectUrl, merchantId, res,projectId, next) => {

        if(!isNull(projectId)){
            data["projectId"] = projectId;
        }

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
                    "paymentMethod": PAYMENT_TERMS["CREDIT_CARD"],
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
            accepts: [{
                    arg: 'successUrl',
                    type: 'string',
                    required: false,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'failureUrl',
                    type: 'string',
                    required: false,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'transactionId',
                    type: 'string',
                    required: false,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'order_id',
                    type: 'string',
                    required: false,
                    http: {
                        source: 'query'
                    }
                },
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
                }, {
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

    function funEncodeBase64Str(str) {
        return (new Buffer(str)).toString('base64');
    }

    function funDecodeBase64Str(encoded_str) {
        return (new Buffer(encoded_str, 'base64')).toString();
    }

    //https://stackoverflow.com/questions/2820249/base64-encoding-and-decoding-in-client-side-javascript

    Ezpaypaymenttransactions.receiveOpenEdgeWebhooks = (successUrl, failureUrl, transactionId, order_id, response_code, secondary_response_code, response_code_text, res, cb) => {

        successUrl = funDecodeBase64Str(successUrl);
        failureUrl = funDecodeBase64Str(failureUrl);

        let gatewayResponse = {
            "order_id": order_id,
            "response_code": response_code,
            "secondary_response_code": secondary_response_code,
            "response_code_text": response_code_text
        }

        let paymentStatus = PAYMENT_TERMS["FAILED"];
        if (parseInt(response_code) == 1 || response_code == "1") {
            paymentStatus = PAYMENT_TERMS["PAID"];
        }

        Ezpaypaymenttransactions.findById(transactionId).then(transactionInfo => {
            if (transactionInfo !== null) {

                //DO AUTOMATIC PAYMENT from saved card
                Ezpaypaymenttransactions.getOrderDetails({
                    "order_id": order_id
                }, function(err, response) {
                    if (err) {

                    } else {

                        let insertJson = {
                            "payerId": transactionInfo["payerId"],
                            "order_id": order_id,
                            "payer_identifier": response["payer_identifier"],
                            "expire_month": response["expire_month"],
                            "expire_year": response["expire_year"],
                            "span": response["span"],
                            "card_brand": response["card_brand"],
                            "card_type": response["card_type"],
                            "gatewayResponse": response
                        };

                        transactionInfo.updateAttributes({"gatewayResponse":gatewayResponse}).then(successInfo=>{

                            Ezpaypaymenttransactions.app.models.savedCardsMetaData.addEditUserCards(insertJson, function(err, cardRes) {
                                if (err) {

                                } else {
                                    //Auto Payment
                                    let _am = transactionInfo["totalAmount"];
                                    let _ir = false;
                                    let _ip = false;
                                    let _ts = PAYMENT_TERMS["PAID"];
                                    switch (transactionInfo["paymentFrequency"]) {
                                        case PAYMENT_TERMS["INSTALLMENTS"]:
                                            _am = transactionInfo["downPayment"];
                                            _ip = true;
                                            _ts = PAYMENT_TERMS["PARTIALLY_PAID"];
                                            break;
                                        case PAYMENT_TERMS["RECURRING"]:
                                            _am = transactionInfo["downPayment"];
                                            _ir = true;
                                            _ts = PAYMENT_TERMS["PARTIALLY_PAID"];
                                            break;
                                    }

                                    cardRes["amount"] = _am;
                                    let pymentStatus = PAYMENT_TERMS["FAILED"];
                                    //console.log("cardRes==>"+JSON.stringify(cardRes))
                                    Ezpaypaymenttransactions.paymentWithSavedCard(cardRes, function(err, successRes) {
                                        // Ezpaypaymenttransactions.paymentWithSavedCard(cardRes).then(successRes=>{
                                        if (err) {
                                            //res.redirect(failureUrl);
                                            
                                            _ts = PAYMENT_TERMS["FAILED"];
                                        } else {
                                            pymentStatus = PAYMENT_TERMS["PAID"];
                                        }
                                        //now redirect
                                        let savePayment = {
                                            "merchantId": transactionInfo.merchantId,
                                            "payerId": transactionInfo.payerId,
                                            "isRecurring": _ir,
                                            "isPartial": _ip,
                                            "transactionStatus": _ts,
                                            "gatewayResponse": gatewayResponse
                                        };
                                        if (_ts != PAYMENT_TERMS["FAILED"]) {
                                            
                                            savePayment["totalAmountPaid"] = parseFloat(_am);
                                            savePayment["totalAmountPending"] = (parseFloat(transactionInfo["totalAmount"]) - parseFloat(_am));
                                        }
                                        savePayment["paymentDate"] = new Date();

                                        funUpsertTransaction(pymentStatus,transactionInfo,cardRes["amount"],gatewayResponse);

                                        transactionInfo.updateAttributes(savePayment).then(updatedTransaction => {

                                            if (updatedTransaction.transactionStatus == PAYMENT_TERMS['PAID'] || updatedTransaction.transactionStatus == PAYMENT_TERMS['PARTIALLY_PAID']) {
                                                res.redirect(successUrl);
                                            } else {
                                                res.redirect(failureUrl);
                                            }

                                        }).catch(error => {
                                            //res.redirect(failureUrl);
                                        });


                                    });
                                }
                            });

                        })
                    }
                });
            }
        });
    }

    function funUpsertTransaction(pymentStatus,transactionInfo,amount,metaData){

        Ezpaypaymenttransactions.app.models.PaymentInstallments.findOne({"where":{"refTransactionId":transactionInfo["transactionId"],"installmentLabel":"FULL_PAYMENT"}}).then(installInfo=>{
            if(isValidObject(installInfo)){
                //update
                installInfo.updateAttributes({"paymentTransactionDate":new Date(),"paymentStatus":paymentStatus,"metaData":metaData}).then(update=>{

                });
            }else{
                let insertJson = {
                    "refTransactionId": transactionInfo["transactionId"],
                    "merchantId": transactionInfo["merchantId"],
                    "payerId": transactionInfo["payerId"],
                    "installmentLabel":"FULL_PAYMENT",
                    "amount": parseFloat(amount),
                    "paymentStatus": pymentStatus ,
                    "metaData":metaData,
                    "createdAt": new Date(),
                    "isActive":true
                };
                if(!isNull(transactionInfo["payableDate"])){
                    insertJson["dueDate"]= new Date(transactionInfo["payableDate"]);
                }

                Ezpaypaymenttransactions.app.models.PaymentInstallments.create(insertJson).then(success=>{

                });
            }
        })
        
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
            }, ],
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

            if (sdkResponse.response_code == 1) {

                let savePayment = {
                    "merchantId": _payload["merchantId"],
                    "payerId": _payload["payerId"],
                    "totalAmount": parseFloat(_payload["amount"]),
                    "isRecurring": false,
                    "payableDate": new Date(),
                    "transactionStatus": PAYMENT_TERMS["REFUND"],
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
            } else {
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
            accepts: [{
                    arg: 'successUrl',
                    type: 'string',
                    required: false,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'failureUrl',
                    type: 'string',
                    required: false,
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
                    arg: 'payerId',
                    type: 'string',
                    required: false,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'order_id',
                    type: 'string',
                    required: false,
                    http: {
                        source: 'query'
                    }
                },
                {
                    arg: 'response_code',
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


    Ezpaypaymenttransactions.receiveCardDataOE = (successUrl, failureUrl, merchantId, payerId, order_id, response_code, res, cb) => {

        successUrl = funDecodeBase64Str(successUrl);
        failureUrl = funDecodeBase64Str(failureUrl);

        Ezpaypaymenttransactions.getOrderDetails({
            "order_id": order_id
        }, function(err, response) {
            if (err) {
                let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                cb(new HttpErrors.InternalServerError(_msg, {
                    expose: false
                }));

            } else {

                let insertJson = {
                    "payerId": payerId,
                    "order_id": order_id,
                    "payer_identifier": response["payer_identifier"],
                    "expire_month": response["expire_month"],
                    "expire_year": response["expire_year"],
                    "span": response["span"],
                    "card_brand": response["card_brand"],
                    "card_type": response["card_type"],
                    "gatewayResponse": response
                };

                Ezpaypaymenttransactions.app.models.savedCardsMetaData.addEditUserCards(insertJson, function(err, cardRes) {
                    if (err) {
                        console.log("error");
                        res.redirect(failureUrl);
                    } else {
                        console.log("corrct");
                        if (parseInt(response_code) == 1) {
                            res.redirect(successUrl);
                        } else {
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
            accepts: [{
                arg: 'paymentInfo',
                type: 'object',
                'http': {
                    'source': 'body'
                },
                'required': false
            }, ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.paymentWithSavedCard = function(paymentInfo, cb) {

        // Ezpaypaymenttransactions.paymentWithSavedCard = (paymentInfo, cb) => {
        if (!isNull(paymentInfo["meta"])) {
            paymentInfo = paymentInfo["meta"];
        }

        console.log("paymentInfo=="+JSON.stringify(paymentInfo));

        Ezpaypaymenttransactions.app.models.savedCardsMetaData.findById(paymentInfo["cardId"]).then(cardInfo => {
            if (isValidObject(cardInfo)) {
                funPayWithSavedCard({
                    "cardInfo": cardInfo,
                    "paymentInfo": paymentInfo
                }).then(sdkResponse => {
                    if (parseInt(sdkResponse.response_code) == 1) {
                        cb(null, sdkResponse);
                    } else {
                        cb(new HttpErrors.InternalServerError(sdkResponse.response_code_text, {
                            expose: false
                        }));
                    }
                }).catch(error => {
                    let _msg = isNull(error["message"]) ? 'Internal Server Error' : error["message"];
                    cb(new HttpErrors.InternalServerError(_msg, {
                        expose: false
                    }));
                })
            } else {
                cb(new HttpErrors.InternalServerError("Invalid card Id.", {
                    expose: false
                }));
            }
        }).catch(error => {
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
            accepts: [{
                arg: 'orderData',
                type: 'object',
                'http': {
                    'source': 'body'
                },
                'required': false
            }, ],
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

        funGetOrderDetails({
            "order_id": _payload["order_id"]
        }).then(sdkResponse => {
            cb(null, sdkResponse);
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
            accepts: [{
                    arg: 'cardData',
                    type: 'object',
                    'http': {
                        'source': 'body'
                    },
                    'required': false
                },
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

    Ezpaypaymenttransactions.verifyCreditCardOE = (cardData, req, cb) => {

        let _payload = cardData;
        if (!isNull(cardData["meta"])) {
            _payload = cardData["meta"];
        }

        let url = funGetBaseUrl(_payload["hostBaseURL"], req);

        let successUrl = _payload.successUrl ? _payload.successUrl : '';
        let failureUrl = _payload.failureUrl ? _payload.failureUrl : '';

        let _surl = url + "/api/ezpayPaymentTransactions/receiveCardDataOE?successUrl=" + funEncodeBase64Str(successUrl) + "&merchantId=" + _payload.merchantId + "&failureUrl=" + funEncodeBase64Str(failureUrl) + "&payerId=" + _payload.payerId;
        _surl = funNormalizeStr(_surl);

        _payload["return_url"] = _surl;


        funVerifyCardOE({
            "paymentInfo": _payload
        }).then(sdkResponse => {
            console.log(sdkResponse);
            sdkResponse = JSON.parse(JSON.stringify(sdkResponse));
            cb(null, sdkResponse);


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
            accepts: [{
                arg: 'data',
                type: 'object',
                'http': {
                    'source': 'body'
                },
                'required': false
            }],
            returns: {
                type: 'object',
                root: true
            }
        }
    );
    //http://dev.getezpay.com:3010/api/ezpayPaymentTransactions/receiveCardDataOE?successUrl=aHR0cDovL2Rldi5nZXRlenBheS5jb20vP3N1Y2Nlc3M9dHJ1ZQ==&merchantId=22e47c6d-3d2a-4688-ad95-b75f1c1c4ed1&failureUrl=aHR0cDovL2Rldi5nZXRlenBheS5jb20vP3N1Y2Nlc3M9ZmFsc2U=&order_id=1551427510159&response_code=1&secondary_response_code=0&response_code_text=Successful%20transaction:%20The%20transaction%20completed%20successfully.

    Ezpaypaymenttransactions.dummyPayment = (data, cb) => {

        let json = {
             "transactionId": "a7d2e342-b0e1-44a8-9928-fdc20ff2c2af",
             "payerId": "fd9ee59d-7475-49cb-a15f-e6c70ef8240d",
            "cardType":"CREDIT_CARD", // or DEBIT_CARD - default is CREDIT_CARD
            "hostBaseURL":"http://localhost:3010/", //base url of the host where service apis are running
            "successUrl": "http://localhost:3010/success",   //redirection url should be an http or https url 
            "failureUrl": "http://localhost:3010/failure",   //should be an http or https url 
            "returnUrl":"http://localhost:3010/adad"  //should be an http or https url 
        };

        const processPayload = {
            'action': "PROCESS_PAYMENT",
            'meta': json
        };


        paymentObj.execute(processPayload, response => {
            console.log("response", response.status);
            console.log("response data", response.data);
            return cb(null, response.data);
        })
    }



    Ezpaypaymenttransactions.remoteMethod(
        'setTransactionStatusManually', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [
            {
                arg: 'transactionId', type: 'string', 'http': { 'source': 'query'}, 'required': true
            } ,
            {
                arg: 'transactionStatus', type: 'string', 'http': { 'source': 'query'}, 'required': true
            } 
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.setTransactionStatusManually = (transactionId,transactionStatus, cb) => {
        Ezpaypaymenttransactions.findById(transactionId).then(transInfo=>{
            if(isValidObject(transInfo)){
                if(PAYMENT_TERMS[transactionStatus] == transactionStatus){
                    transInfo.updateAttributes({"transactionStatus":transactionStatus}).then(update=>{
                        cb(null,{"success":true});
                    });
                }else{
                   cb(new HttpErrors.InternalServerError('Invalid Transaction Status.', {
                        expose: false
                    })); 
                } 
            }else{
                cb(new HttpErrors.InternalServerError('Invalid Transaction Id.', {
                    expose: false
                }));
            }
        }).catch(err=>{
            cb(new HttpErrors.InternalServerError('Error while fetching transaction info.', {
                expose: false
            }));
        })
    }


    Ezpaypaymenttransactions.remoteMethod(
        'getRevenueGraphData', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [
            {
                arg: 'merchantId', type: 'string', 'http': { 'source': 'query'}, 'required': true
            } ,
            {
                arg: 'year', type: 'number', 'http': { 'source': 'query'}, 'required': false
            } 
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Ezpaypaymenttransactions.getRevenueGraphData = (merchantId,year, cb) => {
        let _year_match = new Date().getFullYear();
        let _error = false;
        if(!isNull(year)){
            _year_match = year;
            if (String(year).length != 4) {
                _error = true;
                cb(new HttpErrors.InternalServerError('Year is not formmatted correctly.', {
                    expose: false
                }));
            }
            if (!(parseInt(year) > 0)) {
                _error = true;
                //console.log("qweqweqwerqwer")
                cb(new HttpErrors.InternalServerError('Year is not formmatted correctly.', {
                    expose: false
                }));
            }
        }

        if(_year_match && _error==false ){
            let monthObj = {"1":"Jan","2":"Feb","3":"Mar","4":"Apr","5":"May","6":"Jun","7":"Jul","8":"Aug","9":"Sep","10":"Oct","11":"Nov","12":"Dec"};
            let dummyResponse = [['Jan',0],['Feb',0],['Mar',0],['Apr',0],['May',0],['Jun',0],['Jul',0],['Aug',0],['Sep',0],['Oct',0],['Nov',0],['Dec',0]];
            
            var rewardCollection = Ezpaypaymenttransactions.getDataSource().connector.collection(Ezpaypaymenttransactions.app.models.PaymentInstallments.modelName);
            var cursorTest = rewardCollection.aggregate([
                {
                    $match: {
                        $and: [
                            { "merchantId": merchantId },
                            { "isActive": true },
                            { "paymentStatus": {"$in":["PAID","PARTIALLY_PAID"]} },
                            { "$expr": { "$eq": [{ "$year": "$paymentTransactionDate" }, _year_match] } }
                        ]
                    }
                },
                {
                    "$group": {
                        "_id": {
                            $month: "$paymentTransactionDate",
                        },
                        "totalRevenue": {
                            "$sum": "$amount"
                        },
                    }
                }
            ], function (err, res) {
                var async = require('async');
                var returnArr = [];
                if(!isNull(res)){
                    if(res.length > 0){
                        
                        async.each(res,function(item,clb){
                            let tmpArr = [];
                            tmpArr.push(monthObj[item["_id"]]);
                            tmpArr.push(item["totalRevenue"]);
                            returnArr.push(tmpArr);
                            clb();
                        },function(){
                            const array3 = dummyResponse.map(
                                array => array[0] === returnArr[0][0] ? returnArr[0] : array
                            );
                            cb(null, {"success":true,"data":array3});
                        });
                    }else{
                        cb(null, {"success":true,"data":dummyResponse});
                    }
                }else{
                    cb(null, {"success":true,"data":dummyResponse});
                }
            });
        }else{
            cb(new HttpErrors.InternalServerError('Year is not formmatted correctly.', {
                    expose: false
            }));
        }
    }



    Ezpaypaymenttransactions.remoteMethod(
        'getTransactionGraphData', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [
            {
                arg: 'merchantId', type: 'string', 'http': { 'source': 'query'}, 'required': true
            } ,
            {
                arg: 'year', type: 'number', 'http': { 'source': 'query'}, 'required': false
            } 
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    function groupBy(objectArray, property) {
      return objectArray.reduce(function (acc, obj) {
        var key = obj[property];
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(obj);
        return acc;
      }, {});
    }

    Ezpaypaymenttransactions.getTransactionGraphData = (merchantId,year, cb) => {
        let _year_match = new Date().getFullYear();
        let _error = false;
        if(!isNull(year)){
            _year_match = year;
            if (String(year).length != 4) {
                _error = true;
                cb(new HttpErrors.InternalServerError('Year is not formmatted correctly.', {
                    expose: false
                }));
            }
            if (!(parseInt(year) > 0)) {
                _error = true;
                //console.log("qweqweqwerqwer")
                cb(new HttpErrors.InternalServerError('Year is not formmatted correctly.', {
                    expose: false
                }));
            }
        }

        if(_year_match && _error==false ){
            let monthObj = {"1":"Jan","2":"Feb","3":"Mar","4":"Apr","5":"May","6":"Jun","7":"Jul","8":"Aug","9":"Sep","10":"Oct","11":"Nov","12":"Dec"};
            let dummyResponse = [['Jan',0,0,0],['Feb',0,0,0],['Mar',0,0,0],['Apr',0,0,0],['May',0,0,0],['Jun',0,0,0],['Jul',0,0,0],['Aug',0,0,0],['Sep',0,0,0],['Oct',0,0,0],['Nov',0,0,0],['Dec',0,0,0]];
            
            var rewardCollection = Ezpaypaymenttransactions.getDataSource().connector.collection(Ezpaypaymenttransactions.app.models.PaymentInstallments.modelName);
            var cursorTest = rewardCollection.aggregate([
                {
                    $match: {
                        $and: [
                            { "merchantId": merchantId },
                            { "isActive": true },
                            { "paymentStatus": {"$in":["PAID","PENDING","FAILED"]} },
                            { "$expr": { "$eq": [{ "$year": "$paymentTransactionDate" }, _year_match] } }
                        ]
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "month": { "$month": "$paymentTransactionDate"  },
                            "paymentStatus": "$paymentStatus"
                        },
                        "count": {
                            "$sum": "$amount"
                        },
                    }
                }
            ], function (err, res) {
                var async = require('async');
                var returnArr = [];

                if(!isNull(res)){
                    if(res.length > 0){
                            
                        //cb(null, {"success":true,"data":res});

                        async.each(res,function(item,clb){
                            let tmpArr = [];
                            //tmpArr.push(monthObj[item["_id"]["month"]]);
                            //tmpArr.push(item["totalRevenue"]);
                            let tmpObj = {"month":item["_id"]["month"] ,"count": item["count"],"transactionStatus": item["_id"]["paymentStatus"] };
                            //returnArr[item["_id"]["month"]] = [];
                            //returnArr[item["_id"]["month"]].push(tmpObj);
                            returnArr.push(tmpObj);
                            
                            clb();
                        },function(){
                            returnArr = returnArr.sort((a, b) => (a["transactionStatus"] > b["transactionStatus"]) ? 1 : -1);
                            console.log(returnArr);
                            let groupedResult = groupBy( returnArr,'month' );
                            let combinedResults = [];
                            async.forEachOf(groupedResult, function(item, key, callback){
                                let tmpArr = [];
                                tmpArr.push(monthObj[key]);
                                if (!(item.filter(function(e) { return e["transactionStatus"] === PAYMENT_TERMS["PAID"]; }).length > 0)) {
                                    item.push({"month": key,"count":0,"transactionStatus": PAYMENT_TERMS["PAID"] });
                                }
                                // if (!(item.filter(function(e) { return e["transactionStatus"] === PAYMENT_TERMS["PARTIALLY_PAID"]; }).length > 0)) {
                                //     item.push({"month": key,"count":0,"transactionStatus": PAYMENT_TERMS["PARTIALLY_PAID"] });
                                // }
                                if (!(item.filter(function(e) { return e["transactionStatus"] === PAYMENT_TERMS["FAILED"]; }).length > 0)) {
                                    item.push({"month": key,"count":0,"transactionStatus": PAYMENT_TERMS["FAILED"] });
                                }
                                if (!(item.filter(function(e) { return e["transactionStatus"] === PAYMENT_TERMS["PENDING"]; }).length > 0)) {
                                    item.push({"month": key,"count":0,"transactionStatus": PAYMENT_TERMS["PENDING"] });
                                }
                                

                                async.each(item,function(innerItem,clbk){
                                    switch(innerItem["transactionStatus"]){
                                        case PAYMENT_TERMS["PAID"]:
                                        case PAYMENT_TERMS["PARTIALLY_PAID"]:
                                        case PAYMENT_TERMS["PENDING"]:
                                        case PAYMENT_TERMS["FAILED"]:
                                            tmpArr.push(innerItem["count"]);
                                        break;
                                        default:
                                            tmpArr.push(0);
                                        break;
                                    }
                                    
                                    clbk();
                                },function(){
                                    combinedResults.push(tmpArr);
                                    callback();
                                });
                            }, function(err){
                                const array3 = dummyResponse.map(
                                    array => array[0] === combinedResults[0][0] ? combinedResults[0] : array
                                );
                                cb(null, {"success":true,"data": array3  });
                            });
                            
                        });
                    }else{
                        cb(null, {"success":true,"data":dummyResponse});
                    }
                }else{
                    cb(null, {"success":true,"data":dummyResponse});
                }
            });
        }else{
            cb(new HttpErrors.InternalServerError('Year is not formmatted correctly.', {
                    expose: false
            }));
        }
    }


};