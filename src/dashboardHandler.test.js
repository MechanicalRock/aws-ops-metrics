'use strict';

var AWS = require('aws-sdk-mock');
var awsSdk = require('aws-sdk');
var chai = require("chai");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);
var expect = chai.expect;
var LambdaTester = require('lambda-tester');
var index = require('./dashboardHandler');
var sinon = require('sinon');

describe("generateDashboardTrend", () => {
  let listMetricsStub;
  let putDashboardSpy;
  var sandbox = sinon.createSandbox();

  function generateMetrics(n) {
    return [...Array(n).keys()].map(idx => {
      return {
        "Namespace": "Operations",
        "Dimensions": [
          {
            "Name": "service",
            "Value": `service-${idx}`
          }
        ],
        "MetricName": "MTTR"
      }
    });
  }
  let scenarios = [
    {
      description: "sample dashboard - single service",
      dashboard: "./dashboard-sample.json",
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
      dashboard: "./dashboard-multiple-sample.json",
      uniqueServices: 2,
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
          },
          {
            "Namespace": "Operations",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "stable-service"
              }
            ],
            "MetricName": "MTTR"
          },
          {
            "Namespace": "Operations",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "stable-service"
              }
            ],
            "MetricName": "MTTF"
          },
          {
            "Namespace": "Operations",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "stable-service"
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
    }
    // {
    //   description: "single service",
    //   uniquePipelines: 1,
    //   metrics: {
    //     "Metrics": [
    //       {
    //         "Namespace": "Operations",
    //         "Dimensions": [
    //           {
    //             "Name": "service",
    //             "Value": "my-service"
    //           }
    //         ],
    //         "MetricName": "MTTR"
    //       },
    //       {
    //         "Namespace": "Operations",
    //         "Dimensions": [
    //           {
    //             "Name": "service",
    //             "Value": "MTTF"
    //           }
    //         ],
    //         "MetricName": "SuccessCycleTime"
    //       },
    //     ]
    //   },
    //   event: {
    //     "account": "123456789012",
    //     "region": "ap-southeast-2",
    //     "detail": {},
    //     "detail-type": "Scheduled Event",
    //     "source": "aws.events",
    //     "time": "2019-03-01T01:23:45Z",
    //     "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
    //     "resources": [
    //       "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
    //     ]
    //   }
    // },
    // {
    //   description: "multiple services",
    //   uniquePipelines: 2,
    //   metrics: {
    //     "Metrics": [
    //       {
    //         "Namespace": "Operations",
    //         "Dimensions": [
    //           {
    //             "Name": "service",
    //             "Value": "service-1"
    //           }
    //         ],
    //         "MetricName": "MTBF"
    //       },
    //       {
    //         "Namespace": "Operations",
    //         "Dimensions": [
    //           {
    //             "Name": "service",
    //             "Value": "service-2"
    //           }
    //         ],
    //         "MetricName": "MTTF"
    //       },
    //     ]
    //   },
    //   event: {
    //     "account": "123456789012",
    //     "region": "ap-southeast-2",
    //     "detail": {},
    //     "detail-type": "Scheduled Event",
    //     "source": "aws.events",
    //     "time": "2019-03-01T01:23:45Z",
    //     "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
    //     "resources": [
    //       "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
    //     ]
    //   }
    // },
    // {
    //   description: "too many pipelines",
    //   expectTruncated: true,
    //   uniquePipelines: 3,

    //   metrics: {
    //     "Metrics": generateMetrics(3)
    //   },
    //   event: {
    //     "account": "123456789012",
    //     "region": "ap-southeast-2",
    //     "detail": {},
    //     "detail-type": "Scheduled Event",
    //     "source": "aws.events",
    //     "time": "2019-03-01T01:23:45Z",
    //     "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
    //     "resources": [
    //       "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
    //     ]
    //   }
    // }
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

      it('should generate 3 text widgets - to explain each metric + interpretation', () => {
        return LambdaTester(index.generateDashboardTrend)
          .event(scenario.event)
          .expectResult((result, additional) => {
            const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
            const textWidgets = dashboard.widgets.filter(w => w.type === 'text');

            expect(textWidgets.length).to.equal(3);

          });
      })

      it('should generate the expected dashboard', () => {
        const expected = require(scenario.dashboard)

        return LambdaTester(index.generateDashboardTrend)
          .event(scenario.event)
          .expectResult((result, additional) => {
            const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
            // console.log("Dashboard: ", JSON.stringify(dashboard));
            // const fs = require('fs')
            // const path = require('path')
            // fs.writeFileSync(path.join(__dirname, './generated.json'), JSON.stringify(dashboard, null, 2));
            // console.log("Expected: ", JSON.stringify(dashboard));

            // expect(JSON.stringify(dashboard)).to.equal(JSON.stringify(expected));
            expect(dashboard, `${JSON.stringify(dashboard)}\n !== \n${JSON.stringify(expected)}`).to.deep.equal(expected);

          });

      })

      if (scenario.expectTruncated) {
        describe('When there are too many pipelines in the account', () => {
          // it('should report a maximum of 31 pipelines in the dashboard', () => {
          //   const consoleSpy = sandbox.spy(console, 'warn')
          //   return LambdaTester(index.generateDashboardTrend)
          //     .event(scenario.event)
          //     .expectResult((result, additional) => {
          //       expect(consoleSpy).to.have.been.calledWith("Maximum of 31 allowed in a single dashboard.  Some pipelines will not be reported.");
          //     });
          // })
          // it('should log a warning when pipelines will not be reported', () => {
          //   const consoleSpy = sandbox.spy(console, 'warn')
          //   return LambdaTester(index.generateDashboardTrend)
          //     .event(scenario.event)
          //     .expectResult((result, additional) => {
          //       expect(consoleSpy).to.have.been.calledWith("Maximum of 31 allowed in a single dashboard.  Some pipelines will not be reported.");
          //     });
          // })
          it('should truncate the dashboard', () => {
            pending();
          })
        })
      } else {
        const widgetsPerPipeline = 4;
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
        // it('should graph all service metrics on each widget', () => {
        //   return LambdaTester(index.generateDashboardTrend)
        //     .event(scenario.event)
        //     .expectResult((result, additional) => {
        //       const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
        //       const metricWidgets = dashboard.widgets.filter(w => w.type === 'metric');

        //       const pipelineNames = [...new Set(scenario.metrics.Metrics.map(m => m.Dimensions[0].Value))];

        //       pipelineNames.forEach((name, idx) => {
        //         const startIdx = idx * widgetsPerPipeline;
        //         const widgetsForPipeline = metricWidgets.slice(startIdx, startIdx + widgetsPerPipeline);

        //         widgetsForPipeline.forEach(widget => {

        //           expect(JSON.stringify(widget.properties.metrics)).to.contain(name)
        //         })
        //       })
        //       console.log(pipelineNames)

        //     });

        // })
        // it('should reference the PipelineName in the metrics for each widget', () => {
        //   return LambdaTester(index.generateDashboardTrend)
        //     .event(scenario.event)
        //     .expectResult((result, additional) => {
        //       const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
        //       const metricWidgets = dashboard.widgets.filter(w => w.type === 'metric');

        //       const pipelineNames = [...new Set(scenario.metrics.Metrics.map(m => m.Dimensions[0].Value))];

        //       pipelineNames.forEach((name, idx) => {
        //         const startIdx = idx * widgetsPerPipeline;
        //         const widgetsForPipeline = metricWidgets.slice(startIdx, startIdx + widgetsPerPipeline);

        //         widgetsForPipeline.forEach(widget => {

        //           expect(JSON.stringify(widget.properties.metrics)).to.contain(name)
        //         })
        //       })
        //       console.log(pipelineNames)

        //     });
        // })
      }
    })
  })


})
