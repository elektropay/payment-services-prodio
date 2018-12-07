const soap = require('soap');
const parseString = require('xml2js').parseString;
let soap_client_options = {};

//METHOD 1 --- USING TRANSACTIONS

soap.createClient('https://sandbox.ibxpays.com/ws/transact.asmx?wsdl', soap_client_options, function(err, client) {

    var paymentJson = {
        "Username": 'kinetempapi123',
        "Password": 'Technologies1',
        "Vendor": '75',
        "TransType": "Sale",
        "CardNum": '4111111111111111',
        "ExpDate": '1220',
        "MagData": "",
        "NameOnCard": 'Shashikant Sharma',
        "Amount": 200,
        "InvNum": 'c4fefdbd-7354-4dfe-aee5-c6c78f90d8fa',
        "PNRef": "",
        "Zip": "30330",
        "Street": "",
        "CVNum": '999',
        "ExtData": ""
    };
    try {

        client.ProcessCreditCard(paymentJson, function(err, result, body) {
            console.log(" \n \n METHOD 1 \n \n");
            console.log(JSON.stringify(result) + ":::" + result["ProcessCreditCardResult"]["Result"]);
            if (result && typeof result["ProcessCreditCardResult"] !== undefined && typeof result["ProcessCreditCardResult"]["Result"] !== undefined) {
                if (result["ProcessCreditCardResult"]["Result"] == "0") {
                    console.log(result);
                } else {
                    console.log(result);
                }

            } else {
                console.log(result);
            }
        });
    } catch (err) {
        console.log(err);
    }
});

// METHOD 2 -- USING RECURRING BILLING METHOD


soap.createClient('https://sandbox.ibxpays.com/vt/ws/recurring.asmx?wsdl', soap_client_options, function(err, client) {

    var paymentJson = {
        "Username": 'kinetempapi123',
        "Password": 'Technologies1',
        "Vendor": '75',
        "CcInfoKey": '120920',
        "Amount": 200,
        "InvNum": 'c4fefdbd-7354-4dfe-aee5-c6c78f90d8fa',
        "ExtData": ""
    };
    try {

        client.ProcessCreditCard(paymentJson, function(err, result, body) {
            console.log(" \n \n METHOD 2 \n \n");
            console.log(JSON.stringify(result) + ":::" + result["ProcessCreditCardResult"]["Result"]);
            if (result && typeof result["ProcessCreditCardResult"] !== undefined && typeof result["ProcessCreditCardResult"]["Result"] !== undefined) {
                if (result["ProcessCreditCardResult"]["Result"] == "0") {
                    console.log(result);
                } else {
                    console.log(result);
                }

            } else {
                console.log(result);
            }
        });
    } catch (err) {
        console.log(err);
    }
});