'use strict';
module.exports = function(Savedcardsmetadata) {

	Savedcardsmetadata.remoteMethod(
        'addEditUserCards', {
            http: {
                verb: 'post'
            },
            description: ["This request will provide transaction details"],
            accepts: [
            { arg: 'cardData', type: 'object', required: false,  http: { source: 'body' }},
            ],
            returns: {
                type: 'object',
                root: true
            }
        }
    );

    
    Savedcardsmetadata.addEditUserCards = (cardData, cb) => {

    	let insertJson = {
            "payerId":cardData["payerId"],
            "order_id": cardData["order_id"],
            "payer_identifier":cardData["payer_identifier"],
            "expire_month":cardData["expire_month"],
            "expire_year":cardData["expire_year"],
            "span":cardData["span"],
            "card_brand":cardData["card_brand"],
            "card_type":cardData["card_type"],
            "gatewayResponse": cardData["gatewayResponse"]
        };


    	let whereFilter = {"payerId": cardData["payerId"],"expire_month":cardData["expire_month"],"expire_year":cardData["expire_year"],"span":cardData["span"] };
    	Savedcardsmetadata.findOne({"where":whereFilter}).then(cardInfo=>{
    		if(cardInfo){
    			//update
    			cardInfo.updateAttributes(insertJson).then(insertJson=>{
    				cb(null,{"success":true,"cardId": insertJson["cardId"]});
    			});

    		}else{
    			//insert
    			Savedcardsmetadata.create(cardData).then(newCardInfo=>{
    				cb(null,{"success":true,"cardId": newCardInfo["cardId"] });
    			}).catch(err=>{

    			});
    		}
    	});
    }

};
