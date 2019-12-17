'use strict';


const ANNOTATION_ELITE_COLOUR = '#98df8a';
const ANNOTATION_HIGH_COLOUR = '#ffbb78';
const ANNOTATION_MEDIUM_COLOUR = '#d62728';
const MEAN_COLOUR = '#2ca02c';

const WIDGET_HEIGHT = 6;
const WIDGET_WIDTH = 8;


// Create a dashboard containing multiple widgets, each based from a consistent template
// The properties here map the metrics to a readable label
// unit conversion is used to convert from seconds to a more meaningful unit, based on the metric.
const MINUTES = {
  unit: 60,
  label: 'minutes'
};

const HOURS = {
  unit: 60 * 60,
  label: 'hours'
};

const DAYS = {
  unit: 60 * 60 * 24,
  label: 'days'
};

const ONE_DAYS = 60 * 60 * 24;
const SEVEN_DAYS = 60 * 60 * 24 * 7;

const applyLimits = (state) => {
  // See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_limits.html
  const maxMetricsPerWidget = 100;
  const maxMetricsPerServiceInAWidget = 2;
  const maxServices = Math.floor(maxMetricsPerWidget / maxMetricsPerServiceInAWidget);

  // For each service there will be three metrics (MTTR, MTBF, MTTF)
  const maxSupportedMetrics = maxServices * 3;

  if (state.metrics.length > maxSupportedMetrics) {
    console.warn(`Maximum of ${maxSupportedMetrics} metrics are allowed in a single dashboard. Some metrics will not be reported.`);
    state.metrics = state.metrics.sort((a, b) => (a.serviceName > b.serviceName) ? 1 : -1);
    state.metrics = state.metrics.slice(0, maxSupportedMetrics);
  }
};

function trendWidgets(metrics, y, state) {

  return state.widgetMappings.map(mapping => {
    const region = state.region;
    const filterredGroup = metrics.filter(x => x.metricName == mapping.label);
    let resultMetrics = filterredGroup.map(mappinggroup => {
      return [
        [
          {
            "expression": `FILL(m1/${mapping.unitConversion.unit},AVG(m1/${mapping.unitConversion.unit}))`,
            "id": "e2",
            "region": "ap-southeast-2",
            "label": mappinggroup.serviceName
          }
        ],
        [
          "Operations",
          mapping.label,
          "service",
          mappinggroup.serviceName,
          {
            "stat": "Average",
            "id": "m1",
            "visible": false,
            "period": SEVEN_DAYS
          }
        ]
      ]
    });
    //flatten the arrays
    resultMetrics = [].concat.apply([], resultMetrics);

    return {
      "type": "metric",
      "x": mapping.x,
      "y": mapping.y,
      "width": WIDGET_WIDTH,
      "height": WIDGET_HEIGHT,
      "properties": {
        "metrics": resultMetrics,
        "view": "timeSeries",
        "region": region,
        "title": mapping.label + ' Trend',
        "period": ONE_DAYS,
        "stacked": false,
        "yAxis": {
          "left": {
            "min": 0,
            "label": mapping.unitConversion.label,
            "showUnits": false
          },
          "right": {
            "showUnits": true
          }
        },
        "annotations": mapping.properties.annotations,
        "stat": "Sum"
      }
    };
  });

}

function averageWidgets(metrics, y, state) {

  return state.widgetMappings.map(mapping => {

    const filterredGroup = metrics.filter(x => x.metricName == mapping.label);
    let resultMetrics = filterredGroup.map(mappingGroup => {
      return [
        "Operations",
        mappingGroup.metricName,
        "service",
        mappingGroup.serviceName,
        {
          "id": "m1",
          "label": mappingGroup.serviceName
        }
      ]
    });
    return {
      "type": "metric",
      "x": mapping.x,
      "y": 10,
      "width": WIDGET_WIDTH,
      "height": WIDGET_HEIGHT,
      "properties": {
        "metrics": resultMetrics,
        "view": "singleValue",
        "region": state.region,
        "stat": "Average",
        "period": 604800,
        "title": `${mapping.label} Average (7d)`
      }
    }
  });

}

class DashboardTrendGenerator {
  run(eventPromise) {
    return eventPromise
      .then(this.initializeState)
      .then(this.getMetrics)
      .then(this.putDashboard);
  }


