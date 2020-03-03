'use strict';

var AWS = require('aws-sdk-mock');
var awsSdk = require('aws-sdk');
var chai = require("chai");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);
var expect = chai.expect;
var LambdaTester = require('lambda-tester');
var index = require('../src/dashboardHandler');
var sinon = require('sinon');

describe("generateDashboardTrend", () => {
  let listMetricsStub;
  let putDashboardSpy;
  var sandbox = sinon.createSandbox();

  function generateMetrics(n) {
    return [...Array(n).keys()].map(idx => {
      return [{
        "Namespace": "Operations",
        "Dimensions": [
          {
            "Name": "service",
            "Value": `service-${idx}`
          }
        ],
        "MetricName": "MTTR"
      },
      {
        "Namespace": "Operations",
        "Dimensions": [
          {
            "Name": "service",
            "Value": `service-${idx}`
          }
        ],
        "MetricName": "MTBF"
      },
      {
        "Namespace": "Operations",
        "Dimensions": [
          {
            "Name": "service",
            "Value": `service-${idx}`
          }
        ],
        "MetricName": "MTTF"
      }
      ]
    });
  }
  let scenarios = [
    {
      description: "sample dashboard - single service",
      dashboard: "./sample-data/dashboard-sample.json",
      uniqueServices: 1,
      metrics: {
        "Metrics": [
          {
            "Namespace": "Operations",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "flaky-service"
              }
            ],
            "MetricName": "MTTR"
          },
          {
            "Namespace": "Operations",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "flaky-service"
              }
            ],
            "MetricName": "MTTF"
          },
          {
            "Namespace": "Operations",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "flaky-service"
              }
            ],
            "MetricName": "MTBF"
          }
        ]
      },
      event: {
        "account": "123456789012",
        "region": "ap-southeast-2",
        "detail": {},
        "detail-type": "Scheduled Event",
        "source": "aws.events",
        "time": "2019-03-01T01:23:45Z",
        "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
        "resources": [
          "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
        ]
      }
    }, {
      description: "sample dashboard - multiple service",
      dashboard: "./sample-data/dashboard-multiple-sample.json",
      uniqueServices: 2,
      metrics: {
        "Metrics": [].concat.apply([], generateMetrics(2))
      },
      event: {
        "account": "123456789012",
        "region": "ap-southeast-2",
        "detail": {},
        "detail-type": "Scheduled Event",
        "source": "aws.events",
        "time": "2019-03-01T01:23:45Z",
        "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
        "resources": [
          "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
        ]
      }
    },
    {
      description: "sample dashboard - more metrics than allowed in a single dashboard",
      uniqueServices: 84,
      expectTruncated: true,

      metrics: {
        "Metrics": [].concat.apply([], generateMetrics(84))
      },
      event: {
        "account": "123456789012",
        "region": "ap-southeast-2",
        "detail": {},
        "detail-type": "Scheduled Event",
        "source": "aws.events",
        "time": "2019-03-01T01:23:45Z",
        "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
        "resources": [
          "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
        ]
      }
    }
  ]

  scenarios.forEach(scenario => {
    describe(scenario.description, () => {
      beforeEach(() => {

        // https://github.com/dwyl/aws-sdk-mock/issues/118
        // Cannot use aws-sdk-mock
        putDashboardSpy = sandbox.stub().returns({
          // putDashboardSpy = sinon.stub().returns({
          promise: () => Promise.resolve()
        })

        listMetricsStub = sandbox.stub().returns({
          // listMetricsStub = sinon.stub().returns({
          eachPage: (cb) => {
            cb(null, scenario.metrics)

            cb(null, null) // no more pages
          }
        })
        // sinon.stub(awsSdk, 'CloudWatch').returns({
        sandbox.stub(awsSdk, 'CloudWatch').returns({
          listMetrics: listMetricsStub,
          putDashboard: putDashboardSpy
        });

        awsSdk.config.region = 'ap-southeast-2';
      })

      afterEach(() => {
        // awsSdk.CloudWatch.restore();
        sandbox.restore();
      })

      it("should generate a dashboard", () => {
        return LambdaTester(index.generateDashboardTrend)
          .event(scenario.event)
          .expectResult((result, additional) => {
            expect(putDashboardSpy).to.have.callCount(1);
          });
      })

      if (scenario.expectTruncated) {
        describe('When there are too many metrics in the account', () => {
          it('should report a maximum of 150 metrics in the dashboard', () => {
            const consoleSpy = sandbox.spy(console, 'warn')
            return LambdaTester(index.generateDashboardTrend)
              .event(scenario.event)
              .expectResult((result, additional) => {
                expect(consoleSpy).to.have.been.calledWith("Maximum of 83 metrics are allowed in a single dashboard. Some metrics will not be reported.");
              });
          })
          it('should generate 4 text widgets - to explain each metric and a warning text to expect truncate', () => {
            return LambdaTester(index.generateDashboardTrend)
              .event(scenario.event)
              .expectResult((result, additional) => {
                const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
                const textWidgets = dashboard.widgets.filter(w => w.type === 'text');
                console.log("Dashboard is: ", JSON.stringify(dashboard));
                expect(textWidgets.length).to.equal(4);

              });
          })
          it('should sort the list of metrics alphabetically and truncate the last one from the dashboard', () => {
            let modifiedScenario = scenario
            // Inserting a new service metric at the start of the array
            modifiedScenario.metrics.Metrics.unshift({
              "Namespace": "Operations",
              "Dimensions": [
                {
                  "Name": "service",
                  "Value": `service-ZZZ`
                }
              ],
              "MetricName": "MTTR"
            });
            return LambdaTester(index.generateDashboardTrend)
              .event(modifiedScenario.event)
              .expectResult((result, additional) => {
                const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
                const metricWidgets = dashboard.widgets.filter(w => w.type === 'metric');

                const metricsPerService = metricWidgets.map(w => w.properties.metrics)
                let flattenedArray = [].concat.apply([], metricsPerService);
                const zzzMetrics = flattenedArray.filter(m => m[0].label === "service-ZZZ")
                expect(zzzMetrics.length).to.equal(0);
              });
          })
        })
      } else {
        it('should generate the expected dashboard', () => {
          const expected = require(scenario.dashboard)

          return LambdaTester(index.generateDashboardTrend)
            .event(scenario.event)
            .expectResult((result, additional) => {
              const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
              expect(dashboard, `${JSON.stringify(dashboard)}\n !== \n${JSON.stringify(expected)}`).to.deep.equal(expected);

            });

        })

        it('should generate 3 text widgets - to explain each metric + interpretation', () => {
          return LambdaTester(index.generateDashboardTrend)
            .event(scenario.event)
            .expectResult((result, additional) => {
              const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
              const textWidgets = dashboard.widgets.filter(w => w.type === 'text');

              expect(textWidgets.length).to.equal(3);

            });
        })

        it(`should generate 6 non-text widgets per dashboard`, () => {

          return LambdaTester(index.generateDashboardTrend)
            .event(scenario.event)
            .expectResult((result, additional) => {
              const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
              const metricWidgets = dashboard.widgets.filter(w => w.type === 'metric');
              expect(metricWidgets.length).to.equal(6);

            });
        });

        describe("Trend Widgets", () => {

          it('should have a hidden metric per service on each widget', () => {
            return LambdaTester(index.generateDashboardTrend)
              .event(scenario.event)
              .expectResult((result, additional) => {
                const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
                const metricWidgets = dashboard.widgets.filter(w => w.type === 'metric' && w.properties.title.includes("Trend"));
                const metricsPerService = metricWidgets.map(w => w.properties.metrics)
                const flattenedArray = [].concat.apply([], metricsPerService);
                const sourceMetrics = flattenedArray.filter(m => m[0] === "Operations" && ["MTBF", "MTTR", "MTTF"].includes(m[1]))
                expect(sourceMetrics.length).to.equal(3 * scenario.uniqueServices)
                sourceMetrics.forEach(m => {
                  expect(m[4]).not.to.be.undefined
                  expect(m[4].visible).to.equal(false)
                })
              });
          })

          it('should have a visible expresstion trend per service on each widget', () => {
            return LambdaTester(index.generateDashboardTrend)
              .event(scenario.event)
              .expectResult((result, additional) => {
                const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
                const metricWidgets = dashboard.widgets.filter(w => w.type === 'metric' && w.properties.title.includes("Trend"));

                const metricsPerService = metricWidgets.map(w => w.properties.metrics)
                const flattenedArray = [].concat.apply([], metricsPerService);
                const expressions = flattenedArray.filter(m => m[0].expression)
                expect(expressions.length).to.equal(3 * scenario.uniqueServices)
                expressions.forEach(e => {
                  if (e.visible) {
                    expect(e.visible).to.be.true
                  }
                })
              });
          })

        })
      }
    })
  })


})
