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

module.exports = function(Ezpaypaymenttransactions) {

	Ezpaypaymenttransactions.remoteMethod(
          'requestPayment', {
               http: { verb: 'post' },
               description: ["This request will initiate a payment request transaction"],
               accepts: [
               	{ arg: 'merchantId',type: 'string',required: true},
                { arg: 'payeeId',type: 'string',required: true},
               	{ arg: 'paymentInfo',type: 'object', required: true, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypaymenttransactions.requestPayment = (merchantId,payeeId,paymentInfo, cb) => {
		const paymentDetails = {
					currency:"USD",
					isRecurring:false,
					dueDate:"MM/DD/YYYY",
				    total: {
				        label: "My Merchant",
				        amount: { value: "27.50", currency: "USD" },
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
			"payeeId": payeeId ,
			"totalAmount": totalAmount ,
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
