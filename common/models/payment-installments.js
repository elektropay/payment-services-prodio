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

    Paymentinstallments.addNewInstallment = (installmentData,req, cb) => {
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

    Paymentinstallments.editInstallment = (installmentData,req, cb) => {
    	Paymentinstallments.findById(installmentData["installmentId"]).then(installInfo=>{
    		if(isValidObject(installInfo)){
    			let updateJson = {
			            "refTransactionId":installmentData["transactionId"],
			            "installmentLabel": installmentData["installmentLabel"],
			            "amount":installmentData["amount"],
			            "dueDate":new Date(installmentData["dueDate"]+ "02:00"),
			            "paymentStatus":installmentData["paymentStatus"],
			            "metaData":installmentData["metaData"]
			        };
    			installInfo.updateAttributes(updateJson).then(updateInfo=>{
    				//TODO: Update agenda
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

    Paymentinstallments.removeInstallment = (installmentData,req, cb) => {
    	Paymentinstallments.findById(installmentData["installmentId"]).then(installInfo=>{
    		if(isValidObject(installInfo)){
    			Paymentinstallments.removeById(installmentData["installmentId"]).then(data=>{
    				//TODO: cancel event
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
    }

};
