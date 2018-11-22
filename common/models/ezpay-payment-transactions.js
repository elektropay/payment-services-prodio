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
               	{ arg: 'merchantId',type: 'string',required: true},
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
			"payeeId": paymentInfo["payerId"] ,
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


};
