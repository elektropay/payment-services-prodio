const Agenda = require('Agenda');
const axios = require('axios');

const mongoConnectionString = 'mongodb://localhost:27017/ezpaydental';

const agenda = new Agenda({db: {address: mongoConnectionString,useNewUrlParser:true}});

function doSomething(data){
    console.log(" \n \n auto event \n ");
    console.log(data);
}

async function processOp(data){
    console.log(" \n \n auto event \n ");
    console.log(data["attrs"]);
    // Make a request for a user with a given ID
    let apiCallUrl = data["attrs"]["data"]["apiUrl"]+"?installmentId="+data["attrs"]["data"]["jobId"];
    console.log(apiCallUrl);

    axios.get(apiCallUrl)
      .then(function (response) {
        // handle success
        console.log(response);
        return response;
      })
      .catch(function (error) {
        // handle error
        console.log(error);
        return error;
      })
      .then(function () {
        // always executed
        return true;
      });
}

module.exports = {
    syncAllJobs : () =>{
        agenda.jobs({}, function(e, jobs) {
          if(e) throw e;

          var definedJobs = {};
          jobs.forEach(function(job) {  if(job.attrs.type == "single") definedJobs[job.attrs.name] = job.attrs;  });

          //TODO : RE-SCHEDULE AGAIN ALL PENDING JOBS
        });

     function bindJob(interval, jobName, definedJobs) {
          if( !definedJobs[jobName] ||
              definedJobs[jobName].repeatInterval != interval ||
              !definedJobs[jobName].nextRunAt ||
              definedJobs[jobName].nextRunAt.getTime() < Date.now() ) {

            agenda.every(interval, jobName);
            console.log(jobName + ' is being bound by .every()');

          } else console.log(jobName + ' is NOT BEING BOUND by .every()');
        }
    },

    initAgenda : ()=>{
        ( async function() {
            //this.syncAllJobs() ;
            await agenda.start();
          } )();
    },
    setEvent : (eventObj) => {
    
        agenda.define(eventObj.jobId,(job, done) => {
            // doSomething(data => {
            //     done();
            //     console.log('params : ',data);
            // });
            processOp(job).then(res=>{
                done();
            }).catch(err=>{
                done(err)
            });
            
        });
        
        agenda.on('start', job => {
            console.log('Job %s starting', job.attrs.name);
        });
        
        agenda.on('complete', job => {
            console.log(`Job ${job.attrs.name} finished`);
        });
        
        agenda.on('success:send email', job => {
            console.log(`Sent Email Successfully to ${job.attrs.data.to}`);
          });
        
        ( async function() { 
            //await agenda.start();
            await agenda.schedule(eventObj.triggerAt, eventObj.jobId, eventObj);
        //    format for repet interval is '1 minute' or '*/1 * * * *'
          } )();
    },
    cancelEvent: (jobId) =>{
        //TODO : Cancel the agenda with given name - ${JobId}
    },
    rescheduleEvent: (jobId,triggerAt) =>{
        //TODO : Modify the agenda with given name - ${JobId}
    } 
}

