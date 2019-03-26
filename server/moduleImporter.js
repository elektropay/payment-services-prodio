/**
 * Created by BeingShashi on 28/11/18.
 */
const {
    Service
} = require('service-adapter-prodio');
const paymentAdapter = new Service('payment');
paymentAdapter.init();

let db_data = require('./datasources.json');
db_data = JSON.parse(JSON.stringify(db_data));
const schedular = require('./agenda/schedular');
//schedular.setEvent(dataObj);
//console.log(db_data["db"]["database"]);
schedular.initAgenda(db_data["db"]["database"]);

exports.paymentAdapter = paymentAdapter;
exports.schedular = schedular;