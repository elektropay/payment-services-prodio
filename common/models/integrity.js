var soap = require('soap');
var parseString = require('xml2js').parseString;

//  var IntegrityCrendentials = {
//     'UserName': "kinetempapi123",
//     'Password': "EzPay123",
//     'Vendor': "75",
//     'BeginDt': "1/11/2017",
//     'EndDt': "1/11/2018",
//     'RecurringURL':'https://sandbox.ibxpays.com/vt/ws/recurring.asmx?wsdl',
//     'TransactionsURL':'https://sandbox.ibxpays.com/ws/transact.asmx?wsdl',
//     'CardSafeURL':'https://sandbox.ibxpays.com/ws/cardsafe.asmx?wsdl',
//     'CustomFieldsURL':'https://sandbox.ibxpays.com/ws/customfields.asmx?wsdl',
//     'TransactionDetailsURL':'https://sandbox.ibxpays.com/vt/ws/trxdetail.asmx?wsdl',
// }

 var IntegrityCrendentials = {
    'UserName': "4190_Demo_IBX_IPS_ISV_9029676_API_0",
    'Password': "}z%vO=58=o",
    'Vendor': "2432",
    'BeginDt': "1/11/2017",
    'EndDt': "1/11/2018",
    'RecurringURL':'https://sandbox.ibxpays.com/vt/ws/recurring.asmx?wsdl',
    'TransactionsURL':'https://sandbox.ibxpays.com/ws/transact.asmx?wsdl',
    'CardSafeURL':'https://sandbox.ibxpays.com/ws/cardsafe.asmx?wsdl',
    'CustomFieldsURL':'https://sandbox.ibxpays.com/ws/customfields.asmx?wsdl',
    'TransactionDetailsURL':'https://sandbox.ibxpays.com/vt/ws/trxdetail.asmx?wsdl',
}


var soap_client_options = {};

var CardTrxSummaryParameters =   {
 'UserName': IntegrityCrendentials["UserName"],
 'Password': IntegrityCrendentials["Password"],
 'RPNum': IntegrityCrendentials["Vendor"],
 'BeginDt': IntegrityCrendentials["BeginDt"],
 'EndDt': IntegrityCrendentials["EndDt"],
 'ApprovalCode': "",
 'Register': "",
 'NameOnCard': "",
 'CardNum': "",
 'CardType': "",
 'ExcludeVoid': "true",
 'User': "",
 'SettleFlag': "",
 'SettleMsg': "",
 'SettleDt': "",
 'TransformType': "",
 'Xsl': "",
 'ColDelim': "",
 'RowDelim': "",
 'IncludeHeader': "true",
 'ExtData': ""
};


soap.createClient(IntegrityCrendentials["RecurringURL"], soap_client_options, function(err, client){
    var createCustomerJson = {
        "Username":IntegrityCrendentials["UserName"],
        "Password":IntegrityCrendentials["Password"],
        "TransType":"ADD",
        "Vendor": IntegrityCrendentials["Vendor"],
        "CustomerKey":"",
        "CustomerID": "Pawan Wagh",
        "CustomerName":"Pawan Wagh",
        "FirstName": "Pawan",
        "LastName": "Wagh",
        "Title":"",
        "Department":"",
        "Street1":"",
        "Street2":"",
        "Street3":"",
        "City":"",
        "StateID":"", 
        "Province":"",
        "Zip":"",
        "CountryID":"",
        "Email": "pawan@prodio.in",
        "DayPhone":"",
        "NightPhone":"",
        "Fax":"",
        "Mobile":"",
        "Status":"",
        "ExtData":""};

    try{
        client.ManageCustomer(createCustomerJson, function(err, result, body) {
            console.log(JSON.stringify(result)+":::"+result["ManageCustomerResult"]["CustomerKey"]);
            console.log(err);
            
            if(result && typeof result["ManageCustomerResult"] !== undefined && typeof result["ManageCustomerResult"]["CustomerKey"] !== undefined ){
                
            }else{
                //cb(null,{"status":0,"msg":"Error","data": err });
            }
        });
    }catch(err){
        //cb(null,{"status":0,"msg":"Integrity server issue.","data": err });
    }
});


// var creditCardInfo = {
//         "Username":IntegrityCrendentials["UserName"],
//         "Password":IntegrityCrendentials["Password"],
//         "TransType":"ADD",
//         "Vendor": IntegrityCrendentials["Vendor"],
//         "CustomerKey": userInfo["integrityCustomerID"],
//         "CardInfoKey":"", "CcAccountNum": creditcard_no,
//         "CcExpDate": creditcard_expdate ,
//         "CcNameOnCard": creditcard_owner_name,
//         "CcStreet": creditcard_street,
//         "CcZip": creditcard_zip,
//         "ExtData":""
//     };

// try{
//     client.ManageCreditCardInfo(creditCardInfo, function(err, card_result, body) {
//         //console.log(JSON.stringify(card_result["ManageCreditCardInfoResult"]));
//         if(card_result && typeof card_result["ManageCreditCardInfoResult"] !== undefined && typeof card_result["ManageCreditCardInfoResult"]["CcInfoKey"] !== undefined ){
//             var displayCard = creditcard_no.replace(/.(?=.{4})/g, "X" );
//             var paymentJson = {"user_id": new ObjectID(String(user_id)),"creditcard_no":creditcard_no,"creditcard_display": displayCard,"cardholder_name":creditcard_owner_name,"CcInfoKey":card_result["ManageCreditCardInfoResult"]["CcInfoKey"],
//                                "CustomerKey":userInfo["integrityCustomerID"],"created_at": new Date(),"save_creditcard":save_creditcard,"is_active":true,"is_default":true };

//         }else{
//             cb(null,{"status":0,"msg":"Error","data":card_result });
//         }
//     });
// }catch(err){
//     cb(null,{"status":0,"msg":"Integrity server issue.","data": err });
// }



// var processCreditCardJson = {"Username":IntegrityCrendentials["UserName"], "Password":IntegrityCrendentials["Password"], "Vendor": IntegrityCrendentials["Vendor"], "CcInfoKey": CcInfoKey , "Amount": amount , "InvNum":"", "ExtData":"","CVNum":""};
//     client.ProcessCreditCard(processCreditCardJson, function(err, card_result, body) {
//         if(card_result && typeof card_result["ProcessCreditCardResult"] !== undefined && typeof card_result["ProcessCreditCardResult"]["Result"] !== undefined && card_result["ProcessCreditCardResult"]["Result"] =="0" ){
            
//         }else{
//             cb(null,{"status":0,"msg": card_result["ProcessCreditCardResult"]["Message"],"data":card_result});
//         }
//     });



