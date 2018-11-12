'use strict';

module.exports = function(Ezpaypayees) {

	Ezpaypayees.remoteMethod(
          'addPayee', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{arg: 'merchantId',type: 'string',required: true},
               	{ arg: 'payeeInfo',type: 'object', required: true, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.addPayee = (merchantId,payeeInfo, cb) => {
		return cb(null, {"succes":true});
	}

	Ezpaypayees.remoteMethod(
          'editPayee', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{arg: 'payeeId',type: 'string',required: true},
               	{ arg: 'payeeInfo',type: 'object', required: true, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.editPayee = (payeeId,payeeInfo, cb) => {
		return cb(null, {"succes":true});
	}

	Ezpaypayees.remoteMethod(
          'removePayees', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{arg: 'payeeIds',type: 'string',required: true},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.removePayees = (payeeId,payeeInfo, cb) => {
		return cb(null, {"succes":true});
	}

	Ezpaypayees.remoteMethod(
          'importPayees', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{arg: 'merchantId',type: 'string',required: true},
               	{arg: 'payeeInfo',type: 'object',required: true,http: { source: 'body' }},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.importPayees = (merchantId,payeeInfo, cb) => {
		return cb(null, {"succes":true});
	}

	Ezpaypayees.remoteMethod(
          'addCardForPayee', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{arg: 'payeeId',type: 'string',required: true},
               	{arg: 'cardInfo',type: 'object',required: true,http: { source: 'body' }},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.addCardForPayee = (payeeId,cardInfo, cb) => {
		return cb(null, {"succes":true});
	}

	Ezpaypayees.remoteMethod(
          'removeCard', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{arg: 'payeeId',type: 'string',required: true},
               	{arg: 'cardId',type: 'object',required: true},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.removeCard = (payeeId,cardId, cb) => {
		return cb(null, {"succes":true});
	}

};
