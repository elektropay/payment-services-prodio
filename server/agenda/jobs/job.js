/**
 * Created by BeingShashi on 28/11/18.
 */
const {
    Service
} = require('service-adapter-prodio');
const paymentAdapter = new Service('payment');
paymentAdapter.init();

exports.paymentAdapter = paymentAdapter;