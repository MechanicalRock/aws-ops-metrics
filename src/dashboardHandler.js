'use strict';

const DashboardTrendGenerator = require('./dashboardGenerator');

const AWS = require('aws-sdk');
if (!AWS.config.region) {
  AWS.config.region = process.env.AWS_DEFAULT_REGION;
}


exports.generateDashboardTrend = (event, context, callback) => {
  let statePromise = Promise.resolve({
    event: event,
    region: AWS.config.region,
    cloudwatch: new AWS.CloudWatch()
  });

  new DashboardTrendGenerator()
    .run(statePromise)
    .then(() => callback())
    .catch(callback);
};
