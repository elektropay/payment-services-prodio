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

module.exports = function(Ezpaypayees) {

	Ezpaypayees.remoteMethod(
          'addPayee', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{ arg: 'merchantId',type: 'string',required: true, http: { source: 'query' }},
               	{ arg: 'payeeInfo',type: 'object', required: true, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.addPayee = (merchantId,payeeInfo, cb) => {
    
        if (!isNull(payeeInfo["meta"])) {
            payeeInfo = payeeInfo["meta"]["payerInfo"];
        }

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
               	{ arg: 'payerId',type: 'string',required: true,http: { source: 'query' }},
               	{ arg: 'payeeInfo',type: 'object', required: true, http: { source: 'body' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.editPayee = (payerId,payeeInfo, cb) => {

    if (!isNull(payeeInfo["meta"])) {
            payeeInfo = payeeInfo["meta"]["payerInfo"];
        }

          Ezpaypayees.findById(payerId).then(payeeObj => {
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
               	{arg: 'payerIds',type: 'array',description:"comma seperated array like 1234,84356,3533",required: true,http: { source: 'query' }},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.removePayees = (payerIds, cb) => {
          payerIds = String(payerIds).split(",");

          Ezpaypayees.updateAll({"in":payerIds},{"isActive":false}).then(res=>{
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
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.importPayees = (merchantId, cb) => {
    const fs = require('fs');
    const download = require('download');
    var path = require("path");
    const excelToJson = require('convert-excel-to-json');

    let _url = "https://s3-us-west-2.amazonaws.com/ezpay-contents/template/PayerSample.xlsx";
    let file_name = path.basename(_url);
    let folder_path = 'temp_downloads/'+(new Date()).getTime();
     
    download(_url, folder_path).then(() => {
        console.log('done!');
        
        const result = excelToJson({
            sourceFile: folder_path+'/'+file_name
        });
        console.log(result);
        if(result){
          fs.unlink(folder_path+'/'+file_name, function(error) {
              if (error) {
                  throw error;
              }
              console.log('Deleted filename', file_name);
          });
        }

    });

		return cb(null, {"succes":true});
	}

	Ezpaypayees.remoteMethod(
          'addCardForPayee', {
               http: { verb: 'post' },
               description: ["Add Payee"],
               accepts: [
               	{arg: 'payerId',type: 'string',required: true,http: { source: 'query' }},
               	{arg: 'cardInfo',type: 'object',required: true,http: { source: 'body' }},
               ],
               returns: { type: 'object', root: true }
          }
     );

	Ezpaypayees.addCardForPayee = (payerId,cardInfo, cb) => {
          // let cardInfo = {
          //      "cardNumber":"",
          //      "cardHolderName":"",
          //      "expDate":"",
          //      "cvv":"",
          //      "cardType":""
          // }

          if (!isNull(cardInfo["meta"])) {
            cardInfo = cardInfo["meta"];
          }
          Ezpaypayees.findById(payeeId).then(payeeObj=>{
               if(isValidObject(payeeObj)){
                    let filterObj = {"where":{"payerId":payerId,"cardType": cardInfo["cardType"],"cardNumberAlias": cardInfo["cardNumber"] }};

                    Ezpaypayees.app.models.savedCardsMetaData.findOne(filterObj).then(cardData=>{
                         if(isValidObject(cardData)){
                              //already exists
                              cb(null,{"success":true,"cardId": cardData["cardId"],"isNewCard":false });
                         }else{
                              //create new
                              let cardInfo = {
                                   "payerId": payerId ,
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
               	{arg: 'payeeId',type: 'string',required: true,http: { source: 'query' }},
               	{arg: 'cardId',type: 'object',required: true,http: { source: 'query' }},
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
                    {arg: 'payerId',type: 'string',required: true,http: { source: 'query' }}
               ],
               returns: { type: 'object', root: true }
          }
     );

     Ezpaypayees.getSavedCards = (payerId, cb) => {
          Ezpaymerchants.app.models.savedCardsMetaData.find({
                include:[{relation:'Payee'}],
                 where: {"payeeId": payerId,"isActive":true},
             }).then(userCards => {
                 //print(payees);
                 if (isValidObject(userCards)) {
                     return cb(null, userCards);
                 } else {
                     return cb(new HttpErrors.InternalServerError('Invalid payer id', {
                       expose: false
                   }));
                 }
             }).catch(error => {
                 return cb(new HttpErrors.InternalServerError('Db connection failed', {
                     expose: false
                 }));
             });
     }

};
