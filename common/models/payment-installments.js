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
    isNull
} = require('../../utility/helper');

const {
    paymentAdapter, schedular
} = require('../../server/moduleImporter');

const {PAYMENT_TERMS} = require('../../server/constant');

module.exports = function(Paymentinstallments) {

	Paymentinstallments.remoteMethod(
        'addNewInstallment', {
            http: {
                verb: 'post'
            },
            description: ["This request will add new installment withing the transaction"],
            accepts: [
            {
                arg: 'installmentData',
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

    function funScheduleJob(transInfo,hostBaseURL,req){
        let url = funGetBaseUrl(hostBaseURL,req);
        let _surl = url + "/api/ezpayPaymentTransactions/autoDeductPayment";
        _surl = funNormalizeStr(_surl);

        let evenObj = {"jobTitle":transInfo["installmentLabel"],"jobId":transInfo["installmentId"],"hostBaseURL":hostBaseURL,"apiUrl":_surl,"triggerAt": transInfo["dueDate"],"refTransactionId":transInfo["refTransactionId"]} 
        schedular.setEvent(evenObj);
        console.log("scheduling done..."+new Date(transInfo["dueDate"]));
    }

    Paymentinstallments.addNewInstallment = (installmentData,req, cb) => {

    	if (!isNull(installmentData["meta"])) { installmentData = installmentData["meta"]; }

    	let saveJson = {
            "refTransactionId":installmentData["transactionId"],
            "installmentLabel": installmentData["installmentLabel"],
            "amount":installmentData["amount"],
            "dueDate":new Date(installmentData["dueDate"]+ "02:00"),
            "paymentType":PAYMENT_TERMS["INSTALLMENT"],
            "paymentStatus":installmentData["paymentStatus"],
            "metaData":installmentData["metaData"],
            "createdAt": new Date()
        };

        Paymentinstallments.create(saveJson).then(transInfo=>{
            //TODO : Use agenda and set event
            funScheduleJob(transInfo,installmentData["hostBaseURL"],req);
            cb(null,{"success":true,"data": transInfo});
        }).catch(err=>{
            console.log(err);
            cb(new HttpErrors.InternalServerError('Error while creating new payment installment.', {
                expose: false
            }));
        });
    }

    Paymentinstallments.remoteMethod(
        'editInstallment', {
            http: {
                verb: 'post'
            },
            description: ["This request will add new installment withing the transaction"],
            accepts: [
            {
                arg: 'installmentData',
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
                    return ctx.req;
                }
            }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Paymentinstallments.editInstallment = (installmentData,req, cb) => {
    	if (!isNull(installmentData["meta"])) { installmentData = installmentData["meta"]; }

    	Paymentinstallments.findById(installmentData["installmentId"]).then(installInfo=>{
    		if(isValidObject(installInfo)){
    			let updateJson = {
			            "refTransactionId":installmentData["transactionId"],
			            "installmentLabel": installmentData["installmentLabel"],
			            "amount":installmentData["amount"],
			            "dueDate":new Date(installmentData["dueDate"]+" 02:00"),
			            "paymentStatus":installmentData["paymentStatus"],
			            "metaData":installmentData["metaData"]
			        };
			        //console.log(updateJson)
    			installInfo.updateAttributes(updateJson).then(updateInfo=>{
    				//TODO: Update agenda
    				schedular.rescheduleEvent(installmentData["installmentId"],updateJson);
    				cb(null,{"success":true,"data": updateInfo});
    			});
    		}else{
    			cb(new HttpErrors.InternalServerError('Installment info not exists.', {
	                expose: false
	            }));
    		}
    	}).catch(err=>{
    		cb(new HttpErrors.InternalServerError('Error while fetching installment info.', {
                expose: false
            }));
    	})
    }


    Paymentinstallments.remoteMethod(
        'editMultipleInstallments', {
            http: {
                verb: 'post'
            },
            description: ["This request will add new installment withing the transaction"],
            accepts: [
            {
                arg: 'installmentData',
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
                    return ctx.req;
                }
            }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Paymentinstallments.editMultipleInstallments = (installmentData,req, cb) => {
        if (!isNull(installmentData["meta"])) { installmentData = installmentData["meta"]; }
        let approvedFor = []; let failedFor = [];

        Paymentinstallments.app.models.ezpayPaymentTransactions.findById(installmentData["transactionId"]).then(transInfo=>{
            if(isValidObject(transInfo)){

                async.each(installmentData["installments"],function(item,clb){
                    Paymentinstallments.findById(item["installmentId"]).then(installInfo=>{
                        if(isValidObject(installInfo)){
                            let updateJson = {
                                    "refTransactionId":installInfo["transactionId"],
                                    "installmentLabel": item["installmentLabel"],
                                    "amount":item["amount"],
                                    "dueDate":new Date(item["dueDate"]+" 02:00"),
                                    "paymentStatus":item["paymentStatus"],
                                    "metaData":item["metaData"]
                                };
                                //console.log(updateJson)
                            installInfo.updateAttributes(updateJson).then(updateInfo=>{
                                //TODO: Update agenda
                                approvedFor.push(item["installmentId"]);
                                schedular.rescheduleEvent(item["installmentId"],updateJson);
                                clb();
                            });
                        }else{
                            failedFor.push(item["installmentId"]);
                            clb();
                        }
                    }).catch(err=>{
                        failedFor.push(item["installmentId"]);
                        clb();
                    });
                },function(){
                    cb(null,{"success":true,"approvedFor":approvedFor,"failedFor":failedFor});
                });
                
            }else{
                cb(new HttpErrors.InternalServerError('Invalid transaction Id.', {
                     expose: false
                }));
            }
        }).catch(err=>{
            cb(new HttpErrors.InternalServerError('Error while fetching transaction info.', {
                        expose: false
            }));
        });
        
    }


    Paymentinstallments.remoteMethod(
        'removeInstallment', {
            http: {
                verb: 'post'
            },
            description: ["This request will add new installment withing the transaction"],
            accepts: [
            {
                arg: 'installmentData',
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
                    return ctx.req;
                }
            }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Paymentinstallments.removeInstallment = (installmentData,req, cb) => {
    	if (!isNull(installmentData["meta"])) { installmentData = installmentData["meta"]; }

        Paymentinstallments.app.models.ezpayPaymentTransactions.findById(installmentData["transactionId"]).then(transInfo=>{
            if(isValidObject(transInfo)){
                Paymentinstallments.findById(installmentData["installmentId"]).then(installInfo=>{
                    if(isValidObject(installInfo)){
                        Paymentinstallments.removeById(installmentData["installmentId"]).then(data=>{
                            //TODO: cancel event
                            schedular.cancelEvent(installmentData["installmentId"]);
                            cb(null,{"success":true,"data": data});
                        }).catch(err=>{
                            cb(new HttpErrors.InternalServerError('Error while removing installment.', {
                                expose: false
                            }));
                        });
                    }else{
                        cb(new HttpErrors.InternalServerError('Installment info not exists.', {
                            expose: false
                        }));
                    }
                }).catch(err=>{
                    cb(new HttpErrors.InternalServerError('Error while fetching installment info.', {
                        expose: false
                    }));
                })
            }else{
                cb(new HttpErrors.InternalServerError('Invalid transaction Id.', {
                     expose: false
                }));
            }
        }).catch(err=>{
            cb(new HttpErrors.InternalServerError('Error while fetching transaction info.', {
                        expose: false
            }));
        })
    	
    }


    Paymentinstallments.remoteMethod(
        'disbleInstallments', {
            http: {
                verb: 'post'
            },
            description: ["This request will add new installment withing the transaction"],
            accepts: [
            {
                arg: 'installmentData',
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
                    return ctx.req;
                }
            }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Paymentinstallments.disbleInstallments = (installmentData,req, cb) => {
        if (!isNull(installmentData["meta"])) { installmentData = installmentData["meta"]; }
        let returnObj = {"success":true,"data":{"approvedFor":[],"failedFor":[]}};
        Paymentinstallments.app.models.ezpayPaymentTransactions.findById(installmentData["transactionId"]).then(transInfo=>{
            if(isValidObject(transInfo)){
                async.each(installmentData["installmentIds"],function(item,clb){
                    Paymentinstallments.findById(item).then(installInfo=>{
                        if(isValidObject(installInfo)){
                            installInfo.updateAttributes({"isActive":false}).then(updateInfo=>{
                                returnObj["data"]["approvedFor"].push(item);
                                schedular.cancelEvent(item);
                                clb();
                            });
                        }else{
                            returnObj["data"]["failedFor"].push(item);
                            clb();
                        }
                    }).catch(err=>{
                        returnObj["data"]["failedFor"].push(item);
                        clb();
                    });
                },function(){
                    cb(null,returnObj);
                })
            }else{
                cb(new HttpErrors.InternalServerError('Invalid Transaction Id.', {
                    expose: false
                }));
            }
        }).catch(err=>{
            cb(new HttpErrors.InternalServerError('Error while fetching transaction info.', {
                expose: false
            }));
        });
    }


    Paymentinstallments.remoteMethod(
        'enableInstallments', {
            http: {
                verb: 'post'
            },
            description: ["This request will add new installment withing the transaction"],
            accepts: [
            {
                arg: 'installmentData',
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
                    return ctx.req;
                }
            }
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    Paymentinstallments.enableInstallments = (installmentData,req, cb) => {
        if (!isNull(installmentData["meta"])) { installmentData = installmentData["meta"]; }
        let returnObj = {"success":true,"data":{"approvedFor":[],"failedFor":[]}};
        Paymentinstallments.app.models.ezpayPaymentTransactions.findById(installmentData["transactionId"]).then(transInfo=>{
            if(isValidObject(transInfo)){
                async.each(installmentData["installmentIds"],function(item,clb){
                    Paymentinstallments.findById(item).then(installInfo=>{
                        if(isValidObject(installInfo)){
                            installInfo.updateAttributes({"isActive":true}).then(updateInfo=>{
                                returnObj["data"]["approvedFor"].push(item);
                                funScheduleJob(installInfo,installmentData["hostBaseURL"],req);
                                clb();
                            });
                        }else{
                            returnObj["data"]["failedFor"].push(item);
                            clb();
                        }
                    }).catch(err=>{
                        returnObj["data"]["failedFor"].push(item);
                        clb();
                    });
                },function(){
                    cb(null,returnObj);
                })
            }else{
                cb(new HttpErrors.InternalServerError('Invalid Transaction Id.', {
                    expose: false
                }));
            }
        }).catch(err=>{
            cb(new HttpErrors.InternalServerError('Error while fetching transaction info.', {
                expose: false
            }));
        });
    }


};
