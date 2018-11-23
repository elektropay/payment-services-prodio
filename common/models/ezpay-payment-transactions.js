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

const isNull = function(val) {
    if (typeof val === 'string') {
        val = val.trim();
    }
    if (val === undefined || val === null || typeof val === 'undefined' || val === '' || val === 'undefined') {
        return true;
    }
    return false;
};

module.exports = function(Ezpaypaymenttransactions) {

	Ezpaypaymenttransactions.remoteMethod(
          'requestPayment', {
               http: { verb: 'post' },
               description: ["This request will initiate a payment request transaction"],
               accepts: [
               	{ arg: 'merchantId',type: 'string',required: true,http: { source: 'query' }},
               	{ arg: 'paymentInfo',type: 'object', required: true, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypaymenttransactions.requestPayment = (merchantId,paymentInfo, cb) => {
        if (!isNull(paymentInfo["meta"])) {
            paymentInfo = paymentInfo["meta"];
        }

		const paymentDetails = {
					currency:"USD",
					isRecurring:false,
					dueDate:"MM/DD/YYYY",
				    total: {
				        label: "My Merchant",
				        amount: { value: parseFloat(paymentInfo["amount"]), currency: "USD" },
				    },
				    displayItems: [
					    {
					        label: "Tax",
					        amount: { value: "2.50", currency: "USD" },
					    }, 
					    {
					        label: "Ground Shipping",
					        amount: { value: "5.00", currency: "USD" },
					    }
				    ],
				    data: { paymentMethodType: "debit" },
				};

		let totalAmount = paymentDetails["total"]["amount"]["value"];

		let savePayment = {
			"merchantId": merchantId,
			"payerId": paymentInfo["payerId"] ,
			"totalAmount": parseFloat(paymentInfo["amount"]) ,
			"isRecurring": paymentInfo["isRecurring"] ,
			"payableDate": paymentInfo["payableDate"] ,
			"transactionStatus":"PENDING",
			"metaData": paymentDetails,
			"isActive":true,
			"createdAt": new Date()
		};


		Ezpaypaymenttransactions.create(savePayment).then(transactionInfo=>{
			cb(null,{"success":true,"transactionId":transactionInfo["transactionId"]});
		}).catch(error=>{
			cb(new HttpErrors.InternalServerError('Error while creating new payment transaction.', { expose: false }));
		});
	}


	Ezpaypaymenttransactions.remoteMethod(
          'processPayment', {
               http: { verb: 'post' },
               description: ["This request will initiate a payment request transaction"],
               accepts: [
               	{ arg: 'transactionId',type: 'string',required: true,http: { source: 'query' }},
               	{ arg: 'payerId',type: 'string',required: true,http: { source: 'query' }},
               	{ arg: 'cardId',type: 'string',required: false,http: { source: 'query' }},
               	{ arg: 'cardInfo',type: 'object', required: false, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypaymenttransactions.processPayment = (transactionId,payerId,cardId,cardInfo, cb) => {
		if (!isNull(cardInfo["meta"])) {
            cardInfo = cardInfo["meta"]["cardInfo"];
        }

        Ezpaypaymenttransactions.app.models.ezpayPayees.findById(payerId).then(payeeInfo=>{
           if(isValidObject(payeeInfo)){
                Ezpaypaymenttransactions.findById(transactionId).then(transInfo=>{
                     if(isValidObject(transInfo)){
                          transInfo.updateAttributes({"transactionStatus":"PAID","paymentDate":new Date()}).then(updatedCount=>{
                               cb(null,{"success":true});
                          }).catch(error=>{
                               cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
                          });
                     }else{
                          cb(new HttpErrors.InternalServerError('Invalid Transaction ID.', { expose: false }));
                     }
                }).catch(error=>{
                     cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
                });
           }else{
                cb(new HttpErrors.InternalServerError('Invalid Payee ID.', { expose: false }));
           }
      }).catch(error=>{
           cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
      });
	}


	Ezpaypaymenttransactions.remoteMethod(
          'getTransactionsListing', {
               http: { verb: 'post' },
               description: ["This request will initiate a payment request transaction"],
               accepts: [
               	{ arg: 'merchantId',type: 'string',required: true,http: { source: 'query' }},
               	{ arg: 'pageNo',type: 'string',required: true,http: { source: 'query' }},
               	{ arg: 'filterCriteria',type: 'object', required: false, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypaymenttransactions.getTransactionsListing = (merchantId,pageNo,filterCriteria, cb) => {
		if (!isNull(filterCriteria["meta"])) {
            filterCriteria = filterCriteria["meta"]["filterCriteria"];
        }

        Ezpaypaymenttransactions.find({"where":{"merchantId":merchantId},"include":[{relation:'Payer'}],"order":"createdAt desc"}).then(transactions=>{
        	if(isValidObject(transactions)){
        		cb(null,transactions);
        	}else{
        		cb(null,transactions);
        	}
        }).catch(error=>{
        	cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
        })
	}

	
	Ezpaypaymenttransactions.remoteMethod(
          'getNonPayersListing', {
               http: { verb: 'post' },
               description: ["This request will initiate a payment request transaction"],
               accepts: [
               	{ arg: 'merchantId',type: 'string',required: true,http: { source: 'query' }},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypaymenttransactions.getNonPayersListing = (merchantId, cb) => {
		
        Ezpaypaymenttransactions.find({"where":{"merchantId":merchantId,"transactionStatus":"PENDING"},"include":[{relation:'Payer'}],"order":"createdAt desc"}).then(transactions=>{
        	if(isValidObject(transactions)){
        		cb(null,transactions);
        	}else{
        		cb(null,transactions);
        	}
        }).catch(error=>{
        	cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
        })
	}


	Ezpaypaymenttransactions.remoteMethod(
          'getTransactionDetails', {
               http: { verb: 'post' },
               description: ["This request will provide transaction details"],
               accepts: [
               	{ arg: 'transactionId',type: 'string',required: true,http: { source: 'query' }},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypaymenttransactions.getTransactionDetails = (transactionId, cb) => {
		console.log("transactionId=>"+transactionId)
		Ezpaypaymenttransactions.findOne({"where":{"transactionId":transactionId},"include":[{relation:'Payer'},{relation:'Merchant'}]}).then(transObj=>{
	       if(isValidObject(transObj)){
	            cb(null,transObj);
	       } else {
	            cb(new HttpErrors.InternalServerError('Invalid transaction ID.', { expose: false }));
	       }
	    }).catch(error=>{
	         cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
	    });
	}


	Ezpaypaymenttransactions.remoteMethod(
          'getTransactionStats', {
               http: { verb: 'post' },
               description: ["This request will provide transaction details"],
               accepts: [
               	{ arg: 'merchantId',type: 'string',required: true,http: { source: 'query' }},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypaymenttransactions.getTransactionStats = (merchantId, cb) => {

		var rewardCollection = Ezpaypaymenttransactions.getDataSource().connector.collection(Ezpaypaymenttransactions.modelName);
        var cursorTest = rewardCollection.aggregate([
            {
                $match: {
                    $and: [
                        {"merchantId": merchantId},
                    ]
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
        ],function(err,cursor){
        	if(err){
        		cb(new HttpErrors.InternalServerError(err, { expose: false }));
        	}else{
        		
        		let retJson = {"amountPending":"0.00","totalCollections":"0.00"};

        		async.each(cursor,function(item,callbk){
        			if(item["_id"]["transactionStatus"]=="DONE"){
        				retJson["totalCollections"] = item["grand_total"]
        			}
        			if(item["_id"]["transactionStatus"]=="PENDING"){
        				retJson["amountPending"] = item["grand_total"];
        			}
        			callbk();
        			
        		},function(){
        			cb(null,retJson);
        		});
        		
        		
        	}
        });

        

	}





};
