const Agenda = require('Agenda');
const axios = require('axios');
const MongoClient = require('mongodb').MongoClient;
let mongoConnectionString, agenda;

const isNull = function(val) {
    if (typeof val === 'string') {
        val = val.trim();
    }
    if (val === undefined || val === null || typeof val === 'undefined' || val === '' || val === 'undefined') {
        return true;
    }
    return false;
};

function graceful() {
    console.log("shutting down...");
    agenda.stop(function() {
        console.log("agenda stopped and jobs  unlocked.");
        process.exit(0);
    });
}

//process.on("SIGTERM", graceful);
//process.on("SIGINT", graceful);

async function processOp(data) {
    let attrData = data["attrs"]["data"];
    // Make a request for a user with a given ID
    let apiCallUrl = attrData["apiUrl"] + "?installmentId=" + attrData["jobId"] + "&hostBaseURL=" + attrData["hostBaseURL"];
    console.log(apiCallUrl);

    axios.get(apiCallUrl)
        .then(function(response) {
            // handle success
            return response;
        })
        .catch(function(error) {
            // handle error
            processOp(data);
            return error;
        })
        .then(function() {
            // always executed
            return true;
        });
}

let definedJobs = {};

function syncAllJobs(agenda, mongoConnectionString, DB_NAME) {

    MongoClient.connect(mongoConnectionString, function(err, client) {
        if (err) {
            throw err;
        }
        const db = client.db(DB_NAME);
        const collection = db.collection('agendaJobs');
        let jobs = [];
        collection.find({}).toArray(function(err, docs) {
            //console.log(docs);
            docs.forEach(function(job) {
                //console.log(job);
                if (isNull(job["lastFinishedAt"])) {
                    //collection.remove({"name": job["name"] })(function(err,docs){
                    collection.remove({
                        "name": job["name"]
                    }, function(err, docs) {
                        //console.log(docs)
                        console.log("scheduled....." + job["data"].jobId);
                        funSetAgendaEvent(job["data"]);
                    });
                }
            });
        })
    });
    //agenda.jobs({}, function(e, jobs) {});
}

function funSetAgendaEvent(eventObj) {
    agenda.define(eventObj.jobId, (job, done) => {
        processOp(job).then(res => {
            done();
        }).catch(err => {
            done(err)
        });
    });

    agenda.on('start', job => {
        console.log('Job %s starting', job.attrs.name);
    });

    agenda.on('complete', job => {
        console.log(`Job ${job.attrs.name} finished`);
    });

    // agenda.on('success:send email', job => {
    //     console.log(`Sent Email Successfully to ${job.attrs.data.to}`);
    // });

    (async function() {
        //await agenda.start();
        await agenda.schedule(eventObj.triggerAt, eventObj.jobId, eventObj);
        //    format for repet interval is '1 minute' or '*/1 * * * *'
    })();
}

module.exports = {
    initAgenda: (DB_NAME) => {
        (async function() {
            //this.syncAllJobs() ;
            mongoConnectionString = 'mongodb://localhost:27017/' + DB_NAME;
            //agenda = new Agenda({db: {address: mongoConnectionString,useNewUrlParser:true}});
            agenda = new Agenda({
                db: {
                    address: mongoConnectionString,
                    collection: 'agendaJobs'
                },
                useNewUrlParser: true
            });

            await agenda.start();
            setTimeout(function() {
                syncAllJobs(agenda, mongoConnectionString, DB_NAME);
            }, 3000);

        })();
    },
    setEvent: (eventObj) => {
        funSetAgendaEvent(eventObj);
    },
    cancelEvent: (jobId) => {
        //TODO : Cancel the agenda with given name - ${JobId}
        agenda.cancel({
            name: jobId
        }, function(err, numRemoved) {
            console.log(err);
            console.log(numRemoved);
        });
    },
    rescheduleEvent: (jobId, jobData) => {
        //TODO : Modify the agenda with given name - ${JobId}
        // agenda.jobs({
        //     name: jobId
        // }, (error, jobs) => {
        //     const job = jobs[0];
        //     job.attrs.data = jobData;
        //     job.save();
        // });
        //check which works
        agenda.cancel({
            name: jobId
        }, function(err, numRemoved) {
            funSetAgendaEvent(jobData);
        });
    }
}