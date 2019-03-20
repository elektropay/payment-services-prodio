async function jobWorker(job, done){
	const.log(job);
	return job;
}

module.exports = function(jobName, agenda) {
	console.log("jobName:", jobName)
  agenda.define(jobName, (job, done) => jobWorker(job, done));
};