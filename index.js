const {Service} = require('service-adapter-prodio');
const NotificationAdapter = new Service('payment');
NotificationAdapter.init();

console.log(NotificationAdapter.createMerchant());
console.log(NotificationAdapter.integrity.createMerchant());