  initializeState(state) {
    state.metrics = [];

    state.widgetMappings = [
      {
        "x": 0,
        "y": 4,
        "unitConversion": HOURS,
        "label": "MTTR",
        "properties": {
          "annotations": {
            "horizontal": [
              {
                "color": ANNOTATION_ELITE_COLOUR,
                "label": "< 1 hours",
                "value": 1,
                "fill": "below"
              },
              [
                {
                  "color": ANNOTATION_HIGH_COLOUR,
                  "label": "> 1 hours",
                  "value": 1
                },
                {
                  "value": 12,
                  "label": "< 0.5 day"
                }
              ],
              {
                "color": ANNOTATION_MEDIUM_COLOUR,
                "label": "> 0.5 day",
                "value": 12,
                "fill": "above"
              }
            ]
          }
        }
      },
      {
        "x": 8,
        "y": 4,
        "unitConversion": DAYS,
        "label": "MTBF",
        "properties": {
          "annotations": {
            "horizontal": [
              {
                "color": ANNOTATION_ELITE_COLOUR,
                "label": "> 1 week",
                "value": 7,
                "fill": "above"
              },
              [
                {
                  "color": ANNOTATION_HIGH_COLOUR,
                  "label": "< 1 week",
                  "value": 7
                },
                {
                  "value": 1,
                  "label": "1 day"
                }
              ],
              {
                "color": ANNOTATION_MEDIUM_COLOUR,
                "label": "< 1 day",
                "value": 1,
                "fill": "below"
              }
            ]
          }
        }
      },
      {
        "x": 16,
        "y": 4,
        "unitConversion": DAYS,
        "label": "MTTF",
        "properties": {
          "annotations": {
            "horizontal": [
              {
                "color": ANNOTATION_ELITE_COLOUR,
                "label": "> 1 week",
                "value": 7,
                "fill": "above"
              },
              [
                {
                  "color": ANNOTATION_HIGH_COLOUR,
                  "label": "< 1 week",
                  "value": 7
                },
                {
                  "value": 1,
                  "label": "1 day"
                }
              ],
              {
                "color": ANNOTATION_MEDIUM_COLOUR,
                "label": "< 1 day",
                "value": 1,
                "fill": "below"
              }
            ]
          }
        }
      }
    ];

    return state;
  }

  getMetrics(state) {
    return new Promise(function (resolve, reject) {
      state.cloudwatch.listMetrics({ "Namespace": "Operations" }).eachPage(function (err, data) {
        if (err) {
          reject(err);
          return;
        }

        if (data === null) {
          resolve(state);
        } else {

          state.metrics =
            data.Metrics.map(m => m.Dimensions.filter(d => d.Name === 'service').map(d => { return { serviceName: d.Value, metricName: m.MetricName } }))
              .reduce((a, b) => a.concat(b), state.metrics);
        }
      });

    });
  }


  putDashboard(state) {
    state.metrics = [...new Set(state.metrics)].sort();
    let y = 0; // leave space for the legend on first row

    applyLimits(state);

    let dashboard = {
      "start": "-P42D",
      "widgets": [],
    };

    const TEXT_HEIGHT = 4;
    let x = 0;
    [
      {
        "title": "MTTR",
        "description":
          "Mean time to recovery.  **Lower = better**\n\n" +
          "When a failure occurs, how quickly is service restored.\n\n" +
          "When the system fails, the team should \"stop the line\" and swarm to fix it.\n"
      },
      {
        "title": "MTBF",
        "description":
          "Mean time between failures.  **Higher = better**\n\n" +
          "MTBF describes system stability.  How often does the service fail.\n\n" +
          "An unstable system suggests systemic quality/resiliency issues that needs to be addressed.\n"
      },
      {
        "title": "MTTF",
        "description":
          "Mean time to failure.  **Higher = better**\n\n" +
          "How stable/available is the system.\n\n" +
          "A low MTTF indicates that the system if often unavailable.\n\n" +
          "Improve availability by improving system resiliency.  Reduce planned outages using staged deployment, such as blue/green or canary releasing.\n"
      }
    ].forEach(l => {
      dashboard.widgets.push({
        "type": "text",
        "x": x,
        "y": y,
        "width": l.y ? l.y : 8,
        "height": TEXT_HEIGHT,
        "properties": {
          "markdown": `\n### ${l.title}\n${l.description}`
        }
      });

      x += 8;
    });
    y += TEXT_HEIGHT;

    let widget = [trendWidgets(state.metrics, y, state)].concat(averageWidgets(state.metrics, y, state));
    y += WIDGET_HEIGHT;

    // flatten the nested arrays
    dashboard.widgets = [].concat.apply(dashboard.widgets, widget);

    return state.cloudwatch.putDashboard({
      'DashboardName': 'AvailabilityTrends-' + state.region,
      'DashboardBody': JSON.stringify(dashboard)
    }).promise();
  }
}

module.exports = DashboardTrendGenerator;
