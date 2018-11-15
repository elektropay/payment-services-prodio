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

module.exports = function(Ezpaypayees) {

	Ezpaypayees.remoteMethod(
          'addPayee', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{ arg: 'merchantId',type: 'string',required: true},
               	{ arg: 'payeeInfo',type: 'object', required: true, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.addPayee = (merchantId,payeeInfo, cb) => {
          Ezpaypayees.app.models.ezpayMerchants.findById(merchantId,function(err,merchantInfo){
               if(err){
                    cb(new HttpErrors.InternalServerError('Query Error.', {expose: false }));
               }else{
                    if (isValidObject(merchantInfo)) {
                       Ezpaypayees.findOne({"where":{"email":payeeInfo["email"]}},function(err,payeeData){
                         if(err){
                              cb(new HttpErrors.InternalServerError('Query Error', {expose: false}));
                         }else{
                             if (isValidObject(payeeData)) {
                                   funCreateMerchantPayeeRelation(merchantId,payeeData["payeeId"],cb);
                             }else{
                                   Ezpaypayees.findOne({"where":{"mobileNumber":payeeInfo["mobileNumber"]}},function(err,payeeData){
                                        if(err){
                                             cb(new HttpErrors.InternalServerError('Query Error', {expose: false}));
                                        }else{
                                             if (isValidObject(payeeData)) {
                                                  funCreateMerchantPayeeRelation(merchantId,payeeData["payeeId"],cb);
                                             }else{
                                                  let savePayee = {
                                                       "firstName": isValid(payeeInfo["firstName"]) ? payeeInfo["firstName"] : "",
                                                       "lastName": isValid(payeeInfo["lastName"]) ? payeeInfo["lastName"] : "",
                                                       "email": isValid(payeeInfo["email"]) ? String(payeeInfo["email"]).toLowerCase() : "",
                                                       "mobileNumber": isValid(payeeInfo["mobileNumber"]) ? payeeInfo["mobileNumber"] : "",
                                                       "address": isValid(payeeInfo["address"]) ? payeeInfo["address"] : "",
                                                       "paymentMethod": isValid(payeeInfo["paymentMethod"]) ? payeeInfo["paymentMethod"] : "",
                                                       "isActive": true,
                                                       "createdAt": new Date(),
                                                       "updatedAt": new Date()
                                                   };

                                                  Ezpaypayees.create(savePayee).then(payeeObj => {
                                                       cb(null,{"success":true,"isAlreadyExists":false});
                                                  }).catch(error => {
                                                       cb(new HttpErrors.InternalServerError('Error while creating new payee.', { expose: false }));
                                                  });
                                             }
                                        }
                                   });
                             }
                         }
                       })  
                    }else{
                         cb(new HttpErrors.NotFound('Merchant Not Found!!', { expose: false }));
                    }
               }
          });
	}

     function funCreateMerchantPayeeRelation(merchantId,payeeId,cb){
        Ezpaypayees.app.models.merchantPayeesRelation.findOne({
              where: {
                  "merchantId": merchantId,"payeeId": payeeId
              }
          }).then(payeeData => {
              if (isValidObject(payeeData)) {
                    cb(null,{"success":true,"isAlreadyExists":true});
              }else{

                let savePayee = {
                    "merchantId": merchantId,
                    "payeeId":payeeId,
                    "isActive":true,
                    "createdAt": new Date(),
                };

                Ezpaymerchants.app.models.merchantPayeesRelation.create(savePayee).then(payeeObj => {
                    //return cb(null, merchantObj);
                    cb(null,{"success":true,"isAlreadyExists":true});
                }).catch(error => {
                    print(error);
                    cb(new HttpErrors.InternalServerError('Server Error While Adding Payee.', { expose: false }));
                });

              }
          }).catch(error => {
              print(error);
              cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
          });
    }


	Ezpaypayees.remoteMethod(
          'editPayee', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{ arg: 'payeeId',type: 'string',required: true},
               	{ arg: 'payeeInfo',type: 'object', required: true, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.editPayee = (payeeId,payeeInfo, cb) => {

          Ezpaypayees.findById(payeeId).then(payeeObj => {
               if(isValidObject(payeeObj)){
                    let payeeJson = {
                         "firstName": isValid(payeeInfo["firstName"]) ? payeeInfo["firstName"] : "",
                         "lastName": isValid(payeeInfo["lastName"]) ? payeeInfo["lastName"] : "",
                         "email": isValid(payeeInfo["email"]) ? String(payeeInfo["email"]).toLowerCase() : "",
                         "mobileNumber": isValid(payeeInfo["mobileNumber"]) ? payeeInfo["mobileNumber"] : "",
                         "address": isValid(payeeInfo["address"]) ? payeeInfo["address"] : "",
                         "paymentMethod": isValid(payeeInfo["paymentMethod"]) ? payeeInfo["paymentMethod"] : "",
                         "updatedAt": new Date()
                     };
                    payeeObj.updateAttributes(payeeJson).then(updatedPayeeInfo => {
                         cb(null,{"success":true});
                    }).catch(error =>{
                         cb(new HttpErrors.InternalServerError('Server Error, '+JSON.stringify(error), { expose: false }));
                    })

               }else{
                   cb(new HttpErrors.InternalServerError('Invalid Payee Id.', {expose: false})); 
               }
          }).catch(error => {
              print(error);
              cb(new HttpErrors.InternalServerError('Server Error, '+JSON.stringify(error), { expose: false }));
          });
	}

	Ezpaypayees.remoteMethod(
          'removePayees', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{arg: 'payeeIds',type: 'array',description:"comma seperated array like 1234,84356,3533",required: true},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.removePayees = (payeeIds, cb) => {
          let payeeIds = String(payeeIds).split(",");

          Ezpaypayees.updateAll({"in":payeeIds},{"isActive":false}).then(res=>{
               cb(null,{"success":true});
          }).catch(error=>{
               cb(new HttpErrors.InternalServerError('Server Error, '+JSON.stringify(error), { expose: false }));
          })
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
          // let cardInfo = {
          //      "cardNumber":"",
          //      "cardHolderName":"",
          //      "expDate":"",
          //      "cvv":"",
          //      "cardType":""
          // }
          Ezpaypayees.findById(payeeId).then(payeeObj=>{
               if(isValidObject(payeeObj)){
                    let filterObj = {"where":{"payeeId":payeeId,"cardType": cardInfo["cardType"],"cardNumberAlias": cardInfo["cardNumber"] }};

                    Ezpaypayees.app.models.savedCardsMetaData.findOne(filterObj).then(cardData=>{
                         if(isValidObject(cardData)){
                              //already exists
                              cb(null,{"success":true,"cardId": cardData["cardId"],"isNewCard":false });
                         }else{
                              //create new
                              let cardInfo = {
                                   "payeeId": payeeId ,
                                   "cardHolderName": cardInfo["cardHolderName"],
                                   "cardNumberAlias": cardInfo["cardNumber"] ,
                                   "expiryDate": cardInfo["expDate"],
                                   "cardType": cardInfo["cardType"],
                                   "cardRefId":"",
                                   "isActive":true,
                                   "savedAt": new Date()
                              };

                              Ezpaypayees.app.models.savedCardsMetaData.create(cardInfo).then(cardInformation=>{
                                   cb(null,{"success":true,"cardId": cardInformation["cardId"],"isNewCard":true });
                              }).catch(error=>{
                                   cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
                              })
                         }
                    }).catch(error=>{
                         cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
                    });
               } else {
                    //invalid payee
                    cb(new HttpErrors.InternalServerError('Invalid Payee ID.', { expose: false }));
               }
          }).catch(error=>{
               cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
          });
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
          Ezpaypayees.findById(payeeId).then(payeeInfo=>{
               if(isValidObject(payeeInfo)){
                    Ezpaypayees.app.models.savedCardsMetaData.findById(cardId).then(cardInfo=>{
                         if(isValidObject(cardInfo)){
                              cardInfo.updateAttributes({"isActive":false}).then(updatedCount=>{
                                   cb(null,{"success":true});
                              }).catch(error=>{
                                   cb(new HttpErrors.InternalServerError('Server Error', { expose: false }));
                              });
                         }else{
                              cb(new HttpErrors.InternalServerError('Invalid Card ID.', { expose: false }));
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

     Ezpaypayees.remoteMethod(
          'getSavedCards', {
               http: { verb: 'post' },
               description: ["get listing to cards saved by user."],
               accepts: [
                    {arg: 'payeeId',type: 'string',required: true}
               ],
               returns: { type: 'object', root: true }
          }
     );

     Ezpaypayees.getSavedCards = (payeeId, cb) => {
          Ezpaymerchants.app.models.savedCardsMetaData.find({
                include:[{relation:'Payee'}],
                 where: {"payeeId": payeeId,"isActive":true},
             }).then(userCards => {
                 //print(payees);
                 if (isValidObject(userCards)) {
                     return cb(null, userCards);
                 } else {
                     return cb(null, userCards);
                 }
             }).catch(error => {
                 return cb(new HttpErrors.InternalServerError('Db connection failed', {
                     expose: false
                 }));
             });
     }

};