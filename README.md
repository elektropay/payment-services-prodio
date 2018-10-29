# payment-services-prodio

Prodio-Payments is a express based facade to multiple payment services.  
The idea is an simple and inutive API to handle just simple single payments. It's als designed to add more payment services over time, but without changing the general API.

The service type is just one argument within the process.

For every provider the required messaging endpoint, like Cayan's Key, will be attached to express. So everything you need is included.

We believe that payments is a problem rooted in code, not finance. We obsessively seek out elegant, composable abstractions that enable robust, scalable, flexible integrations. Because we eliminate needless complexity and extraneous details, you can get up and running with the module in just a couple of minutes.

# Features

* Quick Payments
	* Create Customer in respective provider.
	* Save Card Info (If opted, as per PCI Compliance)
	* Create Payment Transaction
	* Send Email If payment is failed/passed.
	* Save Customer Reference id and transaction Reference id into our database.

* Multi-tanant support.
	* Ability to create multiple sub-sites within single Merchant Account.

* Batch Payments
	* Perform batch payments for multiple customer with excel upload etc. (If provider has support for this)

* Subscriptions
	* Auto Recurring payments as per subscription types.

* Payment Transaction Logs.
	* Filter by date, customer, amount, card type etc.

* Payment Invoices.
	* It will create payment invoices and send them over emails. And also save them in pdf format over secure cloud for later use.

* Multiple Currency Support
	* Currently it only takes payments in USD.

* Refunds.
	* Ability to perform refund from respective provider based on the transaction reference id.

* Gift Cards.
	* The Gift Card services provide payment and loyalty operations for gift cards.

* Reports.

* Email Support.

* WebHooks.
 

### Currently Supported Payment Gateways

* [Cayan](https://cayan.com)


# Installation
1. Clone this repository on your server `git clone https://github.com/ProdioDesignWorks/payment-services-prodio.git`
2. Navigate to your repo `cd payment-services-prodio`
3. Install dependencies `npm install`
4. Start service `node .` or `npm start` or `node server/server.js`
5. Open `http://localhost:3000/explorer/` in your browser
5. If you've pm2 installed then use this `pm2 start server/server.js --name="PAYMENT_SERVICE"`
#### NOTE: 
`payment-services-prodio` uses loopback as the core framework for developing API's, so all customisations, configurations, middlewares, events, and db connectors can be used which you would have used in loopback. 


## Tech
`payment-services-prodio` uses number of open source tools to work properly

* [nodejs](https://nodejs.org/) - evented I/O for the backend
* [mongodb](https://github.com/mongodb/mongo) - datastore
* [loopback](https://loopback.io/) highly nodejs framework for developing node API's


## TODO's

* A `sandbox` config setting to switch beween the sandbox and live environments.


## Work in progress

`payment-services-prodio` is work in progress. Your ideas, suggestions etc. are very welcome.


## The License

